import { describe, expect, it } from "vitest";
import {
  canalDaSkill,
  conferir,
  dataHoraDaSkill,
  eventoRemarcacaoDaSkill,
  lerPedido,
  linhaDaSkill,
  tasksNovas,
  type AtParaConferir,
  type PedidoMarcar,
} from "./atsSkill";

// Pedido como a skill monta para a ficha real da Perplan (card 94413).
const MARCAR = {
  acao: "marcar",
  card: 94413,
  hunter: "@Mariana.Altali",
  cn: "leonardo.blanco",
  canal: "Whatsapp",
  mensagem: "respondeu ao WhatsApp 1",
  empresa: "Perplan Incorporações",
  prospect: "Lucas Verdolini",
  cargo: "Gerente de vendas",
  setor: "Real State",
  linkedin: "https://www.linkedin.com/in/lucas-verdolini-a30b84231/",
  motivo: "Grande empresa de incorporação imobiliária.",
  ficha: "Ficha de AT - Perplan Incorporações\n...",
  agendada: "2026-11-20 15:00",
  pessoa: "67977",
  organizacao: 235,
  tasks: { at: 160626, tp1: 160624, tp3: null, tp4: 160625 },
};

const AT: AtParaConferir = {
  pipedrive_deal_id: 94413,
  empresa: "Perplan Incorporações",
  prospect: "Lucas Verdolini",
  hunter_login: "mariana.altali",
  cn_login: "leonardo.blanco",
  canal: "WhatsApp",
  status: "agendada",
  agendada_atual: "2026-11-20T18:00:00+00:00",
  pipedrive_activity_at_id: 160626,
  pipedrive_activity_tp1_id: 160624,
  pipedrive_activity_tp3_id: null,
  pipedrive_activity_tp4_id: 160625,
};

describe("valores da skill", () => {
  it("data e hora em Brasília, no formato da skill ou ISO", () => {
    expect(dataHoraDaSkill("2026-11-20 15:00")).toBe("2026-11-20T15:00:00-03:00");
    expect(dataHoraDaSkill("2026-11-20T15:00")).toBe("2026-11-20T15:00:00-03:00");
    expect(dataHoraDaSkill("2026-11-20T18:00:00Z")).toBe("2026-11-20T18:00:00Z");
    expect(dataHoraDaSkill("20/11 15h")).toBeNull();
    expect(dataHoraDaSkill("2026-11-20 25:00")).toBeNull();
    expect(dataHoraDaSkill(null)).toBeNull();
  });

  it("canal na grafia da plataforma", () => {
    expect(canalDaSkill("whatsapp")).toBe("WhatsApp");
    expect(canalDaSkill("Email")).toBe("E-mail");
    expect(canalDaSkill("cold_call")).toBe("Cold Call");
    expect(canalDaSkill("LinkedIn")).toBe("LinkedIn");
    expect(canalDaSkill("pombo")).toBeNull();
  });
});

describe("lerPedido", () => {
  it("marcar: normaliza login, canal, data e ids", () => {
    const r = lerPedido(MARCAR);
    expect(r).toEqual({
      pedido: {
        ...MARCAR,
        hunter: "mariana.altali",
        canal: "WhatsApp",
        agendada: "2026-11-20T15:00:00-03:00",
        pessoa: 67977,
        tasks: { at: 160626, tp1: 160624, tp3: null, tp4: 160625 },
      },
    });
  });

  it("marcar: diz o que falta e recusa canal desconhecido", () => {
    expect(lerPedido({ acao: "marcar", empresa: "X" })).toEqual({
      erro: "Campos obrigatórios: card, prospect, agendada (AAAA-MM-DD HH:MM, Brasília).",
    });
    expect(lerPedido({ ...MARCAR, canal: "pombo" })).toEqual({
      erro: "Canal desconhecido: pombo.",
    });
  });

  it("remarcar e conferir", () => {
    expect(
      lerPedido({ acao: "remarcar", card: "94413", nova: "2026-11-27 10:00", motivo: " viagem " }),
    ).toEqual({
      pedido: {
        acao: "remarcar",
        card: 94413,
        nova: "2026-11-27T10:00:00-03:00",
        motivo: "viagem",
        ficha: null,
        tasks: { at: null, tp1: null, tp3: null, tp4: null },
      },
    });
    expect(lerPedido({ acao: "remarcar", card: 1 })).toEqual({
      erro: "Campos obrigatórios: nova (AAAA-MM-DD HH:MM, Brasília).",
    });
    expect(lerPedido({ acao: "conferir", empresa: "Perplan" })).toEqual({
      erro: "Informe card ou prospect.",
    });
    expect(lerPedido({ acao: "apagar" })).toEqual({
      erro: 'acao deve ser "conferir", "marcar" ou "remarcar".',
    });
    expect(lerPedido(null)).toEqual({ erro: "Corpo JSON obrigatório." });
  });
});

describe("conferir", () => {
  it("acha pelo prospect sem acento e diz se é a mesma empresa", () => {
    const outra = { ...AT, pipedrive_deal_id: 1, empresa: "Outra SA" };
    const r = conferir([AT, outra], {
      acao: "conferir",
      empresa: "Perplan",
      prospect: "lucas  VERDOLINI",
      card: null,
    });
    expect(r.map((x) => [x.card, x.mesma_empresa])).toEqual([
      [94413, true],
      [1, false],
    ]);
    expect(r[0]).toMatchObject({
      agendada_atual: "2026-11-20 15:00",
      tasks: { at: 160626, tp1: 160624, tp3: null, tp4: 160625 },
    });
  });

  it("acha pelo card", () => {
    expect(
      conferir([AT], { acao: "conferir", empresa: "", prospect: "", card: 94413 }).map(
        (x) => x.card,
      ),
    ).toEqual([94413]);
    expect(
      conferir([AT], { acao: "conferir", empresa: "", prospect: "Fulano", card: null }),
    ).toEqual([]);
  });
});

describe("gravação", () => {
  const pedido = (lerPedido(MARCAR) as { pedido: PedidoMarcar }).pedido;

  it("linha da AT com origem skill, contato e mensagem da ficha", () => {
    expect(
      linhaDaSkill(pedido, {
        userId: "u1",
        contato: { id: "c1", resposta_etapa: 2, resposta_modelo: "WPP-1" },
        agora: "2026-11-18T17:19:00.000Z",
      }),
    ).toMatchObject({
      origem: "skill",
      user_id: "u1",
      hunter_login: "mariana.altali",
      contact_id: "c1",
      resposta_etapa: 2,
      mensagem_ficha: "respondeu ao WhatsApp 1",
      agendada_original: "2026-11-20T15:00:00-03:00",
      agendada_atual: "2026-11-20T15:00:00-03:00",
      registrada_em: "2026-11-18T17:19:00.000Z",
      pipedrive_deal_id: 94413,
      pipedrive_person_id: 67977,
      pipedrive_activity_tp3_id: null,
    });
  });

  it("remarcação com referência estável para não duplicar", () => {
    const p = {
      acao: "remarcar" as const,
      card: 94413,
      nova: "2026-11-27T10:00:00-03:00",
      motivo: null,
      ficha: null,
      tasks: {},
    };
    const e = eventoRemarcacaoDaSkill({ id: "a1", agendada_atual: AT.agendada_atual }, p, "agora");
    expect(e).toEqual({
      at_id: "a1",
      evento: "remarcada",
      ocorrido_em: "agora",
      horario_anterior: "2026-11-20T18:00:00+00:00",
      horario_novo: "2026-11-27T10:00:00-03:00",
      motivo: "Ficha de Remarcação",
      origem: "skill",
      pipedrive_ref: "skill:remarcada:94413:2026-11-27T13:00:00.000Z",
    });
    // O mesmo instante escrito de outro jeito dá a mesma referência.
    expect(
      eventoRemarcacaoDaSkill(
        { id: "a1", agendada_atual: "" },
        { ...p, nova: "2026-11-27T13:00:00Z" },
        "",
      ).pipedrive_ref,
    ).toBe(e.pipedrive_ref);
  });

  it("só as tasks recriadas mudam na AT", () => {
    expect(tasksNovas({ at: 9, tp1: null, tp3: 8 })).toEqual({
      pipedrive_activity_at_id: 9,
      pipedrive_activity_tp3_id: 8,
    });
    expect(tasksNovas({})).toEqual({});
  });
});
