import { describe, expect, it } from "vitest";
import {
  CAMPO_CANAL_ENTRADA,
  CAMPO_FUNCIONARIOS,
  avancouNoHistorico,
  ehCardOutbound,
  etapasDoFluxo,
  linhaDaTask,
  linhaDoCard,
  precisaSincronizar,
  type PdCard,
} from "./espelhoPipedrive";
import { CAMPO_HUNTER } from "./tasksHunter";

// Formato real da API v2 (card 93638 do funil 6, com os campos personalizados como ids de opção).
const CARD: PdCard = {
  id: 93638,
  title: "[S5 - joao.araujo] DV Manutenção",
  pipeline_id: 6,
  stage_id: 33,
  status: "open",
  value: 0,
  currency: "BRL",
  lost_reason: null,
  add_time: "2026-10-22T17:14:01Z",
  update_time: "2026-11-26T17:55:34Z",
  stage_change_time: "2026-11-12T19:37:51Z",
  won_time: null,
  lost_time: null,
  person_id: 67323,
  org_id: 20098,
  label_ids: [34],
  custom_fields: {
    [CAMPO_CANAL_ENTRADA]: 28,
    [CAMPO_FUNCIONARIOS]: 183,
    [CAMPO_HUNTER]: 659,
  },
};
const OPCOES = {
  hunter: new Map([
    [458, "Nenhum"],
    [659, "joao.araujo"],
  ]),
  canal: new Map([
    [27, "Inbound"],
    [28, "Outbound"],
  ]),
  funcionarios: new Map([
    [183, "1-10"],
    [187, "501-1,000"],
  ]),
};

describe("quais cards entram", () => {
  it("outbound NTec = funil 6, etiqueta NTec e Canal de Entrada Outbound", () => {
    expect(ehCardOutbound(CARD)).toBe(true);
    // Outro núcleo no mesmo funil (etiqueta NI, 286).
    expect(ehCardOutbound({ ...CARD, label_ids: [286] })).toBe(false);
    expect(ehCardOutbound({ ...CARD, pipeline_id: 2 })).toBe(false);
    expect(
      ehCardOutbound({
        ...CARD,
        custom_fields: { ...CARD.custom_fields, [CAMPO_CANAL_ENTRADA]: 27 },
      }),
    ).toBe(false);
    // A opção pode vir como objeto { id, label }.
    expect(
      ehCardOutbound({
        ...CARD,
        custom_fields: { [CAMPO_CANAL_ENTRADA]: { id: 28, label: "Outbound" } },
      }),
    ).toBe(true);
  });

  it("sincroniza de novo só quando o card mudou", () => {
    expect(precisaSincronizar(CARD, undefined)).toBe(true);
    expect(precisaSincronizar(CARD, { update_time: "2026-11-26T17:55:34+00:00" })).toBe(false);
    expect(precisaSincronizar(CARD, { update_time: "2026-11-20T10:00:00Z" })).toBe(true);
  });
});

describe("linhas do banco", () => {
  it("card: rótulos das opções, porte nas faixas da plataforma e cargo da pessoa", () => {
    const l = linhaDoCard(
      CARD,
      OPCOES,
      "  Gerente de Manutenção ",
      true,
      new Date("2026-11-26T18:00:00Z"),
    );
    expect(l).toMatchObject({
      deal_id: 93638,
      stage_id: 33,
      status: "open",
      hunter_login: "joao.araujo",
      canal_entrada: "Outbound",
      porte: "1-10",
      cargo: "Gerente de Manutenção",
      etiquetas: [34],
      outbound: true,
      add_time: "2026-10-22T17:14:01.000Z",
      sincronizado_em: "2026-11-26T18:00:00.000Z",
    });
  });

  it("Hunter 'Nenhum', porte e cargo vazios viram null", () => {
    const l = linhaDoCard(
      { ...CARD, custom_fields: { [CAMPO_HUNTER]: 458, [CAMPO_FUNCIONARIOS]: null } },
      OPCOES,
      "",
      false,
    );
    expect(l).toMatchObject({ hunter_login: null, porte: null, cargo: null, canal_entrada: null });
  });

  it("task: data, conclusão e o hunter do card; apagada fica de fora", () => {
    const t = {
      id: 7,
      subject: "AT - 16h30 @joao",
      type: "meeting",
      due_date: "2026-11-12",
      done: true,
      marked_as_done_time: "2026-11-12 19:00:00",
      add_time: "2026-11-05 10:00:00",
    };
    expect(linhaDaTask(t, 93638, "joao.araujo")).toEqual({
      activity_id: 7,
      deal_id: 93638,
      assunto: "AT - 16h30 @joao",
      tipo: "meeting",
      due_date: "2026-11-12",
      done: true,
      marked_as_done_time: "2026-11-12T19:00:00.000Z",
      add_time: "2026-11-05T10:00:00.000Z",
      hunter_login: "joao.araujo",
    });
    expect(linhaDaTask({ ...t, is_deleted: true }, 93638, null)).toBeNull();
  });
});

describe("histórico de etapas", () => {
  const mudanca = (de: number, para: number, quando: string) => ({
    object: "dealChange",
    data: {
      field_key: "stage_id",
      old_value: String(de),
      new_value: String(para),
      log_time: quando,
    },
  });

  it("monta as passagens desde a criação, na ordem das mudanças", () => {
    const fluxo = [
      mudanca(31, 33, "2026-11-12 19:37:51"),
      { object: "activity", timestamp: "2026-11-10 10:00:00" },
      mudanca(108, 31, "2026-11-05 14:00:00"),
      { object: "dealChange", data: { field_key: "value", old_value: "0", new_value: "100" } },
    ];
    expect(etapasDoFluxo(CARD, fluxo)).toEqual([
      { stage_id: 108, entrou_em: "2026-10-22T17:14:01.000Z", saiu_em: "2026-11-05T14:00:00.000Z" },
      { stage_id: 31, entrou_em: "2026-11-05T14:00:00.000Z", saiu_em: "2026-11-12T19:37:51.000Z" },
      { stage_id: 33, entrou_em: "2026-11-12T19:37:51.000Z", saiu_em: null },
    ]);
  });

  it("sem mudanças, só a etapa atual desde a criação", () => {
    expect(etapasDoFluxo(CARD, [])).toEqual([
      { stage_id: 33, entrou_em: "2026-10-22T17:14:01.000Z", saiu_em: null },
    ]);
  });

  it("avançou se passou por AT de Aprofundamento ou além, mesmo voltando ou perdendo depois", () => {
    const voltou = etapasDoFluxo(CARD, [
      mudanca(31, 33, "2026-11-12 19:37:51"),
      mudanca(33, 31, "2026-11-13 10:00:00"),
    ]);
    expect(voltou.at(-1)!.stage_id).toBe(31);
    expect(avancouNoHistorico(voltou, "lost")).toBe(true);
    expect(avancouNoHistorico([{ stage_id: 108 }, { stage_id: 31 }], "open")).toBe(false);
    expect(avancouNoHistorico([{ stage_id: 31 }], "won")).toBe(true);
  });
});
