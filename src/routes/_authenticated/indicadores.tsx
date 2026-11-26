import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseIndicadoresBusca, type IndicadoresBusca } from "@/lib/indicadores";

// Os Indicadores viraram a Dashboard (/dashboard). A rota antiga continua existindo para links
// salvos não darem em página inexistente, e leva os filtros junto.
export const Route = createFileRoute("/_authenticated/indicadores")({
  validateSearch: (raw: Record<string, unknown>): IndicadoresBusca => parseIndicadoresBusca(raw),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/dashboard", search: { ...search, aba: "indicadores" }, replace: true });
  },
});
