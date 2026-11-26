import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import type { Alocacao } from "./alocacao";
import {
  computeRealizacao,
  diaEHoraSP,
  erroMetasTempo,
  faixaAntecedencia,
  horariosDaAt,
  type RAt,
  type RCard,
  type REvento,
  type RealizacaoInput,
} from "./dashRealizacao";
import type { Safra } from "./safras";

// Hoje é quarta, 02/12/2026 (semana da S04). Maturação de 1 semana: S01 e S02 maduras.
const HOJE = "2026-12-02";
const safra = (numero: number, inicio: string): Safra => ({
  id: `s${numero}`,
  period_id: "c",
  numero,
  inicio,
  fim: inicio,
  usa_alocacao: true,
  cadencia_em: addDaysISO(inicio, 7),
});
const SAFRAS = [
  safra(1, "2026-11-09"),
  safra(2, "2026-11-16"),
  safra(3, "2026-11-23"),
  safra(4, "2026-11-30"),
];
const ct = (id: string, dia: string, user_id = "ana") => ({
  id,
  user_id,
  created_at: `${dia}T12:00:00Z`,
});
const at = (o: Partial<RAt> & Pick<RAt, "id">): RAt => ({
  user_id: "ana",
  contact_id: null,
  registrada_em: "2026-11-10T12:00:00Z",
  agendada_original: "2026-11-12T17:00:00Z",
  agendada_atual: "2026-11-12T17:00:00Z",
  status: "agendada",
  pipedrive_stage_id: null,
  pipedrive_deal_id: null,
  ...o,
});
const ev = (at_id: string, evento: string, ocorrido_em: string, o: Partial<REvento> = {}) => ({
  at_id,
  evento,
  ocorrido_em,
  horario_anterior: null,
  horario_novo: null,
  ...o,
});
const card = (o: Partial<RCard> = {}): RCard => ({
  status: "open",
  stage_id: 31,
  lost_reason: null,
  won_time: null,
  etapas: [],
  ...o,
});
const aloc = (o: Partial<Alocacao> & Pick<Alocacao, "safra_id" | "user_id">): Alocacao => ({
  id: `${o.safra_id}-${o.user_id}`,
  sector_id: "varejo",
  subsector_id: null,
  dupla: null,
  meta_empresas: 5,
  meta_contatos: 40,
  motivo_meta_zero: null,
  vigente_desde: "2026-11-09",
  ...o,
});
const base = (o: Partial<RealizacaoInput> = {}): RealizacaoInput => ({
  hoje: HOJE,
  safras: SAFRAS,
  maturacaoSemanas: 1,
  contatos: [],
  ats: [],
  eventos: [],
  cards: {},
  alocacoes: [],
  setores: { varejo: "Varejo", saude: "Saúde" },
  metasTempo: { 108: 7, 31: 7, 33: 10, 34: 7, 35: 4, 36: 5 },
  ...o,
});

describe("diaEHoraSP", () => {
  it("usa o fuso de São Paulo (UTC−3)", () => {
    // Quinta, 12/11/2026, 17h UTC = 14h em SP.
    expect(diaEHoraSP("2026-11-12T17:00:00Z")).toEqual({ dia: 4, hora: 14 });
    // Sábado 01h UTC ainda é sexta 22h em SP.
    expect(diaEHoraSP("2026-11-14T01:00:00Z")).toEqual({ dia: 5, hora: 22 });
    expect(diaEHoraSP("2026-11-15T15:00:00Z").dia).toBe(7);
  });
});

describe("faixaAntecedencia", () => {
  it("separa em 0–2, 3–5, 6–10 e mais de 10 dias", () => {
    expect(faixaAntecedencia(0)).toBe("0 a 2 dias");
    expect(faixaAntecedencia(2)).toBe("0 a 2 dias");
    expect(faixaAntecedencia(3)).toBe("3 a 5 dias");
    expect(faixaAntecedencia(10)).toBe("6 a 10 dias");
    expect(faixaAntecedencia(11)).toBe("Mais de 10 dias");
  });
});

describe("horariosDaAt", () => {
  const A = at({ id: "a", agendada_original: "2026-11-10T17:00:00Z" });

  it("remarcação fecha o horário anterior e o realizado fecha o novo", () => {
    const eventos = [
      ev("a", "marcada", "2026-11-05T12:00:00Z", { horario_novo: "2026-11-10T17:00:00Z" }),
      ev("a", "remarcada", "2026-11-09T12:00:00Z", {
        horario_anterior: "2026-11-10T17:00:00Z",
        horario_novo: "2026-11-12T13:00:00Z",
      }),
      ev("a", "realizada", "2026-11-12T14:00:00Z"),
    ];
    expect(horariosDaAt({ ...A, status: "realizada" }, eventos, HOJE)).toEqual([
      { horario: "2026-11-10T17:00:00Z", desfecho: "remarcada" },
      { horario: "2026-11-12T13:00:00Z", desfecho: "realizada" },
    ]);
  });

  it("no-show seguido de remarcação conta só como no-show naquele horário", () => {
    const eventos = [
      ev("a", "no_show", "2026-11-10T18:00:00Z"),
      ev("a", "remarcada", "2026-11-10T19:00:00Z", { horario_novo: "2026-11-17T17:00:00Z" }),
    ];
    // O novo horário (17/11) já passou e continua agendado: sem desfecho.
    expect(horariosDaAt(A, eventos, HOJE)).toEqual([
      { horario: "2026-11-10T17:00:00Z", desfecho: "no_show" },
      { horario: "2026-11-17T17:00:00Z", desfecho: "sem_desfecho" },
    ]);
  });

  it("reaberta desfaz o último desfecho do mesmo horário", () => {
    const eventos = [
      ev("a", "realizada", "2026-11-10T18:00:00Z"),
      ev("a", "reaberta", "2026-11-11T12:00:00Z"),
    ];
    expect(horariosDaAt(A, eventos, "2026-11-10")).toEqual([]);
    expect(horariosDaAt(A, eventos, HOJE)).toEqual([
      { horario: "2026-11-10T17:00:00Z", desfecho: "sem_desfecho" },
    ]);
  });

  it("sem log usa o horário atual e a situação da AT; AT futura não entra", () => {
    expect(horariosDaAt({ ...A, status: "no_show" }, [], HOJE)).toEqual([
      { horario: "2026-11-12T17:00:00Z", desfecho: "no_show" },
    ]);
    expect(horariosDaAt({ ...A, agendada_atual: "2026-12-10T17:00:00Z" }, [], HOJE)).toEqual([]);
  });
});

describe("computeRealizacao", () => {
  const CONTATOS = [
    ct("c1", "2026-11-09"),
    ct("c2", "2026-11-10"),
    ct("c3", "2026-11-17"),
    ct("c4", "2026-11-24", "bia"),
    ct("velho", "2026-10-01"),
  ];
  const ATS: RAt[] = [
    // S01 (semana da data 12/11): realizada, avançou e virou proposta; marcada com 2 dias.
    at({ id: "a1", contact_id: "c1", status: "realizada", pipedrive_deal_id: 1 }),
    // S01: no-show, remarcada antes; marcada com 9 dias de antecedência.
    at({
      id: "a2",
      contact_id: "c2",
      registrada_em: "2026-11-01T12:00:00Z",
      agendada_original: "2026-11-10T17:00:00Z",
      agendada_atual: "2026-11-13T17:00:00Z",
      status: "no_show",
      pipedrive_deal_id: 2,
    }),
    // S02: agendada com a data passada (sem desfecho).
    at({
      id: "a3",
      contact_id: "c3",
      registrada_em: "2026-11-17T12:00:00Z",
      agendada_original: "2026-11-19T17:00:00Z",
      agendada_atual: "2026-11-19T17:00:00Z",
      pipedrive_deal_id: 3,
    }),
    // S04: agendada para sexta (futura); contato da Bia, setor Saúde.
    at({
      id: "a4",
      user_id: "bia",
      contact_id: "c4",
      registrada_em: "2026-11-25T12:00:00Z",
      agendada_original: "2026-12-04T17:00:00Z",
      agendada_atual: "2026-12-04T17:00:00Z",
    }),
    // Fora do ciclo: contato antigo e data antes da S01.
    at({
      id: "fora",
      contact_id: "velho",
      registrada_em: "2026-10-01T12:00:00Z",
      agendada_original: "2026-10-05T17:00:00Z",
      agendada_atual: "2026-10-05T17:00:00Z",
      status: "realizada",
    }),
    // Sem contato, mas com a data na S02: entra (fora de cadência).
    at({
      id: "a5",
      registrada_em: "2026-11-16T12:00:00Z",
      agendada_original: "2026-11-18T17:00:00Z",
      agendada_atual: "2026-11-18T17:00:00Z",
      status: "cancelada",
      pipedrive_deal_id: 5,
    }),
  ];
  const EVENTOS = [
    ev("a2", "remarcada", "2026-11-08T12:00:00Z", {
      horario_anterior: "2026-11-10T17:00:00Z",
      horario_novo: "2026-11-13T17:00:00Z",
    }),
    ev("a2", "no_show", "2026-11-13T18:00:00Z"),
  ];
  const CARDS: Record<number, RCard> = {
    1: card({
      stage_id: 34,
      etapas: [
        { stage_id: 108, entrou_em: "2026-11-10T12:00:00Z", saiu_em: "2026-11-12T19:00:00Z" },
        { stage_id: 31, entrou_em: "2026-11-12T19:00:00Z", saiu_em: "2026-11-24T12:00:00Z" },
        { stage_id: 33, entrou_em: "2026-11-24T12:00:00Z", saiu_em: "2026-11-27T12:00:00Z" },
        { stage_id: 34, entrou_em: "2026-11-27T12:00:00Z", saiu_em: null },
      ],
    }),
    2: card({
      status: "lost",
      stage_id: 108,
      lost_reason: "Não compareceu",
      etapas: [{ stage_id: 108, entrou_em: "2026-11-01T12:00:00Z", saiu_em: null }],
    }),
    3: card({
      stage_id: 108,
      etapas: [{ stage_id: 108, entrou_em: "2026-11-17T12:00:00Z", saiu_em: null }],
    }),
    5: card({ status: "lost", stage_id: 108, lost_reason: "Não compareceu" }),
  };
  const r = computeRealizacao(
    base({
      contatos: CONTATOS,
      ats: ATS,
      eventos: EVENTOS,
      cards: CARDS,
      alocacoes: [
        aloc({ safra_id: "s1", user_id: "ana" }),
        aloc({ safra_id: "s3", user_id: "bia", sector_id: "saude" }),
      ],
    }),
  );

  it("situação por semana da data da AT, com as remarcadas", () => {
    expect(r.situacao.map((s) => [s.numero, s.realizada, s.noShow, s.cancelada])).toEqual([
      [1, 1, 1, 0],
      [2, 0, 0, 1],
      [3, 0, 0, 0],
      [4, 0, 0, 0],
    ]);
    expect(r.situacao[0]!.remarcadas).toBe(1);
    expect(r.situacao[1]!.semDesfecho).toBe(1);
    expect(r.situacao[3]!.agendada).toBe(1);
    expect(r.totais).toEqual({ ats: 5, realizadas: 1, naoRealizadas: 3, avancaram: 1 });
  });

  it("horário × dia conta cada horário com desfecho (seg a sex)", () => {
    // a1 qui 14h realizada; a2 ter 14h remarcada + sex 14h no-show; a3 qui 14h sem desfecho;
    // a5 qua 14h cancelada (sem log, pela situação); a4 é futura.
    expect(r.horarios).toEqual([
      { dia: 2, hora: 14, total: 1, noShow: 0, remarcadas: 1 },
      { dia: 3, hora: 14, total: 1, noShow: 0, remarcadas: 0 },
      { dia: 4, hora: 14, total: 2, noShow: 0, remarcadas: 0 },
      { dia: 5, hora: 14, total: 1, noShow: 1, remarcadas: 0 },
    ]);
  });

  it("antecedência pela data original, só das ATs que já passaram", () => {
    expect(r.antecedencia).toEqual([
      { faixa: "0 a 2 dias", ats: 3, realizadas: 1 },
      { faixa: "3 a 5 dias", ats: 0, realizadas: 0 },
      { faixa: "6 a 10 dias", ats: 1, realizadas: 0 },
      { faixa: "Mais de 10 dias", ats: 0, realizadas: 0 },
    ]);
  });

  it("funil por setor alocado; sem alocação por último; safra imatura marcada", () => {
    expect(r.setores).toEqual([
      {
        setorId: "varejo",
        setor: "Varejo",
        contatos: 2,
        ats: 2,
        realizadas: 1,
        avancaram: 1,
        proposta: 1,
        venda: 0,
        imaturo: false,
      },
      {
        setorId: "saude",
        setor: "Saúde",
        contatos: 1,
        ats: 1,
        realizadas: 0,
        avancaram: 0,
        proposta: 0,
        venda: 0,
        imaturo: true,
      },
      {
        setorId: null,
        setor: "Sem alocação",
        contatos: 1,
        ats: 1,
        realizadas: 0,
        avancaram: 0,
        proposta: 0,
        venda: 0,
        imaturo: false,
      },
    ]);
  });

  it("motivo de perda × etapa em que o card parou", () => {
    expect(r.perdas).toEqual({
      etapas: [{ stageId: 108, nome: "AT Diag. Agendada" }],
      linhas: [{ motivo: "Não compareceu", porEtapa: { 108: 2 }, total: 2 }],
      total: 2,
    });
  });

  it("tempo por etapa em dias corridos contra a meta; aberto conta até hoje", () => {
    const t = Object.fromEntries(r.tempos.map((x) => [x.stageId, x]));
    // 108: card 1 ficou 2 dias; card 3 aberto desde 17/11 (15 dias > 7); card 2 perdido não conta.
    expect(t[108]).toMatchObject({
      passagens: 1,
      mediana: 2,
      dentroDaMeta: 1,
      abertos: 1,
      abertosAcima: 1,
    });
    // 31: 12 dias, acima da meta de 7.
    expect(t[31]).toMatchObject({ passagens: 1, mediana: 12, dentroDaMeta: 0 });
    expect(t[33]).toMatchObject({ passagens: 1, mediana: 3, dentroDaMeta: 1 });
    // 34: aberto há 5 dias, dentro da meta de 7.
    expect(t[34]).toMatchObject({ passagens: 0, mediana: null, abertos: 1, abertosAcima: 0 });
  });

  it("sem safras não quebra", () => {
    const vazio = computeRealizacao(base({ safras: [], ats: ATS, contatos: CONTATOS }));
    expect(vazio.totais.ats).toBe(0);
    expect(vazio.situacao).toEqual([]);
  });
});

describe("erroMetasTempo", () => {
  it("aceita 1 a 365 dias inteiros", () => {
    expect(erroMetasTempo({ 108: 7, 31: 365 })).toBeNull();
    expect(erroMetasTempo({ 33: 0 })).toBe(
      'A meta de "AT Aprof. Marcada" deve ser de 1 a 365 dias.',
    );
    expect(erroMetasTempo({ 34: 2.5 })).not.toBeNull();
  });
});
