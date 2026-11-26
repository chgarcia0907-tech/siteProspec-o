import { createFileRoute } from "@tanstack/react-router";

// Reconciliação diária com o Pipedrive (cron da Vercel, `Authorization: Bearer CRON_SECRET`):
// cobre webhooks perdidos e atualiza a cópia dos cards da dashboard. A lógica está em
// pipedrive.server.ts.
export const Route = createFileRoute("/api/public/pipedrive/sincronizar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const m = await import("@/lib/pipedrive.server");
        const v = m.verificarCron(request);
        if (v !== "ok") {
          const { respostaRecusa } = await import("@/lib/segredos.server");
          return respostaRecusa(v, "CRON_SECRET");
        }
        try {
          const r = await m.sincronizarTodas();
          // Cópia dos cards da dashboard: só os que mudaram; o que passar do limite fica para o
          // botão "Sincronizar agora" ou para o próximo cron. Falha aqui não perde as ATs acima.
          let cards: Awaited<ReturnType<typeof m.sincronizarCards>> | { erro: string };
          try {
            cards = await m.sincronizarCards({ limite: 150 });
          } catch (e) {
            console.error("[pipedrive/sincronizar] cópia dos cards", e);
            cards = { erro: (e as Error).message };
          }
          return Response.json({
            ats: r.length,
            eventos: r.reduce((n, x) => n + x.gravados.length, 0),
            erros: r.filter((x) => x.erro).map((x) => ({ deal: x.deal, erro: x.erro })),
            cards,
          });
        } catch (e) {
          console.error("[pipedrive/sincronizar]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
