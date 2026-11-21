import { createFileRoute } from "@tanstack/react-router";

// Webhook do Pipedrive (card ou task alterada). Configure no Pipedrive com HTTP auth igual a
// PIPEDRIVE_WEBHOOK_USER/PIPEDRIVE_WEBHOOK_PASSWORD; a lógica está em pipedrive.server.ts.
export const Route = createFileRoute("/api/public/pipedrive/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const m = await import("@/lib/pipedrive.server");
        const v = m.verificarWebhook(request);
        if (v !== "ok") {
          const { respostaRecusa } = await import("@/lib/segredos.server");
          return respostaRecusa(v, "PIPEDRIVE_WEBHOOK_USER e PIPEDRIVE_WEBHOOK_PASSWORD");
        }
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        try {
          return Response.json(await m.receberWebhook(body));
        } catch (e) {
          console.error("[pipedrive/webhook]", e);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
