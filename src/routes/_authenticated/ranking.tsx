import { createFileRoute, redirect } from "@tanstack/react-router";

// O ranking passou a ser só do administrador, na aba "Competição" do painel. A rota antiga
// continua existindo para links salvos não darem em página inexistente.
export const Route = createFileRoute("/_authenticated/ranking")({
  beforeLoad: () => {
    throw redirect({ to: "/painel", search: { aba: "competicao" } });
  },
});
