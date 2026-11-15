// Setores (ramos de atuação) e cadências de mensagens por setor, editados pelo admin no painel.
// Toda função valida has_role(admin) pelo cliente do próprio usuário ANTES de usar o service role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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

/** Cria (sem id) ou edita um setor. */
export const sectorSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        active: z.boolean(),
        sort: z.number().int().min(0).max(9999),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const row = { name: data.name, active: data.active, sort: data.sort };
    const { data: saved, error } = data.id
      ? await db.from("sectors").update(row).eq("id", data.id).select("id").single()
      : await db.from("sectors").insert(row).select("id").single();
    if (error)
      throw new Error(
        error.code === "23505" ? "Já existe um setor com esse nome" : "Falha ao salvar o setor",
      );
    return { id: saved.id };
  });

/** Grava as mensagens da cadência de um setor (etapas enviadas; texto vazio volta ao modelo padrão). */
export const sectorSaveCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sectorId: z.string().uuid(),
        steps: z
          .array(
            z.object({
              step: z.number().int().min(1).max(5),
              code: z.string().trim().max(20),
              body: z.string().max(4000),
            }),
          )
          .min(1)
          .max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const rows = data.steps.map((s) => ({
      sector_id: data.sectorId,
      step: s.step,
      code: s.code,
      body: s.body.trim(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("sector_templates").upsert(rows);
    if (error) throw new Error("Falha ao salvar a cadência");
    return { ok: true as const };
  });

/** Exclui um setor sem empresas. Com empresas, o caminho é desativar (as empresas mantêm o setor). */
export const sectorDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { count, error: countError } = await db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("sector_id", data.id);
    if (countError) throw new Error("Falha ao verificar empresas do setor");
    if (count) throw new Error(`Setor usado por ${count} empresa(s): desative em vez de excluir`);
    const { error } = await db.from("sectors").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir o setor");
    return { ok: true as const };
  });

/** Quantas empresas (de todos os hunters) usam cada setor. */
export const sectorUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { fetchAll } = await import("./fetch-all");
    const rows = await fetchAll((a, b) =>
      db.from("companies").select("sector_id").order("id").range(a, b),
    );
    const usage: Record<string, number> = {};
    for (const r of rows) usage[r.sector_id] = (usage[r.sector_id] ?? 0) + 1;
    return usage;
  });
