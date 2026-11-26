// Dados da Dashboard de Outbound (server functions que validam has_role).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  dashboardCriarSafra,
  dashboardEditarSafra,
  dashboardExcluirSafra,
  dashboardGerarSafras,
  dashboardSalvarMetasCiclo,
  dashboardSalvarParametros,
  dashboardSemanas,
} from "@/lib/dashboard.functions";
import type { MetasCiclo, Parametros, SafraForm } from "@/lib/safras";

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
      await recarregar();
    },
    salvarMetas: async (periodId: string, m: MetasCiclo) => {
      await metas({ data: { periodId, metas: m } });
      await recarregar();
    },
  };
}
export type SemanasAcoes = ReturnType<typeof useSemanasAcoes>;
