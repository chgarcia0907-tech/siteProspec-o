import { createFileRoute } from "@tanstack/react-router";

// Reconciliação diária com o Pipedrive (cron da Vercel, `Authorization: Bearer CRON_SECRET`):
// cobre webhooks perdidos. A lógica está em pipedrive.server.ts.
export const Route = createFileRoute("/api/public/pipedrive/sincronizar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const m = await import("@/lib/pipedrive.server");
        if (!m.cronAutorizado(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const r = await m.sincronizarTodas();
          return Response.json({
            ats: r.length,
            eventos: r.reduce((n, x) => n + x.gravados.length, 0),
            erros: r.filter((x) => x.erro).map((x) => ({ deal: x.deal, erro: x.erro })),
          });
        } catch (e) {
          console.error("[pipedrive/sincronizar]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
