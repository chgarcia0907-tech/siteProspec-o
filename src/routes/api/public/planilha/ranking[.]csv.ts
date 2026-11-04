import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/planilha/ranking.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const m = await import("@/lib/planilha.server");
        if (!m.checkToken(request)) return m.unauthorized();
        try {
          return m.csvResponse(await m.rankingCsv());
        } catch (e) {
          console.error("[planilha/ranking]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
