// Setores (ramos de atuação) e cadências de mensagens por setor, editados pelo admin no painel.
// Toda função valida has_role(admin) pelo cliente do próprio usuário ANTES de usar o service role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { STEPS } from "./cadencia";
import { PERSONA_KEYS, isPersona, type Persona } from "./personas";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso negado");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Erros dos triggers de nível (mensagem em português) passam; o resto vira texto genérico. */
const LEVEL_ERRORS = [
  "Subsetor não pode ter subsetores",
  "Um setor não pode ser subsetor de si mesmo",
  "O setor pai não pode ser trocado",
];

/**
 * Cria (sem id) ou edita um setor. `parentId` cria um subsetor e só vale na criação: o pai não
 * muda depois (o banco recusa).
 */
export const sectorSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        active: z.boolean(),
        sort: z.number().int().min(0).max(9999),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const row = { name: data.name, active: data.active, sort: data.sort };
    const { data: saved, error } = data.id
      ? await db.from("sectors").update(row).eq("id", data.id).select("id").single()
      : await db
          .from("sectors")
          .insert({ ...row, parent_id: data.parentId ?? null })
          .select("id")
          .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um setor (ou subsetor) com esse nome");
      const known = LEVEL_ERRORS.find((m) => error.message.includes(m));
      throw new Error(known ?? "Falha ao salvar o setor");
    }
    return { id: saved.id };
  });

/**
 * Grava as mensagens da cadência de um setor ou subsetor (etapas enviadas; texto vazio volta ao
 * nível de baixo). `persona` vazia = qualquer persona; sem o campo, vale como antes.
 */
export const sectorSaveCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sectorId: z.string().uuid(),
        steps: z
          .array(
            z.object({
              step: z.number().int().min(1).max(STEPS.length),
              persona: z
                .string()
                .refine((v) => v === "" || isPersona(v), "Persona inválida")
                .transform((v) => v as Persona | "")
                .default(""),
              code: z.string().trim().max(20),
              body: z.string().max(4000),
            }),
          )
          .min(1)
          .max(STEPS.length * (PERSONA_KEYS.length + 1)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const rows = data.steps.map((s) => ({
      sector_id: data.sectorId,
      persona: s.persona,
      step: s.step,
      code: s.code,
      body: s.body.trim(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db
      .from("sector_templates")
      .upsert(rows, { onConflict: "sector_id,persona,step" });
    if (error) throw new Error("Falha ao salvar a cadência");
    return { ok: true as const };
  });

/**
 * Exclui um setor ou subsetor sem empresas. Setor com subsetores também não sai. Com empresas, o
 * caminho é desativar (as empresas mantêm o setor).
 */
export const sectorDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { count, error: countError } = await db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .or(`sector_id.eq.${data.id},subsector_id.eq.${data.id}`);
    if (countError) throw new Error("Falha ao verificar empresas do setor");
    const { count: subs, error: subsError } = await db
      .from("sectors")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", data.id);
    if (subsError) throw new Error("Falha ao verificar subsetores");
    if (subs) throw new Error("Exclua ou desative os subsetores antes");
    if (count) throw new Error(`Setor usado por ${count} empresa(s): desative em vez de excluir`);
    const { error } = await db.from("sectors").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir o setor");
    return { ok: true as const };
  });

/** Quantas empresas (de todos os hunters) usam cada setor ou subsetor. */
export const sectorUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { fetchAll } = await import("./fetch-all");
    const rows = await fetchAll((a, b) =>
      db.from("companies").select("sector_id, subsector_id").order("id").range(a, b),
    );
    const usage: Record<string, number> = {};
    for (const r of rows) {
      usage[r.sector_id] = (usage[r.sector_id] ?? 0) + 1;
      if (r.subsector_id) usage[r.subsector_id] = (usage[r.subsector_id] ?? 0) + 1;
    }
    return usage;
  });
