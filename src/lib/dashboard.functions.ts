// Server functions da Dashboard de Outbound (só admin). Toda leitura e escrita das tabelas da
// dashboard passa por aqui, com has_role antes da service role. Regras puras em `safras.ts`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  alocacaoLimpa,
  copiarAlocacoes,
  erroAlocacao,
  erroDuranteSafra,
  modoEdicao,
  type Alocacao,
  type AlocacaoForm,
} from "./alocacao";
import {
  METAS_CICLO_VAZIAS,
  safraAnterior,
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

/**
 * Falha de consulta com o motivo do banco: vai para o log da Vercel e para a tela (só admins chegam
 * a estas funções), para dar para saber o que quebrou em produção.
 */
function falha(msg: string, erro?: unknown): never {
  console.error(`[dashboard] ${msg}`, erro);
  const motivo =
    erro && typeof erro === "object" && "message" in erro
      ? String((erro as { message: unknown }).message)
      : "";
  throw new Error(motivo ? `${msg} (${motivo})` : msg);
}
const SAFRA_COLS = "id, period_id, numero, inicio, fim, usa_alocacao, cadencia_em";

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
    if (erro) falha("Falha ao carregar as semanas", erro);
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
  cadencia_em: isoDay,
});

async function cicloExiste(admin: Awaited<ReturnType<typeof db>>, periodId: string) {
  const { data, error } = await admin
    .from("periods")
    .select("id")
    .eq("id", periodId)
    .eq("kind", "ciclo")
    .maybeSingle();
  if (error) falha("Falha ao carregar o ciclo", error);
  if (!data) throw new Error("Ciclo não encontrado");
}

async function outrasSafras(admin: Awaited<ReturnType<typeof db>>, semId?: string) {
  let q = admin.from("safras").select("id, period_id, numero, inicio");
  if (semId) q = q.neq("id", semId);
  const { data, error } = await q;
  if (error) falha("Falha ao carregar as safras", error);
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
    if (error) falha("Falha ao criar a safra", error);
    return { ok: true as const };
  });

/** Cria de uma vez as semanas que faltam no ciclo, até `ate` (segunda a sexta). */
export const dashboardGerarSafras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        periodId: z.string().uuid(),
        inicio: isoDay,
        ate: isoDay,
        // Semanas sem trabalho (ex.: provas) e as de prospecção e cadência na mesma semana.
        pausas: z.array(isoDay).max(60).default([]),
        mesmaSemana: z.array(isoDay).max(60).default([]),
      })
      .refine((v) => v.inicio <= v.ate, "O início deve vir antes do fim")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    await cicloExiste(admin, data.periodId);
    const novas = semanasSugeridas(
      data.inicio,
      data.ate,
      await outrasSafras(admin),
      data.periodId,
      {
        pausas: data.pausas,
        mesmaSemana: data.mesmaSemana,
      },
    );
    if (novas.length > 60) throw new Error("Intervalo grande demais (mais de 60 semanas)");
    if (novas.length === 0) return { criadas: 0 };
    const { error } = await admin
      .from("safras")
      .insert(novas.map((s) => ({ ...s, period_id: data.periodId })));
    if (error) falha("Falha ao criar as safras", error);
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
    if (e1) falha("Falha ao carregar a safra", e1);
    if (!atual) throw new Error("Safra não encontrada");
    const erro = erroSafra(data.safra, atual.period_id, await outrasSafras(admin, data.id));
    if (erro) throw new Error(erro);
    const { error } = await admin.from("safras").update(data.safra).eq("id", data.id);
    if (error) falha("Falha ao salvar a safra", error);
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
    if (error?.code === "23503")
      throw new Error(
        error.message.includes("ab_testes")
          ? "A safra é início ou fim de um teste A/B: ajuste ou exclua o teste antes."
          : "A safra tem alocações: exclua as alocações antes de excluir a safra.",
      );
    if (error) falha("Falha ao excluir a safra", error);
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
    if (error) falha("Falha ao salvar os parâmetros", error);
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
    if (error) falha("Falha ao salvar as metas do ciclo", error);
    return { ok: true as const, metas: vazias ? METAS_CICLO_VAZIAS : data.metas };
  });

/* -------------------------------- Alocação -------------------------------- */

const ALOC_COLS =
  "id, safra_id, user_id, sector_id, subsector_id, dupla, meta_empresas, meta_contatos, motivo_meta_zero, vigente_desde";

export type HunterDoCiclo = { id: string; name: string };
export type SetorOpcao = {
  id: string;
  name: string;
  active: boolean;
  sort: number;
  parent_id: string | null;
};
export type AlocacaoDados = {
  /** Safras do ciclo, para escolher a semana. */
  safras: Safra[];
  /** Alocações de todas as safras do ciclo (a cópia usa a safra anterior). */
  alocacoes: Alocacao[];
  /** Membros do ciclo, em ordem alfabética. */
  hunters: HunterDoCiclo[];
  setores: SetorOpcao[];
  /** O "hoje" recebido (São Paulo), devolvido para a tela usar o mesmo dia das regras. */
  hoje: string;
};

// O "hoje" vem do navegador (fuso de São Paulo), como no resto da Dashboard, para servidor e tela
// concordarem sobre o que pode ser editado; só o admin chega a estas funções.

/** Dados da tabela de alocação de um ciclo. */
export const dashboardAlocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }): Promise<AlocacaoDados> => {
    await assertAdmin(context);
    const admin = await db();
    const [safras, membros, setores] = await Promise.all([
      admin.from("safras").select(SAFRA_COLS).eq("period_id", data.periodId).order("numero"),
      admin.from("period_members").select("user_id").eq("period_id", data.periodId),
      admin.from("sectors").select("id, name, active, sort, parent_id"),
    ]);
    const erro = safras.error ?? membros.error ?? setores.error;
    if (erro) falha("Falha ao carregar a alocação", erro);
    const ids = (safras.data ?? []).map((s) => s.id);
    // Mesma equipe dos Indicadores: membros do ciclo, sem os administradores.
    const { adminIds } = await import("./competition.server");
    const admins = await adminIds(admin);
    const userIds = [...new Set((membros.data ?? []).map((m) => m.user_id))].filter(
      (u) => !admins.has(u),
    );
    const [alocacoes, perfis] = await Promise.all([
      ids.length
        ? admin.from("alocacoes").select(ALOC_COLS).in("safra_id", ids)
        : Promise.resolve({ data: [] as Alocacao[], error: null }),
      userIds.length
        ? admin.from("profiles").select("id, display_name, email").in("id", userIds)
        : Promise.resolve({
            data: [] as { id: string; display_name: string | null; email: string | null }[],
            error: null,
          }),
    ]);
    if (alocacoes.error ?? perfis.error)
      falha("Falha ao carregar a alocação", alocacoes.error ?? perfis.error);
    return {
      safras: safras.data ?? [],
      alocacoes: alocacoes.data ?? [],
      hunters: (perfis.data ?? [])
        .map((p) => ({ id: p.id, name: p.display_name?.trim() || p.email || "Hunter" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      setores: setores.data ?? [],
      hoje: data.hoje,
    };
  });

async function safraEAlocacoes(admin: Awaited<ReturnType<typeof db>>, safraId: string) {
  const { data: safra, error } = await admin
    .from("safras")
    .select(SAFRA_COLS)
    .eq("id", safraId)
    .maybeSingle();
  if (error) falha("Falha ao carregar a safra", error);
  if (!safra) throw new Error("Safra não encontrada");
  const { data: alocacoes, error: e2 } = await admin
    .from("alocacoes")
    .select(ALOC_COLS)
    .eq("safra_id", safraId);
  if (e2) falha("Falha ao carregar a alocação", e2);
  return { safra, alocacoes: alocacoes ?? [] };
}

async function paiDosSubsetores(admin: Awaited<ReturnType<typeof db>>) {
  const { data, error } = await admin.from("sectors").select("id, parent_id");
  if (error) falha("Falha ao carregar os setores", error);
  return new Map((data ?? []).filter((s) => s.parent_id).map((s) => [s.id, s.parent_id as string]));
}

/** Mensagem do trigger do banco (P0001) ou a genérica. */
function erroDoBanco(error: { code?: string; message: string }, generica: string): Error {
  return new Error(error.code === "P0001" ? error.message : generica);
}

const alocacaoForm = z.object({
  user_id: z.string().uuid(),
  sector_id: z.string().uuid(),
  subsector_id: z.string().uuid().nullable(),
  dupla: z.string().max(40).nullable(),
  meta_empresas: z.number().int(),
  meta_contatos: z.number().int(),
  motivo_meta_zero: z.string().max(200).nullable(),
  vigente_desde: isoDay,
});

/**
 * Cria ou edita uma linha de alocação. Até o início da safra, tudo pode mudar. Durante a semana,
 * só a troca de setor: linha nova, a partir de hoje, com as metas e a dupla da linha atual.
 */
export const dashboardSalvarAlocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        safraId: z.string().uuid(),
        hoje: isoDay,
        /** Linha editada; sem id, cria. */
        id: z.string().uuid().nullable(),
        alocacao: alocacaoForm,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { safra, alocacoes } = await safraEAlocacoes(admin, data.safraId);
    const hoje = data.hoje;
    const modo = modoEdicao(safra, hoje);
    if (modo === "encerrada") throw new Error("Safra encerrada: a alocação não muda mais.");
    const f: AlocacaoForm = alocacaoLimpa(data.alocacao);

    if (modo === "troca_setor") {
      if (data.id) throw new Error("Safra em andamento: só é possível trocar o setor.");
      const erro = erroDuranteSafra(f, data.safraId, alocacoes, hoje);
      if (erro) throw new Error(erro);
    }

    const outras = alocacoes.filter((a) => a.id !== data.id);
    const erro = erroAlocacao(f, safra, outras, await paiDosSubsetores(admin));
    if (erro) throw new Error(erro);
    const { error } = data.id
      ? await admin.from("alocacoes").update(f).eq("id", data.id).eq("safra_id", data.safraId)
      : await admin
          .from("alocacoes")
          .insert({ ...f, safra_id: data.safraId, created_by: context.userId });
    if (error) throw erroDoBanco(error, "Falha ao salvar a alocação");
    return { ok: true as const };
  });

/** Exclui uma linha de alocação (só antes do início da safra). */
export const dashboardExcluirAlocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { data: linha, error: e1 } = await admin
      .from("alocacoes")
      .select("safra_id")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) falha("Falha ao carregar a alocação", e1);
    if (!linha) throw new Error("Alocação não encontrada");
    const { safra } = await safraEAlocacoes(admin, linha.safra_id);
    if (modoEdicao(safra, data.hoje) !== "livre")
      throw new Error("A safra já começou: a alocação não pode ser excluída.");
    const { error } = await admin.from("alocacoes").delete().eq("id", data.id);
    if (error) falha("Falha ao excluir a alocação", error);
    return { ok: true as const };
  });

/** Copia para a safra a alocação atual de cada hunter da safra anterior do ciclo. */
export const dashboardCopiarAlocacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ safraId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { safra } = await safraEAlocacoes(admin, data.safraId);
    if (!safra.usa_alocacao) throw new Error("Esta safra não usa alocação.");
    if (modoEdicao(safra, data.hoje) !== "livre")
      throw new Error("A safra já começou: copie antes do início dela.");
    const { data: doCiclo, error } = await admin
      .from("safras")
      .select(SAFRA_COLS)
      .eq("period_id", safra.period_id);
    if (error) falha("Falha ao carregar as safras", error);
    const anterior = safraAnterior(safra, doCiclo ?? []);
    if (!anterior) throw new Error("Esta é a primeira safra do ciclo.");
    const { data: alocacoes, error: e2 } = await admin
      .from("alocacoes")
      .select(ALOC_COLS)
      .in("safra_id", [anterior.id, safra.id]);
    if (e2) falha("Falha ao carregar a alocação", e2);
    const novas = copiarAlocacoes(alocacoes ?? [], anterior, safra);
    if (novas.length === 0) return { copiadas: 0 };
    const { error: e3 } = await admin
      .from("alocacoes")
      .insert(novas.map((f) => ({ ...f, safra_id: safra.id, created_by: context.userId })));
    if (e3) throw erroDoBanco(e3, "Falha ao copiar a alocação");
    return { copiadas: novas.length };
  });

/* --------------------------------- Hunters --------------------------------- */

/**
 * Base comum das abas Hunters e Visão geral: membros do ciclo (sem administradores), contatos (sem
 * os cards do Hackathon encerrado), ATs, alocação, metas e a cópia do Pipedrive.
 */
async function carregarBaseHunters(periodId: string, semana: string, hoje: string) {
  const admin = await db();
  const { fetchAll } = await import("./fetch-all");
  const { adminIds } = await import("./competition.server");
  const { hackathonPeriods, splitHackathon } = await import("./fila");
  const { H_CONTATO_COLUNAS } = await import("./dashHunters");
  const { weekStartISO } = await import("./empresas");
  type Linha = import("./dashHunters").HContato & { period_id: string | null };

  const [safras, parametros, membros, periodos, goals, settings, holidays, admins] =
    await Promise.all([
      admin.from("safras").select(SAFRA_COLS).eq("period_id", periodId),
      admin.from("dashboard_parametros").select("*").maybeSingle(),
      admin.from("period_members").select("user_id, group_id").eq("period_id", periodId),
      admin.from("periods").select("id, kind, status, closed_at, started_at"),
      admin
        .from("goals")
        .select(
          "user_id, group_id, envios_dia, l1_semana, ats_semana, no_prazo_pct, passos_semana",
        ),
      fetchAll((a, b) =>
        admin
          .from("settings")
          .select("user_id, offset1, offset2, offset3, offset4, offset5")
          .order("user_id")
          .range(a, b),
      ),
      admin.from("holidays").select("date"),
      adminIds(admin),
    ]);
  const erro = safras.error ?? parametros.error ?? membros.error ?? periodos.error ?? goals.error;
  if (erro) falha("Falha ao carregar os hunters", erro);

  const grupoDe = new Map(
    (membros.data ?? []).filter((m) => !admins.has(m.user_id)).map((m) => [m.user_id, m.group_id]),
  );
  const ids = [...grupoDe.keys()];
  const safraIds = (safras.data ?? []).map((s) => s.id);
  const [perfis, contatos, ats, alocacoes] = await Promise.all([
    ids.length
      ? admin.from("profiles").select("id, display_name, email").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? fetchAll(
          (a, b) =>
            admin
              .from("contacts")
              .select(`${H_CONTATO_COLUNAS}, period_id`)
              .in("user_id", ids)
              .order("id")
              .range(a, b) as unknown as import("./fetch-all").PageResult<Linha>,
        )
      : Promise.resolve([] as Linha[]),
    ids.length
      ? fetchAll((a, b) =>
          admin
            .from("ats")
            .select(
              "id, user_id, contact_id, registrada_em, agendada_original, agendada_atual, status, canal, resposta_etapa, pipedrive_stage_id, pipedrive_deal_id",
            )
            .eq("tipo", "diagnostico")
            .in("user_id", ids)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
    safraIds.length
      ? admin.from("alocacoes").select(ALOC_COLS).in("safra_id", safraIds)
      : Promise.resolve({ data: [] as Alocacao[], error: null }),
  ]);
  if (perfis.error ?? alocacoes.error)
    falha("Falha ao carregar os hunters", perfis.error ?? alocacoes.error);

  // Cópia do Pipedrive: histórico dos cards das ATs e tasks pelo login de cada hunter.
  const { loginDoUsuario } = await import("./ats");
  const deals = [...new Set(ats.map((a) => a.pipedrive_deal_id).filter((d) => d !== null))];
  const [time, cardsPd, etapasPd] = await Promise.all([
    admin.from("time_comercial").select("login, user_id"),
    deals.length
      ? fetchAll((a, b) =>
          admin
            .from("pd_cards")
            .select("deal_id, status, won_time")
            .in("deal_id", deals)
            .order("deal_id")
            .range(a, b),
        )
      : Promise.resolve([] as { deal_id: number; status: string; won_time: string | null }[]),
    deals.length
      ? fetchAll((a, b) =>
          admin
            .from("pd_card_etapas")
            .select("deal_id, stage_id, entrou_em")
            .in("deal_id", deals)
            .order("deal_id")
            .order("entrou_em")
            .range(a, b),
        )
      : Promise.resolve([] as { deal_id: number; stage_id: number; entrou_em: string }[]),
  ]);
  if (time.error) falha("Falha ao carregar o time comercial", time.error);
  const loginDe = new Map(
    (perfis.data ?? []).map((x) => [x.id, loginDoUsuario(x.id, x.email, time.data ?? [])]),
  );
  const logins = [...new Set([...loginDe.values()].filter((l): l is string => !!l))];
  const tasksPd = logins.length
    ? await fetchAll((a, b) =>
        admin
          .from("pd_tasks")
          .select("hunter_login, due_date, done, marked_as_done_time")
          .in("hunter_login", logins)
          .order("activity_id")
          .range(a, b),
      )
    : [];
  const cards: Record<number, { status: string; etapas: number[] }> = {};
  for (const c of cardsPd) cards[c.deal_id] = { status: c.status, etapas: [] };
  for (const e of etapasPd) cards[e.deal_id]?.etapas.push(e.stage_id);
  // Mesma cópia com as datas, para a Visão geral (data do avanço).
  const cardsComDatas: Record<
    number,
    { status: string; won_time: string | null; etapas: { stage_id: number; entrou_em: string }[] }
  > = {};
  for (const c of cardsPd)
    cardsComDatas[c.deal_id] = { status: c.status, won_time: c.won_time, etapas: [] };
  for (const e of etapasPd)
    cardsComDatas[e.deal_id]?.etapas.push({ stage_id: e.stage_id, entrou_em: e.entrou_em });

  // Cards do Hackathon encerrado ficam fora, como nos Indicadores.
  const atuais = splitHackathon(contatos, hackathonPeriods(periodos.data ?? [])).current;
  const p = parametros.data ?? PARAMETROS_PADRAO;
  const entrada: import("./dashHunters").HuntersInput = {
    hoje: hoje,
    semana: weekStartISO(semana),
    safras: safras.data ?? [],
    maturacaoSemanas: p.maturacao_semanas,
    diasContatoParado: p.dias_contato_parado,
    esforcoAlertaPct: p.esforco_alerta_pct,
    alocacoes: alocacoes.data ?? [],
    hunters: (perfis.data ?? [])
      .map((x) => ({
        id: x.id,
        name: x.display_name?.trim() || x.email || "Hunter",
        groupId: grupoDe.get(x.id) ?? null,
        login: loginDe.get(x.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    contatos: atuais,
    ats,
    goals: goals.data ?? [],
    offsets: Object.fromEntries(settings.map(({ user_id, ...o }) => [user_id, o])),
    holidays: new Set((holidays.data ?? []).map((h) => h.date)),
    cards,
    // Sem nenhuma task copiada (cópia ainda não rodou), a coluna fica de fora.
    ...(tasksPd.length ? { tasks: tasksPd } : {}),
  };
  return {
    entrada,
    parametros: p,
    safras: (safras.data ?? []).sort((a, b) => a.numero - b.numero),
    ats,
    cardsComDatas,
    inicioCiclo: (periodos.data ?? []).find((x) => x.id === periodId)?.started_at ?? null,
  };
}

/**
 * Aba Hunters: filas, disciplina e resultado de cada membro do ciclo na semana escolhida
 * (cálculo em `computeHunters`, dashHunters.ts). O "hoje" vem do navegador (fuso de São Paulo).
 */
export const dashboardHunters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ periodId: z.string().uuid(), semana: isoDay, hoje: isoDay }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { computeHunters, esforcoDasSemanas } = await import("./dashHunters");
    const {
      entrada,
      parametros: p,
      safras,
    } = await carregarBaseHunters(data.periodId, data.semana, data.hoje);
    const resultado = computeHunters(entrada);
    return {
      ...resultado,
      safras,
      maturacaoSemanas: p.maturacao_semanas,
      esforcoAlertaPct: p.esforco_alerta_pct,
      concentracaoAtsPct: p.concentracao_ats_pct,
      esforcoSemanas: esforcoDasSemanas(entrada),
    };
  });

/* ------------------------------- Conciliação ------------------------------- */

/**
 * Fila de conciliação do ciclo (cálculo em `computeConciliacao`), a partir do início dele, com os
 * nomes dos hunters e a última cópia dos cards.
 */
export const dashboardConciliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { fetchAll } = await import("./fetch-all");
    const { computeConciliacao } = await import("./conciliacao");
    const { diaSP } = await import("./safras");

    const [periodo, safras, membros, ats, cards, ultima] = await Promise.all([
      admin.from("periods").select("started_at").eq("id", data.periodId).maybeSingle(),
      admin.from("safras").select(SAFRA_COLS).eq("period_id", data.periodId),
      admin.from("period_members").select("user_id").eq("period_id", data.periodId),
      fetchAll((a, b) =>
        admin
          .from("ats")
          .select(
            "id, user_id, hunter_login, contact_id, pipedrive_deal_id, empresa, prospect, registrada_em, status",
          )
          .eq("tipo", "diagnostico")
          .order("id")
          .range(a, b),
      ),
      fetchAll((a, b) =>
        admin
          .from("pd_cards")
          .select("deal_id, titulo, hunter_login, stage_id, status, add_time, cargo")
          .eq("outbound", true)
          .order("deal_id")
          .range(a, b),
      ),
      admin
        .from("pd_cards")
        .select("sincronizado_em")
        .order("sincronizado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const erro = periodo.error ?? safras.error ?? membros.error ?? ultima.error;
    if (erro) falha("Falha ao carregar a conciliação", erro);
    if (!periodo.data) throw new Error("Ciclo não encontrado");
    const ids = [...new Set((membros.data ?? []).map((m) => m.user_id))];
    const safraIds = (safras.data ?? []).map((s) => s.id);
    const [contatos, alocacoes, perfis] = await Promise.all([
      ids.length
        ? fetchAll((a, b) =>
            admin
              .from("contacts")
              .select("id, name, company, user_id, created_at")
              .in("user_id", ids)
              .order("id")
              .range(a, b),
          )
        : Promise.resolve([]),
      safraIds.length
        ? admin.from("alocacoes").select("safra_id, user_id").in("safra_id", safraIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("profiles").select("id, display_name, email"),
    ]);
    if (alocacoes.error ?? perfis.error)
      falha("Falha ao carregar a conciliação", alocacoes.error ?? perfis.error);

    const desde = diaSP(periodo.data.started_at);
    return {
      desde,
      ultimaCopia: ultima.data?.sincronizado_em ?? null,
      nomes: Object.fromEntries(
        (perfis.data ?? []).map((p) => [p.id, p.display_name?.trim() || p.email || "Hunter"]),
      ) as Record<string, string>,
      ...computeConciliacao({
        desde,
        ats,
        cards,
        contatos,
        safras: safras.data ?? [],
        alocacoes: alocacoes.data ?? [],
      }),
    };
  });

/** Liga a AT a um contato do mesmo hunter (ela passa para a safra do contato). */
export const dashboardLigarAtContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ atId: z.string().uuid(), contactId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const [at, contato] = await Promise.all([
      admin.from("ats").select("user_id").eq("id", data.atId).maybeSingle(),
      admin.from("contacts").select("user_id").eq("id", data.contactId).maybeSingle(),
    ]);
    if (at.error ?? contato.error)
      falha("Falha ao carregar a AT ou o contato", at.error ?? contato.error);
    if (!at.data || !contato.data) throw new Error("AT ou contato não encontrado");
    if (at.data.user_id && at.data.user_id !== contato.data.user_id)
      throw new Error("O contato é de outro hunter");
    const { error } = await admin
      .from("ats")
      .update({ contact_id: data.contactId })
      .eq("id", data.atId);
    if (error) falha("Falha ao ligar a AT ao contato", error);
    return { ok: true as const };
  });

/**
 * Liga a AT a um card do Pipedrive: a partir daí o status vem do Pipedrive. Sincroniza a AT e a
 * cópia do card na hora.
 */
export const dashboardLigarAtCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ atId: z.string().uuid(), dealId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { data: outra, error: e1 } = await admin
      .from("ats")
      .select("id")
      .eq("pipedrive_deal_id", data.dealId)
      .maybeSingle();
    if (e1) falha("Falha ao conferir o card", e1);
    if (outra && outra.id !== data.atId) throw new Error("Este card já está ligado a outra AT");
    const { error } = await admin
      .from("ats")
      .update({ pipedrive_deal_id: data.dealId })
      .eq("id", data.atId)
      .is("pipedrive_deal_id", null);
    if (error) falha("Falha ao ligar a AT ao card", error);
    const pdServer = await import("./pipedrive.server");
    let aviso: string | null = null;
    try {
      await pdServer.sincronizarDeal(data.dealId);
      await pdServer.sincronizarCards({ dealIds: [data.dealId] });
    } catch (e) {
      aviso = `Ligada, mas o Pipedrive não respondeu: ${(e as Error).message}`;
    }
    return { ok: true as const, aviso };
  });

/** "Sincronizar agora": copia os cards que mudaram, um lote por chamada. */
export const dashboardSincronizarCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { sincronizarCards } = await import("./pipedrive.server");
    return sincronizarCards({ limite: 40 });
  });

/* ------------------------------- Visão geral ------------------------------- */

/**
 * Visão geral (Módulo 1): cartão central, fatores, ritmo semanal, funil do ciclo, semáforo de
 * esforço e alertas (cálculos em dashRitmo.ts e dashAlertas.ts).
 */
export const dashboardVisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { computeHunters, esforcoDasSemanas } = await import("./dashHunters");
    const { computeVisao } = await import("./dashRitmo");
    const { computeAlertas } = await import("./dashAlertas");
    const { atsSemCard } = await import("./conciliacao");
    const { resolveGoal } = await import("./dashboard");
    const { semanaPadrao, diaSP } = await import("./safras");
    const { weekStartISO } = await import("./empresas");

    const { data: safrasCiclo, error } = await admin
      .from("safras")
      .select("inicio")
      .eq("period_id", data.periodId);
    if (error) falha("Falha ao carregar as safras", error);
    const semana = semanaPadrao(safrasCiclo ?? [], data.hoje) ?? weekStartISO(data.hoje);
    const [base, metas] = await Promise.all([
      carregarBaseHunters(data.periodId, semana, data.hoje),
      admin
        .from("ciclo_metas")
        .select("ats_avancaram")
        .eq("period_id", data.periodId)
        .maybeSingle(),
    ]);
    if (metas.error) falha("Falha ao carregar as metas do ciclo", metas.error);
    const { entrada, parametros: p } = base;

    const hunters = computeHunters(entrada);
    const esforcoSemanas = esforcoDasSemanas(entrada);
    // Meta semanal de ATs da equipe: soma das metas dos hunters (herança equipe → grupo → hunter).
    const metasHunters = entrada.hunters.map(
      (h) => resolveGoal(entrada.goals, h.id, h.groupId).ats_semana,
    );
    const metaSemanalAts = metasHunters.some((m) => m !== null)
      ? Math.round(metasHunters.reduce<number>((t, m) => t + (m ?? 0), 0) * 10) / 10
      : null;

    const visao = computeVisao({
      hoje: data.hoje,
      safras: base.safras,
      maturacaoSemanas: p.maturacao_semanas,
      contatos: entrada.contatos,
      ats: base.ats,
      cards: base.cardsComDatas,
      metaAvancaram: metas.data?.ats_avancaram ?? null,
      metaSemanalAts,
    });
    const alertas = computeAlertas({
      hoje: data.hoje,
      parametros: p,
      hunters: hunters.hunters.map((h) => ({
        id: h.id,
        nome: h.nome,
        parados: h.cadencia.parados.length,
      })),
      esforcoSemanas,
      participacao: hunters.participacao,
      ritmo: visao.ritmo,
      metaSemanalAts,
      fatores: visao.fatores,
      ats: base.ats,
      atsSemCard: base.inicioCiclo ? atsSemCard(base.ats, diaSP(base.inicioCiclo)) : 0,
    });
    return {
      visao,
      alertas,
      safras: base.safras,
      maturacaoSemanas: p.maturacao_semanas,
      esforcoAlertaPct: p.esforco_alerta_pct,
      semaforo: hunters.hunters
        .filter((h) => h.disciplina.esforco?.abaixo)
        .map((h) => ({ id: h.id, nome: h.nome, esforco: h.disciplina.esforco! })),
    };
  });

/**
 * Aba Realização e avanço: situação das ATs por semana, horário × dia de no-show e remarcação,
 * antecedência, funis por setor alocado, perdas e tempo por etapa (cálculo em
 * `computeRealizacao`, dashRealizacao.ts). Mesmos membros e contatos da aba Hunters.
 */
export const dashboardRealizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { fetchAll } = await import("./fetch-all");
    const { computeRealizacao } = await import("./dashRealizacao");
    const { semanaPadrao } = await import("./safras");
    const { weekStartISO } = await import("./empresas");

    const { data: safrasCiclo, error } = await admin
      .from("safras")
      .select("inicio")
      .eq("period_id", data.periodId);
    if (error) falha("Falha ao carregar as safras", error);
    const semana = semanaPadrao(safrasCiclo ?? [], data.hoje) ?? weekStartISO(data.hoje);
    const base = await carregarBaseHunters(data.periodId, semana, data.hoje);
    const { entrada, parametros: p } = base;

    const atIds = new Set(base.ats.map((a) => a.id));
    const deals = [
      ...new Set(base.ats.map((a) => a.pipedrive_deal_id).filter((d): d is number => d !== null)),
    ];
    const [eventos, cardsPd, etapasPd, setores, tempos] = await Promise.all([
      // O log é pequeno: busca tudo e filtra aqui (uma lista de ids estouraria a URL).
      fetchAll((a, b) =>
        admin
          .from("at_eventos")
          .select("at_id, evento, ocorrido_em, horario_anterior, horario_novo")
          .neq("evento", "etapa_pipedrive")
          .order("id")
          .range(a, b),
      ),
      deals.length
        ? fetchAll((a, b) =>
            admin
              .from("pd_cards")
              .select("deal_id, status, stage_id, lost_reason, won_time")
              .in("deal_id", deals)
              .order("deal_id")
              .range(a, b),
          )
        : Promise.resolve([]),
      deals.length
        ? fetchAll((a, b) =>
            admin
              .from("pd_card_etapas")
              .select("deal_id, stage_id, entrou_em, saiu_em")
              .in("deal_id", deals)
              .order("deal_id")
              .order("entrou_em")
              .range(a, b),
          )
        : Promise.resolve([]),
      admin.from("sectors").select("id, name"),
      admin.from("dashboard_tempo_etapas").select("stage_id, meta_dias"),
    ]);
    if (setores.error ?? tempos.error)
      falha("Falha ao carregar a realização", setores.error ?? tempos.error);

    const cards: Record<number, import("./dashRealizacao").RCard> = {};
    const etapasDe = new Map<
      number,
      { stage_id: number; entrou_em: string; saiu_em: string | null }[]
    >();
    for (const e of etapasPd) {
      const l = etapasDe.get(e.deal_id) ?? [];
      l.push({ stage_id: e.stage_id, entrou_em: e.entrou_em, saiu_em: e.saiu_em });
      etapasDe.set(e.deal_id, l);
    }
    for (const c of cardsPd)
      cards[c.deal_id] = {
        status: c.status,
        stage_id: c.stage_id,
        lost_reason: c.lost_reason,
        won_time: c.won_time,
        etapas: etapasDe.get(c.deal_id) ?? [],
      };
    const metasTempo = Object.fromEntries(
      (tempos.data ?? []).map((t) => [t.stage_id, t.meta_dias]),
    ) as Record<number, number>;

    const realizacao = computeRealizacao({
      hoje: data.hoje,
      safras: base.safras,
      maturacaoSemanas: p.maturacao_semanas,
      contatos: entrada.contatos,
      ats: base.ats,
      eventos: eventos.filter((e) => atIds.has(e.at_id)),
      cards,
      alocacoes: entrada.alocacoes,
      setores: Object.fromEntries((setores.data ?? []).map((s) => [s.id, s.name])),
      metasTempo,
    });
    return { realizacao, metasTempo, safras: base.safras, maturacaoSemanas: p.maturacao_semanas };
  });

/** Grava a meta de dias corridos de cada etapa do funil (tempo por etapa × meta). */
export const dashboardSalvarTempoEtapas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        metas: z.array(z.object({ stage_id: z.number().int(), meta_dias: inteiro })).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { erroMetasTempo, ETAPAS_FUNIL } = await import("./dashRealizacao");
    if (data.metas.some((m) => !(ETAPAS_FUNIL as readonly number[]).includes(m.stage_id)))
      throw new Error("Etapa fora do funil do outbound");
    const erro = erroMetasTempo(
      Object.fromEntries(data.metas.map((m) => [m.stage_id, m.meta_dias])),
    );
    if (erro) throw new Error(erro);
    const admin = await db();
    const { error } = await admin.from("dashboard_tempo_etapas").upsert(data.metas);
    if (error) falha("Falha ao salvar as metas de tempo", error);
    return { ok: true as const };
  });

const DIMENSAO = z.enum(["setor", "subsetor", "porte", "nivel", "area", "persona"]);

/**
 * Base dos segmentos e do resultado: a base da aba Hunters (ciclo padrão da semana de hoje) e, dos
 * contatos dos membros, cargo, headline, área e persona; as empresas deles e os setores.
 */
async function carregarBaseSegmentos(periodId: string, hoje: string) {
  const admin = await db();
  const { fetchAll } = await import("./fetch-all");
  const { semanaPadrao } = await import("./safras");
  const { weekStartISO } = await import("./empresas");
  const { isPersona } = await import("./personas");
  const { data: safrasCiclo, error } = await admin
    .from("safras")
    .select("inicio")
    .eq("period_id", periodId);
  if (error) falha("Falha ao carregar as safras", error);
  const semana = semanaPadrao(safrasCiclo ?? [], hoje) ?? weekStartISO(hoje);
  const base = await carregarBaseHunters(periodId, semana, hoje);
  const ids = base.entrada.hunters.map((h) => h.id);
  const [extras, empresas, setores] = await Promise.all([
    ids.length
      ? fetchAll((a, b) =>
          admin
            .from("contacts")
            .select("id, job_title, headline, sector, persona")
            .in("user_id", ids)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
    ids.length
      ? fetchAll((a, b) =>
          admin
            .from("companies")
            .select("id, sector_id, subsector_id, porte")
            .in("user_id", ids)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
    admin.from("sectors").select("id, name, parent_id, active").order("name"),
  ]);
  if (setores.error) falha("Falha ao carregar os setores", setores.error);
  const extraDe = new Map(extras.map((x) => [x.id, x]));
  const contatos: import("./dashSegmentos").SContato[] = base.entrada.contatos.map((c) => {
    const x = extraDe.get(c.id);
    return {
      id: c.id,
      user_id: c.user_id,
      created_at: c.created_at,
      company_id: c.company_id,
      job_title: x?.job_title ?? "",
      headline: x?.headline ?? "",
      sector: x?.sector ?? null,
      persona: x && isPersona(x.persona) ? x.persona : null,
    };
  });
  return {
    base,
    contatos,
    empresas: Object.fromEntries(
      empresas.map((e) => [
        e.id,
        { sector_id: e.sector_id, subsector_id: e.subsector_id, porte: e.porte },
      ]),
    ),
    setores: (setores.data ?? []).map((s) => ({ id: s.id, name: s.name, parent_id: s.parent_id })),
    nomes: Object.fromEntries((setores.data ?? []).map((s) => [s.id, s.name])),
  };
}

/**
 * Aba Segmentos: quebras por setor, porte, persona, nível e área nas safras maduras, empresas,
 * canais, mensagens, safra × setor alocado e o resultado dos testes A/B do ciclo (cálculo em
 * `computeSegmentos`/`resultadoAb`). Mesmos membros e contatos da aba Hunters.
 */
export const dashboardSegmentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { computeSegmentos } = await import("./dashSegmentos");
    const { resultadoAb } = await import("./abTestes");
    const [carga, testes] = await Promise.all([
      carregarBaseSegmentos(data.periodId, data.hoje),
      admin
        .from("ab_testes")
        .select(
          "id, nome, dimensao, descricao, safra_inicial_id, safra_final_id, status, conclusao, created_at",
        )
        .eq("period_id", data.periodId)
        .order("created_at"),
    ]);
    if (testes.error) falha("Falha ao carregar os testes A/B", testes.error);
    const { base, contatos, empresas: mapaEmpresas, nomes } = carga;
    const { entrada, parametros: p } = base;
    const testeIds = (testes.data ?? []).map((t) => t.id);
    const versoesAb = testeIds.length
      ? await admin
          .from("ab_versoes")
          .select("teste_id, rotulo, valores, ordem")
          .in("teste_id", testeIds)
      : { data: [], error: null };
    if (versoesAb.error) falha("Falha ao carregar os testes A/B", versoesAb.error);

    const ctx = {
      hoje: data.hoje,
      safras: base.safras,
      maturacaoSemanas: p.maturacao_semanas,
      contatos,
      empresas: mapaEmpresas,
      ats: base.ats,
      cards: base.cardsComDatas,
    };
    const segmentos = computeSegmentos({
      ...ctx,
      minAtsSegmento: p.min_ats_segmento,
      avancoFicaPct: p.avanco_fica_pct,
      avancoTrocaPct: p.avanco_troca_pct,
      setores: nomes,
      alocacoes: entrada.alocacoes,
    });
    const listaTestes = (testes.data ?? []).map((t) => ({
      id: t.id,
      nome: t.nome,
      dimensao: DIMENSAO.parse(t.dimensao),
      descricao: t.descricao,
      safra_inicial_id: t.safra_inicial_id,
      safra_final_id: t.safra_final_id,
      status: t.status === "encerrado" ? ("encerrado" as const) : ("ativo" as const),
      conclusao: t.conclusao,
      versoes: (versoesAb.data ?? [])
        .filter((v) => v.teste_id === t.id)
        .sort((a, b) => a.ordem - b.ordem)
        .map((v) => ({ rotulo: v.rotulo, valores: v.valores })),
    }));
    return {
      segmentos,
      testes: listaTestes.map((t) => ({
        teste: t,
        resultado: resultadoAb(t, { ...ctx, amostraMinima: p.amostra_minima_ab }),
      })),
      safras: base.safras,
      setores: carga.setores,
      parametros: {
        maturacaoSemanas: p.maturacao_semanas,
        minAtsSegmento: p.min_ats_segmento,
        avancoFicaPct: p.avanco_fica_pct,
        avancoTrocaPct: p.avanco_troca_pct,
        amostraMinimaAb: p.amostra_minima_ab,
      },
    };
  });

const AB_FORM = z.object({
  nome: z.string().max(120),
  dimensao: DIMENSAO,
  descricao: z.string().max(2000),
  safra_inicial_id: z.string().uuid(),
  safra_final_id: z.string().uuid(),
  versoes: z
    .array(
      z.object({
        rotulo: z.string().max(40),
        valores: z.array(z.string().min(1).max(120)).max(100),
      }),
    )
    .max(6),
});

/** Cria ou edita um teste A/B do ciclo; as versões são regravadas inteiras. */
export const dashboardSalvarTesteAb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ periodId: z.string().uuid(), id: z.string().uuid().nullable(), teste: AB_FORM })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { erroTesteAb } = await import("./abTestes");
    const { data: safras, error } = await admin
      .from("safras")
      .select("id, numero")
      .eq("period_id", data.periodId);
    if (error) falha("Falha ao carregar as safras", error);
    const erro = erroTesteAb(data.teste, safras ?? []);
    if (erro) throw new Error(erro);
    const { versoes, ...campos } = data.teste;
    const linha = {
      ...campos,
      nome: campos.nome.trim(),
      descricao: campos.descricao.trim() || null,
      period_id: data.periodId,
    };
    let id = data.id;
    if (id) {
      const { data: existe, error: eBusca } = await admin
        .from("ab_testes")
        .select("id")
        .eq("id", id)
        .eq("period_id", data.periodId)
        .maybeSingle();
      if (eBusca || !existe) throw new Error("Teste não encontrado neste ciclo");
      const { error: e } = await admin.from("ab_testes").update(linha).eq("id", id);
      if (e) falha("Falha ao salvar o teste", e);
      const { error: eDel } = await admin.from("ab_versoes").delete().eq("teste_id", id);
      if (eDel) falha("Falha ao salvar as versões", eDel);
    } else {
      // Id gerado aqui: as versões precisam dele e assim não dependemos do retorno da inserção.
      id = crypto.randomUUID();
      const { error: e } = await admin.from("ab_testes").insert({ ...linha, id });
      if (e) falha("Falha ao criar o teste", e);
    }
    const { error: eVer } = await admin.from("ab_versoes").insert(
      versoes.map((v, ordem) => ({
        teste_id: id!,
        rotulo: v.rotulo.trim(),
        valores: [...new Set(v.valores)],
        ordem,
      })),
    );
    if (eVer) falha("Falha ao salvar as versões", eVer);
    return { id: id! };
  });

/** Encerra (com a decisão registrada) ou reabre um teste A/B. */
export const dashboardEncerrarTesteAb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        encerrar: z.boolean(),
        conclusao: z.string().max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { error } = await admin
      .from("ab_testes")
      .update(
        data.encerrar
          ? { status: "encerrado", conclusao: data.conclusao.trim() || null }
          : { status: "ativo", conclusao: null },
      )
      .eq("id", data.id);
    if (error) falha("Falha ao atualizar o teste", error);
    return { ok: true as const };
  });

/** Exclui um teste A/B (as versões vão junto). */
export const dashboardExcluirTesteAb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { error } = await admin.from("ab_testes").delete().eq("id", data.id);
    if (error) falha("Falha ao excluir o teste", error);
    return { ok: true as const };
  });

/**
 * Aba Resultado e ciclos: pipeline, conversão até a venda, valor por AT por porte e setor, higiene
 * dos dados (ciclo escolhido) e os indicadores de cada ciclo da plataforma (`computeResultado` e
 * `computeCiclos`, dashResultado.ts).
 */
export const dashboardResultado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { fetchAll } = await import("./fetch-all");
    const { adminIds } = await import("./competition.server");
    const { computeResultado, computeCiclos } = await import("./dashResultado");
    type Card = import("./dashResultado").ZCard;

    const [carga, periodos, membros, admins] = await Promise.all([
      carregarBaseSegmentos(data.periodId, data.hoje),
      admin
        .from("periods")
        .select("id, name, kind, status, started_at, closed_at")
        .eq("kind", "ciclo"),
      admin.from("period_members").select("period_id, user_id"),
      adminIds(admin),
    ]);
    if (periodos.error ?? membros.error)
      falha("Falha ao carregar os ciclos", periodos.error ?? membros.error);
    const { base, contatos, empresas, nomes } = carga;
    const ciclos = (periodos.data ?? []).map((c) => ({
      id: c.id,
      nome: c.name,
      inicio: c.started_at.slice(0, 10),
      fim: c.closed_at ? c.closed_at.slice(0, 10) : null,
      ativo: c.status === "active",
      membros: (membros.data ?? [])
        .filter((m) => m.period_id === c.id && !admins.has(m.user_id))
        .map((m) => m.user_id),
    }));
    const todosMembros = [...new Set(ciclos.flatMap((c) => c.membros))];

    // ATs e contatos de todos os ciclos (só os membros), para a comparação entre ciclos.
    const [atsTodos, contatosTodos] = await Promise.all([
      todosMembros.length
        ? fetchAll((a, b) =>
            admin
              .from("ats")
              .select(
                "id, user_id, contact_id, registrada_em, agendada_atual, status, resposta_etapa, pipedrive_stage_id, pipedrive_deal_id",
              )
              .eq("tipo", "diagnostico")
              .in("user_id", todosMembros)
              .order("id")
              .range(a, b),
          )
        : Promise.resolve([]),
      todosMembros.length
        ? fetchAll((a, b) =>
            admin
              .from("contacts")
              .select("id, user_id, created_at")
              .in("user_id", todosMembros)
              .order("id")
              .range(a, b),
          )
        : Promise.resolve([]),
    ]);

    // Cópia do Pipedrive dos cards das ATs (ciclo escolhido e todos os ciclos).
    const deals = [
      ...new Set(
        [...base.ats, ...atsTodos]
          .map((a) => a.pipedrive_deal_id)
          .filter((d): d is number => d !== null),
      ),
    ];
    const [cardsPd, etapasPd] = deals.length
      ? await Promise.all([
          fetchAll((a, b) =>
            admin
              .from("pd_cards")
              .select("deal_id, status, stage_id, valor, porte, won_time")
              .in("deal_id", deals)
              .order("deal_id")
              .range(a, b),
          ),
          fetchAll((a, b) =>
            admin
              .from("pd_card_etapas")
              .select("deal_id, stage_id, entrou_em")
              .in("deal_id", deals)
              .order("deal_id")
              .order("entrou_em")
              .range(a, b),
          ),
        ])
      : [[], []];
    const etapasDe = new Map<number, { stage_id: number; entrou_em: string }[]>();
    for (const e of etapasPd)
      etapasDe.set(e.deal_id, [
        ...(etapasDe.get(e.deal_id) ?? []),
        { stage_id: e.stage_id, entrou_em: e.entrou_em },
      ]);
    const cards: Record<number, Card> = Object.fromEntries(
      cardsPd.map((c) => [
        c.deal_id,
        {
          status: c.status,
          stage_id: c.stage_id,
          valor: c.valor === null ? null : Number(c.valor),
          porte: c.porte,
          won_time: c.won_time,
          etapas: etapasDe.get(c.deal_id) ?? [],
        },
      ]),
    );

    return {
      resultado: computeResultado({
        hoje: data.hoje,
        safras: base.safras,
        minAtsSegmento: base.parametros.min_ats_segmento,
        contatos,
        empresas,
        setores: nomes,
        ats: base.ats,
        cards,
      }),
      ciclos: computeCiclos({
        hoje: data.hoje,
        ciclos,
        contatos: contatosTodos,
        ats: atsTodos,
        cards,
      }),
      safras: base.safras,
      minAtsSegmento: base.parametros.min_ats_segmento,
    };
  });

/**
 * Aba Semanas: curvas de safra, mapa safra × semana e dias do cadastro à primeira AT, com a
 * maturação sugerida pelo P90 (`computeCurvas`, dashResultado.ts).
 */
export const dashboardCurvas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodId: z.string().uuid(), hoje: isoDay }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await db();
    const { computeCurvas } = await import("./dashResultado");
    const { semanaPadrao } = await import("./safras");
    const { weekStartISO } = await import("./empresas");
    const { data: safrasCiclo, error } = await admin
      .from("safras")
      .select("inicio")
      .eq("period_id", data.periodId);
    if (error) falha("Falha ao carregar as safras", error);
    const semana = semanaPadrao(safrasCiclo ?? [], data.hoje) ?? weekStartISO(data.hoje);
    const base = await carregarBaseHunters(data.periodId, semana, data.hoje);
    return {
      curvas: computeCurvas({
        hoje: data.hoje,
        safras: base.safras,
        contatos: base.entrada.contatos,
        ats: base.ats,
      }),
      maturacaoAtual: base.parametros.maturacao_semanas,
    };
  });
