import { describe, expect, it } from "vitest";
import type { Alocacao } from "./alocacao";
import { DEFAULT_OFFSETS } from "./cadencia";
import {
  computeHunters,
  metaDePassos,
  type HAt,
  type HContato,
  type HGoal,
  type HuntersInput,
} from "./dashHunters";
import type { Safra } from "./safras";

// Hoje é quinta, 26/11/2026. Safras: S01 (09/11), S02 (16/11) e S03 (23/11, a semana de hoje).
const HOJE = "2026-11-26";
const safra = (numero: number, inicio: string): Safra => ({
  id: `s${numero}`,
  period_id: "ciclo",
  numero,
  inicio,
  fim: inicio,
  usa_alocacao: numero >= 3,
});
const SAFRAS = [safra(1, "2026-11-09"), safra(2, "2026-11-16"), safra(3, "2026-11-23")];

const contato = (o: Partial<HContato> & Pick<HContato, "id" | "user_id" | "created_at">) =>
  ({
    name: o.id,
    company: "",
    company_id: null,
    connected_at: null,
    status: "aguardando",
    step1_date: null,
    sem_whatsapp: false,
    respondeu_em: null,
    resposta_etapa: null,
    at_marcada_em: null,
    sent1_at: null,
    sent2_at: null,
    sent3_at: null,
    sent4_at: null,
    sent5_at: null,
    ...o,
  }) as HContato;

const CONTATOS: HContato[] = [
  // Ana, S03: um começou a cadência na terça (conexão aceita na segunda), outro aguarda.
  contato({
    id: "c1",
    user_id: "ana",
    created_at: "2026-11-24T12:00:00Z",
    company_id: "e1",
    connected_at: "2026-11-23",
    status: "em_cadencia",
    step1_date: "2026-11-24",
    sent1_at: "2026-11-24",
  }),
  contato({ id: "c2", user_id: "ana", created_at: "2026-11-25T12:00:00Z", company_id: "e1" }),
  // Ana, S02: parou depois do LinkedIn 2 (19/11) e respondeu no LinkedIn 1.
  contato({
    id: "c3",
    user_id: "ana",
    created_at: "2026-11-17T12:00:00Z",
    company_id: "e2",
    status: "em_cadencia",
    step1_date: "2026-11-17",
    sent1_at: "2026-11-17",
    sent2_at: "2026-11-18",
    sent3_at: "2026-11-19",
  }),
  contato({
    id: "c4",
    user_id: "ana",
    created_at: "2026-11-18T12:00:00Z",
    status: "respondeu",
    step1_date: "2026-11-18",
    sent1_at: "2026-11-18",
    respondeu_em: "2026-11-20T12:00:00Z",
    resposta_etapa: 1,
  }),
  // Bruno, S03 (semana sem prospecção).
  contato({ id: "b1", user_id: "bruno", created_at: "2026-11-23T12:00:00Z" }),
];

const ATS: HAt[] = [
  // AT do contato da S02 da Ana, registrada nesta semana, realizada e já na AT de Aprofundamento.
  {
    id: "a1",
    user_id: "ana",
    contact_id: "c4",
    registrada_em: "2026-11-24T15:00:00Z",
    status: "realizada",
    pipedrive_stage_id: 33,
  },
  // AT do Bruno sem contato ligado (fora de cadência).
  {
    id: "a2",
    user_id: "bruno",
    contact_id: null,
    registrada_em: "2026-11-25T15:00:00Z",
    status: "agendada",
    pipedrive_stage_id: 108,
  },
];

const aloc = (o: Partial<Alocacao>): Alocacao => ({
  id: `al-${o.user_id}`,
  safra_id: "s3",
  user_id: "ana",
  sector_id: "varejo",
  subsector_id: null,
  dupla: "D1",
  meta_empresas: 5,
  meta_contatos: 20,
  motivo_meta_zero: null,
  vigente_desde: "2026-11-23",
  ...o,
});
const ALOCACOES = [
  aloc({ user_id: "ana" }),
  aloc({ user_id: "bruno", meta_empresas: 0, meta_contatos: 0, motivo_meta_zero: "Provas" }),
];

const GOALS: HGoal[] = [
  {
    user_id: null,
    group_id: null,
    envios_dia: null,
    l1_semana: null,
    ats_semana: 1,
    no_prazo_pct: null,
    passos_semana: 40,
  },
];

const input = (o: Partial<HuntersInput> = {}): HuntersInput => ({
  hoje: HOJE,
  semana: "2026-11-23",
  safras: SAFRAS,
  maturacaoSemanas: 3,
  diasContatoParado: 3,
  esforcoAlertaPct: 70,
  alocacoes: ALOCACOES,
  hunters: [
    { id: "ana", name: "Ana", groupId: null },
    { id: "bruno", name: "Bruno", groupId: null },
  ],
  contatos: CONTATOS,
  ats: ATS,
  goals: GOALS,
  offsets: { ana: DEFAULT_OFFSETS },
  holidays: new Set(),
  ...o,
});

const r = computeHunters(input());
const ana = r.hunters.find((h) => h.id === "ana")!;
const bruno = r.hunters.find((h) => h.id === "bruno")!;

describe("filas da semana", () => {
  it("na S03 a fila de prospecção é a S03 e a de cadência é a S02", () => {
    // Critério de aceite da spec (na S05, prospecção da S05 e cadência da S04), aqui na S03.
    expect(r.safraN?.numero).toBe(3);
    expect(r.safraAnterior?.numero).toBe(2);
    expect(r.dias).toHaveLength(7);
  });

  it("prospecção: contatos e empresas da safra, metas da alocação e conexões aceitas", () => {
    expect(ana.prospeccao).toMatchObject({
      contatos: 2,
      empresas: 1,
      contatosPorEmpresa: 2,
      conexoes: 2,
      metaEmpresas: 5,
      metaContatos: 20,
      semMeta: false,
    });
    expect(ana.prospeccao.alocacao?.sector_id).toBe("varejo");
    expect(ana.dupla).toBe("D1");
    expect(ana.parceiro).toBe("bruno");
  });

  it("cadência: contatos da S02 ainda em cadência e os parados há mais de 3 dias úteis", () => {
    expect(ana.cadencia.emCadencia).toBe(1);
    // c3: último envio 19/11; de 20/11 a 26/11 são 5 dias úteis.
    expect(ana.cadencia.parados).toEqual([
      { id: "c3", nome: "c3", empresa: "", desde: "2026-11-19", diasUteis: 5 },
    ]);
    // c3 ainda tem o LinkedIn 3 previsto nesta semana (encadeado depois do WhatsApp 2 de 20/11).
    expect(ana.cadencia.previstosSemana).toBeGreaterThan(0);
  });
});

describe("disciplina e esforço", () => {
  it("conta os passos, o mapa de calor e os dias ativos da semana", () => {
    expect(ana.disciplina.passos).toBe(1);
    expect(ana.calor).toEqual([0, 2, 1, 0, 0, 0, 0]);
    expect(ana.disciplina.diasAtivos).toBe(2);
    expect(ana.disciplina.diasUteis).toBe(4);
  });

  it("esforço combinado com meta proporcional aos dias úteis passados", () => {
    // Meta: 20 contatos + 40 passos = 60; 4 de 5 dias úteis passados = 48. Real: 2 + 1 = 3.
    expect(ana.disciplina.esforco).toEqual({
      real: 3,
      meta: 48,
      pct: 6,
      parcial: true,
      abaixo: true,
    });
  });

  it("meta zero não tem esforço (não dispara alerta)", () => {
    expect(bruno.prospeccao.semMeta).toBe(true);
    expect(bruno.disciplina.esforco).toBeNull();
  });

  it("semana passada usa a meta cheia", () => {
    const s2 = computeHunters(input({ semana: "2026-11-16" }));
    const a = s2.hunters.find((h) => h.id === "ana")!;
    expect(s2.safraN?.numero).toBe(2);
    // Sem alocação na S02 (não usa): só a meta de passos, 40, cheia.
    expect(a.disciplina.esforco).toMatchObject({ meta: 40, parcial: false });
  });

  it("participação nas ATs da semana", () => {
    expect(ana.disciplina.ats).toBe(1);
    expect(ana.disciplina.atsEquipe).toBe(2);
    expect(r.participacao.at(-1)).toEqual({
      semana: "2026-11-23",
      total: 2,
      porHunter: { ana: 1, bruno: 1 },
    });
  });
});

describe("histórico e ciclo", () => {
  it("a AT conta na safra do contato, não na semana em que foi marcada", () => {
    const s2 = ana.historico.find((x) => x.numero === 2)!;
    expect(s2).toMatchObject({
      contatos: 2,
      respostas: 1,
      ats: 1,
      realizadas: 1,
      avancaram: 1,
      status: "em_cadencia",
      madura: false,
    });
    expect(ana.historico.find((x) => x.numero === 3)!.ats).toBe(0);
  });

  it("AT sem contato não entra no histórico por safra", () => {
    expect(bruno.ciclo.ats).toBe(0);
  });

  it("totais do ciclo e respostas por canal", () => {
    expect(ana.ciclo).toMatchObject({ contatos: 4, ats: 1, realizadas: 1, avancaram: 1 });
    expect(ana.ciclo.realizadasMaduras).toBe(0);
    expect(ana.ciclo.canais).toEqual([
      { canal: "linkedin", respostas: 1, contatos: 3 },
      { canal: "whatsapp", respostas: 0, contatos: 1 },
    ]);
    expect(r.media.contatos).toBe(2.5);
  });

  it("semana fora das safras não tem filas", () => {
    const fora = computeHunters(input({ semana: "2026-11-30" }));
    expect(fora.safraN).toBeNull();
    expect(fora.hunters[0]!.prospeccao.contatos).toBe(0);
  });
});

describe("meta de passos", () => {
  it("herda do grupo e da equipe, campo a campo", () => {
    const g = (o: Partial<HGoal>): HGoal => ({
      user_id: null,
      group_id: null,
      envios_dia: null,
      l1_semana: null,
      ats_semana: null,
      no_prazo_pct: null,
      passos_semana: null,
      ...o,
    });
    const goals = [g({ passos_semana: 40 }), g({ group_id: "g1", passos_semana: 30 })];
    expect(metaDePassos(goals, "ana", "g1")).toBe(30);
    expect(metaDePassos(goals, "ana", null)).toBe(40);
    expect(metaDePassos([...goals, g({ user_id: "ana", passos_semana: 10 })], "ana", "g1")).toBe(
      10,
    );
    expect(metaDePassos([], "ana", null)).toBeNull();
  });
});
