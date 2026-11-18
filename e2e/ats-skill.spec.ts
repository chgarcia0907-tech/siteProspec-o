import { test as base } from "@playwright/test";
import { expect, MOCK, mutations } from "./helpers";

const U1 = "11111111-1111-4111-8111-111111111111";
const BRUNO = "dddddddd-0000-4000-8000-000000000002";
const AT_OMEGA = "15151515-0000-4000-8000-000000000002";
const auth = { authorization: "Bearer e2e-skill" };

// Pedido como a skill criar-card monta depois de criar o card e as tasks no Pipedrive.
const MARCAR = {
  acao: "marcar",
  card: 99001,
  hunter: "hunter1",
  cn: "rui.cn",
  canal: "whatsapp",
  mensagem: "respondeu ao WhatsApp 1",
  empresa: "Beta",
  prospect: "Bruno Lima",
  cargo: "CTO",
  setor: "Indústria",
  linkedin: "https://www.linkedin.com/in/bruno-lima",
  motivo: "Fábrica com muito controle em planilha.",
  ficha: "Ficha de AT - Beta\n...",
  agendada: "2026-11-19 15:00",
  pessoa: 70001,
  organizacao: 30001,
  tasks: { at: 170004, tp1: 170001, tp3: 170002, tp4: 170003 },
};

base.describe("Endpoint da skill criar-card", () => {
  base.beforeEach(() => fetch(`${MOCK}/__reset`, { method: "POST" }));

  base("recusa token errado e corpo inválido", async ({ request }) => {
    const sem = await request.post("/api/public/ats", { data: MARCAR });
    expect(sem.status()).toBe(401);
    const errado = await request.post("/api/public/ats", {
      data: MARCAR,
      headers: { authorization: "Bearer outro" },
    });
    expect(errado.status()).toBe(401);
    const invalido = await request.post("/api/public/ats", {
      data: { acao: "marcar", empresa: "Beta" },
      headers: auth,
    });
    expect(invalido.status()).toBe(400);
    expect((await invalido.json()).erro).toContain("card");
    expect(await mutations()).toEqual([]);
  });

  base("marcar grava a AT com o hunter, o contato e a mensagem da ficha", async ({ request }) => {
    const r = await request.post("/api/public/ats", { data: MARCAR, headers: auth });
    expect(r.status()).toBe(201);
    expect(await r.json()).toEqual({
      ok: true,
      ja_existia: false,
      card: 99001,
      hunter_com_conta: true,
      contato_ligado: true,
    });
    const m = (await mutations()).filter((x) => x.table === "ats");
    expect(m).toHaveLength(1);
    expect(JSON.parse(m[0]!.body)).toMatchObject({
      origem: "skill",
      user_id: U1,
      hunter_login: "hunter1",
      cn_login: "rui.cn",
      contact_id: BRUNO,
      canal: "WhatsApp",
      mensagem_ficha: "respondeu ao WhatsApp 1",
      agendada_original: "2026-11-19T15:00:00-03:00",
      pipedrive_deal_id: 99001,
      pipedrive_activity_at_id: 170004,
    });
  });

  base("marcar um card que já existe não duplica", async ({ request }) => {
    const r = await request.post("/api/public/ats", {
      data: { ...MARCAR, card: 94307 },
      headers: auth,
    });
    expect(await r.json()).toEqual({ ok: true, ja_existia: true, card: 94307 });
    expect((await mutations()).filter((x) => x.table === "ats")).toEqual([]);
  });

  base("conferir acha a AT pelo prospect, com o card e as tasks", async ({ request }) => {
    const r = await request.post("/api/public/ats", {
      data: { acao: "conferir", empresa: "Omega", prospect: "paulo reis" },
      headers: auth,
    });
    expect(await r.json()).toEqual({
      ok: true,
      ats: [
        {
          card: 94307,
          empresa: "Ômega Log",
          prospect: "Paulo Reis",
          mesma_empresa: true,
          hunter: "hunter2",
          cn: "rui.cn",
          canal: "WhatsApp",
          status: "realizada",
          agendada_atual: "2026-11-11 15:00",
          tasks: { at: null, tp1: null, tp3: null, tp4: null },
        },
      ],
    });
  });

  base("remarcar grava no log; card sem AT dá 404", async ({ request }) => {
    const r = await request.post("/api/public/ats", {
      data: {
        acao: "remarcar",
        card: 94307,
        nova: "2026-11-26 10:00",
        motivo: "Prospect viajou",
        tasks: { at: 170010 },
      },
      headers: auth,
    });
    expect(await r.json()).toEqual({
      ok: true,
      ja_registrada: false,
      card: 94307,
      horario_anterior: "2026-11-11 15:00",
      horario_novo: "2026-11-26 10:00",
    });
    const m = await mutations();
    expect(m.find((x) => x.table === "ats" && x.method === "PATCH")!.body).toBe(
      JSON.stringify({ pipedrive_activity_at_id: 170010 }),
    );
    expect(JSON.parse(m.find((x) => x.table === "at_eventos")!.body)).toMatchObject({
      at_id: AT_OMEGA,
      evento: "remarcada",
      horario_novo: "2026-11-26T10:00:00-03:00",
      motivo: "Prospect viajou",
      origem: "skill",
      pipedrive_ref: "skill:remarcada:94307:2026-11-26T13:00:00.000Z",
    });

    const sem = await request.post("/api/public/ats", {
      data: { acao: "remarcar", card: 1, nova: "2026-11-26 10:00" },
      headers: auth,
    });
    expect(sem.status()).toBe(404);
  });
});
