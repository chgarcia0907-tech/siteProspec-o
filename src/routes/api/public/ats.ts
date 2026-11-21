import { createFileRoute } from "@tanstack/react-router";

// Endpoint da skill criar-card: conferir, marcar e remarcar ATs (Bearer ATS_INGEST_TOKEN).
// Contrato em src/lib/atsSkill.ts; gravação em src/lib/atsSkill.server.ts.
export const Route = createFileRoute("/api/public/ats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const m = await import("@/lib/atsSkill.server");
        const v = m.verificarSkill(request);
        if (v !== "ok") {
          const { respostaRecusa } = await import("@/lib/segredos.server");
          return respostaRecusa(v, "ATS_INGEST_TOKEN");
        }
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, erro: "Corpo JSON inválido." }, { status: 400 });
        }
        const { lerPedido } = await import("@/lib/atsSkill");
        const lido = lerPedido(body);
        if ("erro" in lido) return Response.json({ ok: false, erro: lido.erro }, { status: 400 });
        try {
          const r = await m.atenderSkill(lido.pedido);
          return Response.json(r.corpo, { status: r.status });
        } catch (e) {
          console.error("[api/ats]", e);
          return Response.json({ ok: false, erro: "Erro interno ao gravar." }, { status: 500 });
        }
      },
    },
  },
});
