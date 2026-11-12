// Dados do painel do administrador (server functions que validam has_role).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { painelDelete, painelHunters } from "@/lib/painel.functions";
import { periodsOverview } from "@/lib/periodos.functions";

export function useHunters() {
  const fn = useServerFn(painelHunters);
  return useQuery({ queryKey: ["painel_hunters"], queryFn: () => fn() });
}
export type HunterInfo = NonNullable<ReturnType<typeof useHunters>["data"]>["hunters"][number];

/** Exclui contatos (por ids ou todos de um hunter) e recarrega os dados. */
export function useDeleter() {
  const del = useServerFn(painelDelete);
  const qc = useQueryClient();
  return async (input: { mode: "ids"; ids: string[] } | { mode: "hunter"; hunterId: string }) => {
    const r = await del({ data: input });
    toast.success(`${r.deleted} contatos excluídos`);
    qc.invalidateQueries();
  };
}

export function useOverview() {
  const fn = useServerFn(periodsOverview);
  return useQuery({ queryKey: ["periods_overview"], queryFn: () => fn() });
}
export type Overview = NonNullable<ReturnType<typeof useOverview>["data"]>;
export type OverviewPeriod = Overview["periods"][number];
