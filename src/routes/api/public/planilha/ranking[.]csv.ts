import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/planilha/ranking.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const m = await import("@/lib/planilha.server");
        if (!m.checkToken(request)) return m.unauthorized();
        try {
          // ?visao=ciclo → ranking geral do ciclo; ?visao=semanas → ranking por semana do ciclo.
          const visao = new URL(request.url).searchParams.get("visao");
          if (visao === "ciclo") return m.csvResponse(await m.cicloCsv());
          if (visao === "semanas") return m.csvResponse(await m.cicloSemanasCsv());
          return m.csvResponse(await m.rankingCsv());
        } catch (e) {
          console.error("[planilha/ranking]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
