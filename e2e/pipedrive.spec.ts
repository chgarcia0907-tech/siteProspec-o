import { test as base } from "@playwright/test";
import { expect, MOCK, mutations } from "./helpers";

const AT_OMEGA = "15151515-0000-4000-8000-000000000002";
const auth = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
// Webhook v2 do Pipedrive: a task da AT do card 94307 mudou.
const WEBHOOK = {
  meta: { action: "change", entity: "activity", entity_id: 500002 },
  data: { id: 500002, deal_id: 94307 },
  previous: {},
};

base.describe("Integração com o Pipedrive", () => {
  base.beforeEach(() => fetch(`${MOCK}/__reset`, { method: "POST" }));

  base("o webhook recusa quem não manda a senha", async ({ request }) => {
    const sem = await request.post("/api/public/pipedrive/webhook", { data: WEBHOOK });
    expect(sem.status()).toBe(401);
    const errada = await request.post("/api/public/pipedrive/webhook", {
      data: WEBHOOK,
      headers: { authorization: auth("pipedrive", "outra") },
    });
    expect(errada.status()).toBe(401);
    const cron = await request.get("/api/public/pipedrive/sincronizar");
    expect(cron.status()).toBe(401);
    expect(await mutations()).toEqual([]);
  });

  base("o webhook guarda o payload e grava a etapa e a remarcação do card", async ({ request }) => {
    const r = await request.post("/api/public/pipedrive/webhook", {
      data: WEBHOOK,
      headers: { authorization: auth("pipedrive", "e2e-webhook") },
    });
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ deal: 94307, ok: true });

    const m = await mutations();
    const log = m.find((x) => x.table === "pipedrive_webhook_log" && x.method === "POST");
    expect(JSON.parse(log!.body)).toMatchObject({
      evento: "change.activity",
      objeto_id: 94307,
      payload: WEBHOOK,
    });
    const eventos = m.filter((x) => x.table === "at_eventos").map((x) => JSON.parse(x.body));
    expect(eventos).toEqual([
      {
        at_id: AT_OMEGA,
        origem: "pipedrive_webhook",
        evento: "etapa_pipedrive",
        ocorrido_em: "2026-11-12T13:00:00.000Z",
        horario_anterior: null,
        horario_novo: null,
        motivo: null,
        pipedrive_stage_id: 108,
        pipedrive_ref: "deal:94307:etapa:108:2026-11-12T13:00:00.000Z",
      },
      {
        at_id: AT_OMEGA,
        origem: "pipedrive_webhook",
        evento: "remarcada",
        ocorrido_em: "2026-11-12T13:05:00.000Z",
        horario_anterior: "2026-11-11T18:00:00+00:00",
        horario_novo: "2026-11-19T15:00:00-03:00",
        motivo: "Remarcada no Pipedrive",
        pipedrive_stage_id: null,
        pipedrive_ref: "act:500002:horario:2026-11-19T15:00:00-03:00",
      },
    ]);
  });

  base("card sem AT na plataforma só fica no log", async ({ request }) => {
    const r = await request.post("/api/public/pipedrive/webhook", {
      data: { meta: { action: "change", entity: "deal", entity_id: 1 }, data: { id: 1 } },
      headers: { authorization: auth("pipedrive", "e2e-webhook") },
    });
    expect(await r.json()).toEqual({ deal: 1, ok: true });
    expect((await mutations()).filter((x) => x.table === "at_eventos")).toEqual([]);
  });

  base("a reconciliação diária passa pelas ATs com card", async ({ request }) => {
    const r = await request.get("/api/public/pipedrive/sincronizar", {
      headers: { authorization: "Bearer e2e-cron" },
    });
    // Cópia dos cards: o 94307 (ligado a uma AT) e o 94500 (outbound NTec, sem AT).
    expect(await r.json()).toEqual({
      ats: 1,
      eventos: 2,
      erros: [],
      cards: { sincronizados: 2, restantes: 0, erros: [] },
    });
    const origens = (await mutations())
      .filter((x) => x.table === "at_eventos")
      .map((x) => JSON.parse(x.body).origem);
    expect(origens).toEqual(["pipedrive_reconciliacao", "pipedrive_reconciliacao"]);
  });

  base("a cópia do card guarda valor, cargo, histórico de etapas e tasks", async ({ request }) => {
    await request.get("/api/public/pipedrive/sincronizar", {
      headers: { authorization: "Bearer e2e-cron" },
    });
    const m = await mutations();
    const card = m
      .filter((x) => x.table === "pd_cards")
      .map((x) => JSON.parse(x.body))
      .find((b) => b.deal_id === 94500);
    expect(card).toMatchObject({
      outbound: true,
      stage_id: 31,
      valor: 30000,
      hunter_login: "hunter2",
      cargo: "Diretora de Logística",
      etiquetas: [34],
    });
    const ligado = m
      .filter((x) => x.table === "pd_cards")
      .map((x) => JSON.parse(x.body))
      .find((b) => b.deal_id === 94307);
    expect(ligado).toMatchObject({ outbound: false, hunter_login: "hunter1" });
    const etapas = m
      .filter((x) => x.table === "pd_card_etapas" && x.method === "POST")
      .flatMap((x) => JSON.parse(x.body))
      .filter((e: { deal_id: number }) => e.deal_id === 94500);
    expect(etapas).toEqual([
      {
        deal_id: 94500,
        stage_id: 108,
        entrou_em: "2026-11-03T12:00:00.000Z",
        saiu_em: "2026-11-06T13:00:00.000Z",
      },
      { deal_id: 94500, stage_id: 31, entrou_em: "2026-11-06T13:00:00.000Z", saiu_em: null },
    ]);
    const tasks = m
      .filter((x) => x.table === "pd_tasks" && x.method === "POST")
      .flatMap((x) => JSON.parse(x.body))
      .filter((t: { deal_id: number }) => t.deal_id === 94500);
    expect(tasks.map((t: { activity_id: number }) => t.activity_id).sort()).toEqual(
      expect.arrayContaining([500010, 500011]),
    );
  });
});
