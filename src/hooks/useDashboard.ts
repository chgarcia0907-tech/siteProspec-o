// Dados da Dashboard de Outbound (server functions que validam has_role).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  dashboardAlocacao,
  dashboardConciliacao,
  dashboardLigarAtCard,
  dashboardLigarAtContato,
  dashboardSincronizarCards,
  dashboardVisao,
  dashboardRealizacao,
  dashboardSalvarTempoEtapas,
  dashboardSegmentos,
  dashboardResultado,
  dashboardCurvas,
  dashboardSalvarTesteAb,
  dashboardEncerrarTesteAb,
  dashboardExcluirTesteAb,
  dashboardCopiarAlocacoes,
  dashboardCriarSafra,
  dashboardExcluirAlocacao,
  dashboardSalvarAlocacao,
  dashboardEditarSafra,
  dashboardExcluirSafra,
  dashboardGerarSafras,
  dashboardHunters,
  dashboardSalvarMetasCiclo,
  dashboardSalvarParametros,
  dashboardSemanas,
} from "@/lib/dashboard.functions";
import type { AbForm } from "@/lib/abTestes";
import type { AlocacaoForm } from "@/lib/alocacao";
import { spParts } from "@/lib/cadencia";
import { cicloPadrao, type MetasCiclo, type Parametros, type SafraForm } from "@/lib/safras";

const SEMANAS = ["dashboard_semanas"] as const;

export function useSemanas() {
  const fn = useServerFn(dashboardSemanas);
  return useQuery({ queryKey: SEMANAS, queryFn: () => fn() });
}

/** Ações da aba Semanas; cada uma recarrega os dados da aba ao terminar. */
export function useSemanasAcoes() {
  const qc = useQueryClient();
  const criar = useServerFn(dashboardCriarSafra);
  const gerar = useServerFn(dashboardGerarSafras);
  const editar = useServerFn(dashboardEditarSafra);
  const excluir = useServerFn(dashboardExcluirSafra);
  const parametros = useServerFn(dashboardSalvarParametros);
  const metas = useServerFn(dashboardSalvarMetasCiclo);
  const recarregar = () => qc.invalidateQueries({ queryKey: SEMANAS });
  return {
    criar: async (periodId: string, safra: SafraForm) => {
      await criar({ data: { periodId, safra } });
      await recarregar();
    },
    gerar: async (periodId: string, inicio: string, ate: string) => {
      const r = await gerar({ data: { periodId, inicio, ate } });
      await recarregar();
      return r.criadas;
    },
    editar: async (id: string, safra: SafraForm) => {
      await editar({ data: { id, safra } });
      await recarregar();
    },
    excluir: async (id: string) => {
      await excluir({ data: { id } });
      await recarregar();
    },
    salvarParametros: async (p: Parametros) => {
      await parametros({ data: p });
      // A maturação e os limites mudam o cálculo de todas as abas.
      await qc.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("dashboard_"),
      });
    },
    salvarMetas: async (periodId: string, m: MetasCiclo) => {
      await metas({ data: { periodId, metas: m } });
      await recarregar();
    },
  };
}
export type SemanasAcoes = ReturnType<typeof useSemanasAcoes>;

const ALOCACAO = "dashboard_alocacao";

/** Alocação de um ciclo: safras, linhas, membros e setores. */
export function useAlocacao(periodId: string | null) {
  const fn = useServerFn(dashboardAlocacao);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: [ALOCACAO, periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
  });
}

/** Ações da alocação; recarregam a alocação e as semanas (a exclusão de safra depende delas). */
export function useAlocacaoAcoes() {
  const qc = useQueryClient();
  const salvar = useServerFn(dashboardSalvarAlocacao);
  const excluir = useServerFn(dashboardExcluirAlocacao);
  const copiar = useServerFn(dashboardCopiarAlocacoes);
  const recarregar = async () => {
    await qc.invalidateQueries({ queryKey: [ALOCACAO] });
    await qc.invalidateQueries({ queryKey: SEMANAS });
  };
  return {
    salvar: async (safraId: string, id: string | null, alocacao: AlocacaoForm) => {
      await salvar({ data: { safraId, id, alocacao, hoje: spParts().iso } });
      await recarregar();
    },
    excluir: async (id: string) => {
      await excluir({ data: { id, hoje: spParts().iso } });
      await recarregar();
    },
    copiar: async (safraId: string) => {
      const r = await copiar({ data: { safraId, hoje: spParts().iso } });
      await recarregar();
      return r.copiadas;
    },
  };
}
export type AlocacaoAcoes = ReturnType<typeof useAlocacaoAcoes>;

/** Aba Hunters: filas, disciplina e resultado de cada membro do ciclo na semana escolhida. */
export function useDashHunters(periodId: string | null, semana: string) {
  const fn = useServerFn(dashboardHunters);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: ["dashboard_hunters", periodId, semana, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, semana, hoje } }),
    enabled: !!periodId,
  });
}
export type DashHuntersDados = NonNullable<ReturnType<typeof useDashHunters>["data"]>;

const CONCILIACAO = "dashboard_conciliacao";

/** Fila de conciliação do ciclo. */
export function useConciliacao(periodId: string | null) {
  const fn = useServerFn(dashboardConciliacao);
  return useQuery({
    queryKey: [CONCILIACAO, periodId],
    queryFn: () => fn({ data: { periodId: periodId! } }),
    enabled: !!periodId,
  });
}
export type ConciliacaoDados = NonNullable<ReturnType<typeof useConciliacao>["data"]>;

/** Ações da conciliação; recarregam a fila ao terminar. */
export function useConciliacaoAcoes() {
  const qc = useQueryClient();
  const contato = useServerFn(dashboardLigarAtContato);
  const card = useServerFn(dashboardLigarAtCard);
  const sincronizar = useServerFn(dashboardSincronizarCards);
  const recarregar = () => qc.invalidateQueries({ queryKey: [CONCILIACAO] });
  return {
    ligarContato: async (atId: string, contactId: string) => {
      await contato({ data: { atId, contactId } });
      await recarregar();
    },
    ligarCard: async (atId: string, dealId: number) => {
      const r = await card({ data: { atId, dealId } });
      await recarregar();
      return r.aviso;
    },
    /** Sincroniza em lotes até não sobrar card, avisando o progresso. */
    sincronizar: async (progresso?: (feitos: number, restantes: number) => void) => {
      let feitos = 0;
      const erros: { deal: number; erro: string }[] = [];
      for (let i = 0; i < 50; i++) {
        const r = await sincronizar();
        feitos += r.sincronizados;
        erros.push(...r.erros);
        progresso?.(feitos, r.restantes);
        if (r.restantes === 0 || r.sincronizados === 0) break;
      }
      await recarregar();
      return { feitos, erros };
    },
  };
}

/** Visão geral (Módulo 1) do ciclo. Pesada: fica em cache por 5 minutos. */
export function useVisao(periodId: string | null) {
  const fn = useServerFn(dashboardVisao);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: ["dashboard_visao", periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Alertas de nível alto do ciclo padrão, para o contador do item "Dashboard" no menu. Só consulta
 * para administradores (`admin`); para os demais, undefined.
 */
export function useAlertasAltos(admin: boolean): number | undefined {
  const semanasFn = useServerFn(dashboardSemanas);
  const semanas = useQuery({
    queryKey: SEMANAS,
    queryFn: () => semanasFn(),
    enabled: admin,
    staleTime: 5 * 60 * 1000,
  });
  const ciclo = semanas.data ? cicloPadrao(semanas.data.ciclos) : null;
  const visao = useVisao(admin && ciclo ? ciclo.id : null);
  return visao.data?.alertas.filter((a) => a.nivel === "alta").length;
}
export type VisaoDados = NonNullable<ReturnType<typeof useVisao>["data"]>;

const REALIZACAO = "dashboard_realizacao";

/** Realização e avanço do ciclo (situação, horários, antecedência, setores, perdas e tempos). */
export function useRealizacao(periodId: string | null) {
  const fn = useServerFn(dashboardRealizacao);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: [REALIZACAO, periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
    staleTime: 5 * 60 * 1000,
  });
}
export type RealizacaoDados = NonNullable<ReturnType<typeof useRealizacao>["data"]>;

/** Grava as metas de dias por etapa e recarrega a aba. */
export function useSalvarTempoEtapas() {
  const qc = useQueryClient();
  const salvar = useServerFn(dashboardSalvarTempoEtapas);
  return async (metas: { stage_id: number; meta_dias: number }[]) => {
    await salvar({ data: { metas } });
    await qc.invalidateQueries({ queryKey: [REALIZACAO] });
  };
}

const SEGMENTOS = "dashboard_segmentos";

/** Segmentos do ciclo (quebras nas safras maduras) e o resultado dos testes A/B. */
export function useSegmentos(periodId: string | null) {
  const fn = useServerFn(dashboardSegmentos);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: [SEGMENTOS, periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
    staleTime: 5 * 60 * 1000,
  });
}
export type SegmentosDados = NonNullable<ReturnType<typeof useSegmentos>["data"]>;

/** Cadastro dos testes A/B; recarrega os segmentos. */
export function useTestesAbAcoes() {
  const qc = useQueryClient();
  const salvar = useServerFn(dashboardSalvarTesteAb);
  const encerrar = useServerFn(dashboardEncerrarTesteAb);
  const excluir = useServerFn(dashboardExcluirTesteAb);
  const recarregar = () => qc.invalidateQueries({ queryKey: [SEGMENTOS] });
  return {
    salvar: async (periodId: string, id: string | null, teste: AbForm) => {
      const r = await salvar({ data: { periodId, id, teste } });
      await recarregar();
      return r.id;
    },
    encerrar: async (id: string, encerrarTeste: boolean, conclusao = "") => {
      await encerrar({ data: { id, encerrar: encerrarTeste, conclusao } });
      await recarregar();
    },
    excluir: async (id: string) => {
      await excluir({ data: { id } });
      await recarregar();
    },
  };
}
export type TestesAbAcoes = ReturnType<typeof useTestesAbAcoes>;

/** Resultado do ciclo (pipeline, conversão, valor por AT, higiene) e os indicadores por ciclo. */
export function useResultado(periodId: string | null) {
  const fn = useServerFn(dashboardResultado);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: ["dashboard_resultado", periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
    staleTime: 5 * 60 * 1000,
  });
}
export type ResultadoDados = NonNullable<ReturnType<typeof useResultado>["data"]>;

/** Curvas de safra, mapa safra × semana e dias até a primeira AT (aba Semanas). */
export function useCurvas(periodId: string | null) {
  const fn = useServerFn(dashboardCurvas);
  const hoje = spParts().iso;
  return useQuery({
    queryKey: ["dashboard_curvas", periodId, hoje],
    queryFn: () => fn({ data: { periodId: periodId!, hoje } }),
    enabled: !!periodId,
    staleTime: 5 * 60 * 1000,
  });
}
export type CurvasDados = NonNullable<ReturnType<typeof useCurvas>["data"]>;
