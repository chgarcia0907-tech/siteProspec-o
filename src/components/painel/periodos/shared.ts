import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Overview, OverviewPeriod } from "@/hooks/usePainel";
import { errorMessage } from "@/lib/utils";

/** Executa uma ação do painel com toast de sucesso/erro e recarrega os dados. */
export function usePeriodActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();
  const run = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return { run, refresh };
}

export const fmtDate = (ts: string) =>
  new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Dados de um período já filtrados (grupos, subgrupos, membros) para os cards. */
export function periodScope(data: Overview, period: OverviewPeriod) {
  const groups = data.groups.filter((g) => g.period_id === period.id);
  const subsOf = (gid: string) => data.subgroups.filter((s) => s.group_id === gid);
  const members = data.members.filter((m) => m.period_id === period.id);
  return {
    groups,
    subsOf,
    members,
    unallocated: members.filter((m) => !m.group_id),
    groupName: new Map(groups.map((g) => [g.id, g.name])),
    subgroupName: new Map(data.subgroups.map((s) => [s.id, s.name])),
  };
}
export type PeriodScope = ReturnType<typeof periodScope>;

/** Grupo/subgrupo escolhido para alocar membros ("" = sem). */
export type Allocation = { groupId: string; subgroupId: string };
export const NO_ALLOCATION: Allocation = { groupId: "", subgroupId: "" };
