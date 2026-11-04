import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/planilha/contatos.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const m = await import("@/lib/planilha.server");
        if (!m.checkToken(request)) return m.unauthorized();
        try {
          return m.csvResponse(await m.contatosCsv());
        } catch (e) {
          console.error("[planilha/contatos]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
