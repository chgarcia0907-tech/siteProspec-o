import { createFileRoute } from "@tanstack/react-router";
import { ActivityBoard } from "@/components/ranking/ActivityBoard";
import { CompetitionBoard } from "@/components/ranking/CompetitionBoard";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking dos hunters — Cadência Outbound" },
      {
        name: "description",
        content:
          "Compare importações, mensagens enviadas, cadências concluídas e respostas por hunter.",
      },
      { property: "og:title", content: "Ranking dos hunters" },
      {
        property: "og:description",
        content:
          "Compare importações, mensagens enviadas, cadências concluídas e respostas por hunter.",
      },
    ],
  }),
  component: Ranking,
});

function Ranking() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ranking da competição</h1>
      </div>
      <CompetitionBoard />
      <ActivityBoard />
    </div>
  );
}
