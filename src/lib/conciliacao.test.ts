import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import {
  cardDaAt,
  atsSemCard,
  computeConciliacao,
  pendencias,
  type CAt,
  type CCard,
  type ConciliacaoInput,
} from "./conciliacao";
import type { Safra } from "./safras";

const at = (o: Partial<CAt> & Pick<CAt, "id">): CAt => ({
  user_id: "ana",
  hunter_login: "ana.souza",
  contact_id: null,
  pipedrive_deal_id: null,
  empresa: "Delta",
  prospect: "Carla Dias",
  registrada_em: "2026-11-24T15:00:00Z",
  status: "agendada",
  ...o,
});
const card = (o: Partial<CCard> & Pick<CCard, "deal_id" | "titulo">): CCard => ({
  hunter_login: "ana.souza",
  stage_id: 108,
  status: "open",
  add_time: "2026-11-24T16:00:00Z",
  cargo: "CFO",
  ...o,
});
const safra = (numero: number, inicio: string, usa = true): Safra => ({
  id: `s${numero}`,
  period_id: "c",
  numero,
  inicio,
  fim: inicio,
  usa_alocacao: usa,
  cadencia_em: addDaysISO(inicio, 7),
});

const INPUT: ConciliacaoInput = {
  desde: "2026-11-09",
  ats: [
    // Sem card e sem contato; o card "Delta - Carla Dias" ainda não tem AT.
    at({ id: "a1" }),
    // Com card e contato: nada a fazer.
    at({ id: "a2", pipedrive_deal_id: 200, contact_id: "c9", prospect: "Bia", empresa: "Beta" }),
    // Antes do ciclo: fora da fila.
    at({ id: "a0", registrada_em: "2026-10-01T12:00:00Z" }),
    // Cancelada: fora da fila.
    at({ id: "a3", status: "cancelada" }),
  ],
  cards: [
    card({ deal_id: 100, titulo: "Delta - Carla Dias" }),
    card({ deal_id: 200, titulo: "Beta - Bia" }),
    card({ deal_id: 300, titulo: "Gama - Davi", cargo: null }),
    card({ deal_id: 50, titulo: "Antigo", add_time: "2026-10-01T12:00:00Z" }),
  ],
  contatos: [
    {
      id: "c1",
      name: "Carla Dias",
      company: "Delta",
      user_id: "ana",
      created_at: "2026-11-24T12:00:00Z",
    },
    { id: "c2", name: "Outro", company: "X", user_id: "ana", created_at: "2026-11-25T12:00:00Z" },
    { id: "c3", name: "Zé", company: "Y", user_id: "bruno", created_at: "2026-11-24T12:00:00Z" },
    { id: "c4", name: "Velho", company: "Z", user_id: "bruno", created_at: "2026-11-10T12:00:00Z" },
  ],
  safras: [safra(1, "2026-11-09", false), safra(3, "2026-11-23")],
  alocacoes: [{ safra_id: "s3", user_id: "ana" }],
};

const r = computeConciliacao(INPUT);

describe("conciliação", () => {
  it("AT sem card, com a sugestão do card que cita a empresa", () => {
    expect(r.atsSemCard.map((a) => a.id)).toEqual(["a1"]);
    expect(r.atsSemCard[0]!.sugestao).toEqual({ id: "100", rotulo: "Delta - Carla Dias" });
  });

  it("card do outbound sem AT, só do ciclo", () => {
    expect(r.cardsSemAt.map((c) => c.deal_id).sort()).toEqual([100, 300]);
  });

  it("AT sem contato, com o contato do hunter pelo nome e pela empresa", () => {
    expect(r.atsSemContato.map((a) => a.id)).toEqual(["a1"]);
    expect(r.atsSemContato[0]!.sugestao).toEqual({ id: "c1", rotulo: "Carla Dias · Delta" });
  });

  it("contatos sem alocação só em safra que usa alocação", () => {
    // Bruno tem 1 contato na S03 sem alocação; o da S01 não conta (a S01 não usa alocação).
    expect(r.semAlocacao).toEqual([{ userId: "bruno", safraId: "s3", numero: 3, contatos: 1 }]);
  });

  it("conta as ATs sem card do ciclo (sem as de antes e as canceladas)", () => {
    expect(atsSemCard(INPUT.ats, INPUT.desde)).toBe(1);
  });

  it("conta as pendências da fila", () => {
    // 1 AT sem card + 1 AT sem contato + 2 cards sem AT + 1 sem alocação + 1 sem cargo.
    expect(pendencias(r)).toBe(6);
  });

  it("negócios sem cargo e totais da higiene", () => {
    expect(r.semCargo.map((c) => c.deal_id)).toEqual([300]);
    expect(r.totais).toEqual({ ats: 2, cards: 3 });
  });
});

describe("card da AT", () => {
  const cards = [
    card({ deal_id: 1, titulo: "[S3 - ana.souza] Delta Engenharia" }),
    card({ deal_id: 2, titulo: "Ômega Log - Paulo Reis", hunter_login: "bruno" }),
  ];

  it("acha pelo nome da empresa ou do prospect, sem acento", () => {
    expect(
      cardDaAt({ empresa: "Delta", prospect: "", hunter_login: "ana.souza" }, cards)?.deal_id,
    ).toBe(1);
    expect(
      cardDaAt({ empresa: "", prospect: "Paulo Reis", hunter_login: null }, cards)?.deal_id,
    ).toBe(2);
    expect(
      cardDaAt({ empresa: "omega log", prospect: "", hunter_login: null }, cards)?.deal_id,
    ).toBe(2);
  });

  it("não sugere card de outro hunter nem quando há dúvida", () => {
    expect(
      cardDaAt({ empresa: "Ômega", prospect: "", hunter_login: "ana.souza" }, cards),
    ).toBeNull();
    const duplicados = [...cards, card({ deal_id: 3, titulo: "Delta - outro" })];
    expect(
      cardDaAt({ empresa: "Delta", prospect: "", hunter_login: "ana.souza" }, duplicados),
    ).toBeNull();
    // "Delta" não casa com "Deltax" (palavra inteira).
    expect(cardDaAt({ empresa: "Delt", prospect: "", hunter_login: null }, cards)).toBeNull();
  });
});
