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
  mesmaAlocacao,
  modoEdicao,
  trocaDeSetor,
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
    if (error?.code === "23503")
      throw new Error("A safra tem alocações: exclua as alocações antes de excluir a safra.");
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
    if (erro) throw new Error("Falha ao carregar a alocação");
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
    if (alocacoes.error ?? perfis.error) throw new Error("Falha ao carregar a alocação");
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
  if (error) throw new Error("Falha ao carregar a safra");
  if (!safra) throw new Error("Safra não encontrada");
  const { data: alocacoes, error: e2 } = await admin
    .from("alocacoes")
    .select(ALOC_COLS)
    .eq("safra_id", safraId);
  if (e2) throw new Error("Falha ao carregar a alocação");
  return { safra, alocacoes: alocacoes ?? [] };
}

async function paiDosSubsetores(admin: Awaited<ReturnType<typeof db>>) {
  const { data, error } = await admin.from("sectors").select("id, parent_id");
  if (error) throw new Error("Falha ao carregar os setores");
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
      const atual = alocacoes
        .filter((a) => a.user_id === f.user_id)
        .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
        .at(-1);
      if (!atual) throw new Error("Safra em andamento: não dá para alocar um hunter novo.");
      if (f.vigente_desde < hoje) throw new Error("A troca de setor vale a partir de hoje.");
      const esperado = trocaDeSetor(atual, f, f.vigente_desde);
      if (!esperado) throw new Error("O setor é o mesmo da alocação atual.");
      if (!mesmaAlocacao(esperado, f))
        throw new Error("Safra em andamento: só o setor muda; metas e dupla ficam como estão.");
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
    if (e1) throw new Error("Falha ao carregar a alocação");
    if (!linha) throw new Error("Alocação não encontrada");
    const { safra } = await safraEAlocacoes(admin, linha.safra_id);
    if (modoEdicao(safra, data.hoje) !== "livre")
      throw new Error("A safra já começou: a alocação não pode ser excluída.");
    const { error } = await admin.from("alocacoes").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir a alocação");
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
    if (error) throw new Error("Falha ao carregar as safras");
    const anterior = safraAnterior(safra, doCiclo ?? []);
    if (!anterior) throw new Error("Esta é a primeira safra do ciclo.");
    const { data: alocacoes, error: e2 } = await admin
      .from("alocacoes")
      .select(ALOC_COLS)
      .in("safra_id", [anterior.id, safra.id]);
    if (e2) throw new Error("Falha ao carregar a alocação");
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
    const admin = await db();
    const { fetchAll } = await import("./fetch-all");
    const { adminIds } = await import("./competition.server");
    const { hackathonPeriods, splitHackathon } = await import("./fila");
    const { computeHunters, esforcoDasSemanas, H_CONTATO_COLUNAS } = await import("./dashHunters");
    const { weekStartISO } = await import("./empresas");
    type Linha = import("./dashHunters").HContato & { period_id: string | null };

    const [safras, parametros, membros, periodos, goals, settings, holidays, admins] =
      await Promise.all([
        admin.from("safras").select(SAFRA_COLS).eq("period_id", data.periodId),
        admin.from("dashboard_parametros").select("*").maybeSingle(),
        admin.from("period_members").select("user_id, group_id").eq("period_id", data.periodId),
        admin.from("periods").select("id, kind, status, closed_at"),
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
    if (erro) throw new Error("Falha ao carregar os hunters");

    const grupoDe = new Map(
      (membros.data ?? [])
        .filter((m) => !admins.has(m.user_id))
        .map((m) => [m.user_id, m.group_id]),
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
              .select("id, user_id, contact_id, registrada_em, status, pipedrive_stage_id")
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
    if (perfis.error ?? alocacoes.error) throw new Error("Falha ao carregar os hunters");

    // Cards do Hackathon encerrado ficam fora, como nos Indicadores.
    const atuais = splitHackathon(contatos, hackathonPeriods(periodos.data ?? [])).current;
    const p = parametros.data ?? PARAMETROS_PADRAO;
    const entrada: import("./dashHunters").HuntersInput = {
      hoje: data.hoje,
      semana: weekStartISO(data.semana),
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
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      contatos: atuais,
      ats,
      goals: goals.data ?? [],
      offsets: Object.fromEntries(settings.map(({ user_id, ...o }) => [user_id, o])),
      holidays: new Set((holidays.data ?? []).map((h) => h.date)),
    };
    const resultado = computeHunters(entrada);
    return {
      ...resultado,
      safras: (safras.data ?? []).sort((a, b) => a.numero - b.numero),
      maturacaoSemanas: p.maturacao_semanas,
      esforcoAlertaPct: p.esforco_alerta_pct,
      concentracaoAtsPct: p.concentracao_ats_pct,
      esforcoSemanas: esforcoDasSemanas(entrada),
    };
  });
