// Server functions da Dashboard de Outbound (só admin). Toda leitura e escrita das tabelas da
// dashboard passa por aqui, com has_role antes da service role. Regras puras em `safras.ts`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  METAS_CICLO_VAZIAS,
  PARAMETROS_PADRAO,
  erroMetasCiclo,
  erroParametros,
  erroSafra,
  semanasSugeridas,
  type MetasCiclo,
  type Parametros,
  type Safra,
} from "./safras";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso negado");
}

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SAFRA_COLS = "id, period_id, numero, inicio, fim, usa_alocacao";

export type CicloResumo = {
  id: string;
  name: string;
  status: string;
  started_at: string;
  closed_at: string | null;
};

export type SemanasDados = {
  ciclos: CicloResumo[];
  safras: Safra[];
  parametros: Parametros;
  /** Metas do ciclo por `period_id`; ciclo sem linha = sem metas. */
  metas: Record<string, MetasCiclo>;
};

/** Ciclos, safras de todos os ciclos, parâmetros e metas dos ciclos. */
export const dashboardSemanas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SemanasDados> => {
    await assertAdmin(context);
    const admin = await db();
    const [ciclos, safras, parametros, metas] = await Promise.all([
      admin
        .from("periods")
        .select("id, name, status, started_at, closed_at")
        .eq("kind", "ciclo")
        .order("started_at", { ascending: false }),
      admin.from("safras").select(SAFRA_COLS).order("inicio"),
      admin.from("dashboard_parametros").select("*").maybeSingle(),
      admin.from("ciclo_metas").select("*"),
    ]);
    const erro = ciclos.error ?? safras.error ?? parametros.error ?? metas.error;
    if (erro) throw new Error("Falha ao carregar as semanas");
    const p = parametros.data;
    return {
      ciclos: ciclos.data ?? [],
      safras: safras.data ?? [],
      parametros: p
        ? {
            maturacao_semanas: p.maturacao_semanas,
            amostra_minima_ab: p.amostra_minima_ab,
            min_ats_segmento: p.min_ats_segmento,
            avanco_fica_pct: p.avanco_fica_pct,
            avanco_troca_pct: p.avanco_troca_pct,
            esforco_alerta_pct: p.esforco_alerta_pct,
            dias_contato_parado: p.dias_contato_parado,
            concentracao_ats_pct: p.concentracao_ats_pct,
            nao_realizadas_pct: p.nao_realizadas_pct,
            semanas_seguidas: p.semanas_seguidas,
          }
        : PARAMETROS_PADRAO,
      metas: Object.fromEntries(
        (metas.data ?? []).map((m) => [
          m.period_id,
          {
            ats_avancaram: m.ats_avancaram,
            ats_marcadas: m.ats_marcadas,
            ats_realizadas: m.ats_realizadas,
            contatos: m.contatos,
            vendas: m.vendas,
          },
        ]),
      ),
    };
  });

const safraForm = z.object({
  numero: z.number().int().min(1),
  inicio: isoDay,
  fim: isoDay,
  usa_alocacao: z.boolean(),
});

async function cicloExiste(admin: Awaited<ReturnType<typeof db>>, periodId: string) {
  const { data, error } = await admin
    .from("periods")
    .select("id")
    .eq("id", periodId)
    .eq("kind", "ciclo")
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar o ciclo");
  if (!data) throw new Error("Ciclo não encontrado");
}

async function outrasSafras(admin: Awaited<ReturnType<typeof db>>, semId?: string) {
  let q = admin.from("safras").select("id, period_id, numero, inicio");
  if (semId) q = q.neq("id", semId);
  const { data, error } = await q;
  if (error) throw new Error("Falha ao carregar as safras");
  return data;
}

/** Cria uma safra num ciclo. */
export const dashboardCriarSafra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), safra: safraForm }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    await cicloExiste(admin, data.periodId);
    const erro = erroSafra(data.safra, data.periodId, await outrasSafras(admin));
    if (erro) throw new Error(erro);
    const { error } = await admin
      .from("safras")
      .insert({ ...data.safra, period_id: data.periodId });
    if (error) throw new Error("Falha ao criar a safra");
    return { ok: true as const };
  });

/** Cria de uma vez as semanas que faltam no ciclo, até `ate` (segunda a sexta). */
export const dashboardGerarSafras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ periodId: z.string().uuid(), inicio: isoDay, ate: isoDay })
      .refine((v) => v.inicio <= v.ate, "O início deve vir antes do fim")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    await cicloExiste(admin, data.periodId);
    const novas = semanasSugeridas(data.inicio, data.ate, await outrasSafras(admin), data.periodId);
    if (novas.length > 60) throw new Error("Intervalo grande demais (mais de 60 semanas)");
    if (novas.length === 0) return { criadas: 0 };
    const { error } = await admin
      .from("safras")
      .insert(novas.map((s) => ({ ...s, period_id: data.periodId })));
    if (error) throw new Error("Falha ao criar as safras");
    return { criadas: novas.length };
  });

/**
 * Edita uma safra. Mudar as datas reatribui os contatos daquela semana (a safra sai da data de
 * criação do contato); a tela pede confirmação antes.
 */
export const dashboardEditarSafra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), safra: safraForm }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { data: atual, error: e1 } = await admin
      .from("safras")
      .select("period_id")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error("Falha ao carregar a safra");
    if (!atual) throw new Error("Safra não encontrada");
    const erro = erroSafra(data.safra, atual.period_id, await outrasSafras(admin, data.id));
    if (erro) throw new Error(erro);
    const { error } = await admin.from("safras").update(data.safra).eq("id", data.id);
    if (error) throw new Error("Falha ao salvar a safra");
    return { ok: true as const };
  });

/** Exclui uma safra (as alocações dela entram na fase 2 e vão bloquear a exclusão). */
export const dashboardExcluirSafra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { error } = await admin.from("safras").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir a safra");
    return { ok: true as const };
  });

const inteiro = z.number().int();

/** Grava os parâmetros da dashboard (linha única). */
export const dashboardSalvarParametros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        maturacao_semanas: inteiro,
        amostra_minima_ab: inteiro,
        min_ats_segmento: inteiro,
        avanco_fica_pct: inteiro,
        avanco_troca_pct: inteiro,
        esforco_alerta_pct: inteiro,
        dias_contato_parado: inteiro,
        concentracao_ats_pct: inteiro,
        nao_realizadas_pct: inteiro,
        semanas_seguidas: inteiro,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const erro = erroParametros(data);
    if (erro) throw new Error(erro);
    const admin = await db();
    const { error } = await admin.from("dashboard_parametros").upsert({ id: true, ...data });
    if (error) throw new Error("Falha ao salvar os parâmetros");
    return { ok: true as const };
  });

const meta = z.number().int().min(0).nullable();

/** Grava as metas de um ciclo; todas vazias apaga a linha. */
export const dashboardSalvarMetasCiclo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        periodId: z.string().uuid(),
        metas: z.object({
          ats_avancaram: meta,
          ats_marcadas: meta,
          ats_realizadas: meta,
          contatos: meta,
          vendas: meta,
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const erro = erroMetasCiclo(data.metas);
    if (erro) throw new Error(erro);
    const admin = await db();
    await cicloExiste(admin, data.periodId);
    const vazias = Object.values(data.metas).every((v) => v === null);
    const { error } = vazias
      ? await admin.from("ciclo_metas").delete().eq("period_id", data.periodId)
      : await admin.from("ciclo_metas").upsert({ period_id: data.periodId, ...data.metas });
    if (error) throw new Error("Falha ao salvar as metas do ciclo");
    return { ok: true as const, metas: vazias ? METAS_CICLO_VAZIAS : data.metas };
  });
