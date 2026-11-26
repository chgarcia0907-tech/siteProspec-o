import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import type { SContato } from "./dashSegmentos";
import {
  computeCiclos,
  computeCurvas,
  computeResultado,
  maturacaoParaP90,
  mediana,
  percentil,
  type ResultadoInput,
  type ZAt,
  type ZCard,
} from "./dashResultado";
import type { Safra } from "./safras";

// Hoje é quarta, 02/12/2026 (semana da S04).
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
const ct = (id: string, dia: string, o: Partial<SContato> = {}): SContato => ({
  id,
  user_id: "ana",
  created_at: `${dia}T12:00:00Z`,
  company_id: null,
  job_title: "",
  headline: "",
  sector: null,
  persona: null,
  ...o,
});
const at = (id: string, o: Partial<ZAt> = {}): ZAt => ({
  id,
  user_id: "ana",
  contact_id: null,
  registrada_em: "2026-11-10T12:00:00Z",
  agendada_atual: "2026-11-12T17:00:00Z",
  status: "realizada",
  resposta_etapa: 1,
  pipedrive_stage_id: null,
  pipedrive_deal_id: null,
  ...o,
});
const card = (o: Partial<ZCard> = {}): ZCard => ({
  status: "open",
  stage_id: 31,
  valor: null,
  porte: null,
  won_time: null,
  etapas: [],
  ...o,
});

describe("mediana e percentil", () => {
  it("calcula pelo posto mais próximo", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentil([5], 90)).toBe(5);
    expect(percentil([], 90)).toBeNull();
  });

  it("maturação que cobre o P90 do contato cadastrado na sexta", () => {
    // Sexta (dia 4) + 9 dias = dia 13, último dia da semana N + 1: maturação 1 basta.
    expect(maturacaoParaP90(9)).toBe(1);
    expect(maturacaoParaP90(10)).toBe(2);
    expect(maturacaoParaP90(2)).toBe(0);
    expect(maturacaoParaP90(0)).toBe(0);
  });
});

describe("computeResultado", () => {
  const EMPRESAS = {
    e1: { sector_id: "varejo", subsector_id: null, porte: "51-200" },
    e2: { sector_id: "saude", subsector_id: null, porte: null },
  };
  const input = (o: Partial<ResultadoInput> = {}): ResultadoInput => ({
    hoje: HOJE,
    safras: SAFRAS,
    minAtsSegmento: 2,
    contatos: [
      ct("c1", "2026-11-09", { company_id: "e1", job_title: "Gerente" }),
      ct("c2", "2026-11-10", { company_id: "e1" }),
      ct("c3", "2026-11-17", { company_id: "e2", job_title: "CEO" }),
      ct("velho", "2026-10-01"),
    ],
    empresas: EMPRESAS,
    setores: { varejo: "Varejo", saude: "Saúde" },
    ats: [
      // c1: ganha por 30 mil, 18 dias depois da AT (12/11 → 30/11). Card sem porte: usa a empresa.
      at("a1", {
        contact_id: "c1",
        pipedrive_deal_id: 1,
      }),
      // c2: realizada, card na proposta (aberto), porte do card 11-50.
      at("a2", { contact_id: "c2", pipedrive_deal_id: 2 }),
      // c3: no-show, card perdido.
      at("a3", { contact_id: "c3", status: "no_show", pipedrive_deal_id: 3, resposta_etapa: null }),
      // Fora do ciclo (contato antigo, data em outubro).
      at("fora", {
        contact_id: "velho",
        agendada_atual: "2026-10-05T17:00:00Z",
        pipedrive_deal_id: 9,
      }),
      // Sem contato, mas com data no ciclo; sem card.
      at("a5", { status: "agendada", agendada_atual: "2026-12-04T17:00:00Z" }),
    ],
    cards: {
      1: card({ status: "won", stage_id: 36, valor: 30000, won_time: "2026-11-30T15:00:00Z" }),
      2: card({
        stage_id: 34,
        valor: 20000,
        porte: "11-50",
        etapas: [{ stage_id: 34, entrou_em: "2026-11-20T12:00:00Z" }],
      }),
      3: card({ status: "lost", stage_id: 108 }),
      9: card({ status: "won", valor: 99999 }),
    },
    ...o,
  });
  const r = computeResultado(input());

  it("pipeline dos cards abertos do ciclo, ganhos e perdidos", () => {
    expect(r.pipeline.find((p) => p.stageId === 34)).toMatchObject({
      nome: "Proposta Agendada",
      cards: 1,
      valor: 20000,
      semValor: 0,
    });
    expect(r.pipeline.reduce((t, p) => t + p.cards, 0)).toBe(1);
    expect(r.ganhos).toEqual({ cards: 1, valor: 30000 });
    expect(r.perdidos).toBe(1);
  });

  it("conversão de AT realizada até a venda, ticket e dias até fechar", () => {
    expect(r.conversao).toEqual({
      realizadas: 2,
      // O card 2 está em Proposta (34): também avançou.
      avancaram: 2,
      // Ganho conta como proposta; o card 2 está nela.
      proposta: 2,
      vendas: 1,
      ticket: 30000,
      diasAteFechar: 18,
      valorPorAt: 15000,
    });
  });

  it("valor esperado por AT por porte (o do card, senão o da empresa) e por setor", () => {
    expect(r.porPorte.map((l) => [l.rotulo, l.realizadas, l.vendas, l.valorPorAt])).toEqual([
      ["11 a 50 funcionários", 1, 0, 0],
      ["51 a 200 funcionários", 1, 1, 30000],
    ]);
    expect(r.porSetor).toEqual([
      expect.objectContaining({
        rotulo: "Varejo",
        realizadas: 2,
        valorPorAt: 15000,
        pequeno: false,
      }),
    ]);
  });

  it("higiene dos dados", () => {
    const h = Object.fromEntries(r.higiene.map((x) => [x.chave, x.taxa]));
    expect(h["at_contato"]).toEqual({ n: 3, d: 4 });
    expect(h["at_card"]).toEqual({ n: 3, d: 4 });
    expect(h["at_mensagem"]).toEqual({ n: 3, d: 4 });
    expect(h["card_porte"]).toEqual({ n: 2, d: 3 });
    expect(h["ganho_valor"]).toEqual({ n: 1, d: 1 });
    expect(h["contato_empresa"]).toEqual({ n: 3, d: 3 });
    expect(h["contato_cargo"]).toEqual({ n: 2, d: 3 });
  });
});

describe("computeCiclos", () => {
  it("conta pelos membros e pelas datas de cada ciclo", () => {
    const linhas = computeCiclos({
      hoje: HOJE,
      ciclos: [
        {
          id: "nov",
          nome: "Ciclo Nov",
          inicio: "2026-11-09",
          fim: null,
          ativo: true,
          membros: ["ana"],
        },
        {
          id: "out",
          nome: "Ciclo Out",
          inicio: "2026-10-01",
          fim: "2026-10-31",
          ativo: false,
          membros: ["ana", "bia"],
        },
      ],
      contatos: [
        { user_id: "ana", created_at: "2026-10-05T12:00:00Z" },
        { user_id: "bia", created_at: "2026-10-06T12:00:00Z" },
        { user_id: "ana", created_at: "2026-11-10T12:00:00Z" },
        { user_id: "bia", created_at: "2026-11-11T12:00:00Z" },
      ],
      ats: [
        at("o1", { registrada_em: "2026-10-10T12:00:00Z", pipedrive_deal_id: 1 }),
        at("n1", { registrada_em: "2026-11-12T12:00:00Z", status: "no_show" }),
        at("n2", { user_id: "bia", registrada_em: "2026-11-12T12:00:00Z" }),
      ],
      cards: { 1: card({ status: "won", valor: 5000 }) },
    });
    expect(
      linhas.map((l) => [l.nome, l.fim, l.contatos, l.ats, l.realizadas, l.vendas, l.valorGanho]),
    ).toEqual([
      ["Ciclo Out", "2026-10-31", 2, 1, 1, 1, 5000],
      ["Ciclo Nov", HOJE, 1, 1, 0, 0, 0],
    ]);
    expect(linhas[1]!.prospectAt).toEqual({ n: 1, d: 1 });
  });
});

describe("computeCurvas", () => {
  const c = computeCurvas({
    hoje: HOJE,
    safras: SAFRAS,
    contatos: [
      { id: "c1", created_at: "2026-11-09T12:00:00Z" },
      { id: "c2", created_at: "2026-11-11T12:00:00Z" },
      { id: "c3", created_at: "2026-11-15T12:00:00Z" },
      { id: "c4", created_at: "2026-11-30T12:00:00Z" },
    ],
    ats: [
      { contact_id: "c1", registrada_em: "2026-11-12T12:00:00Z" }, // 3 dias, semana 0
      { contact_id: "c1", registrada_em: "2026-11-25T12:00:00Z" }, // segunda AT: não conta
      { contact_id: "c2", registrada_em: "2026-11-20T12:00:00Z" }, // 9 dias, semana 1
      { contact_id: null, registrada_em: "2026-11-20T12:00:00Z" },
    ],
  });

  it("curva acumulada da safra, com a semana de hoje parcial", () => {
    const s1 = c.curvas.find((x) => x.numero === 1)!;
    expect(s1.contatos).toBe(3);
    expect(s1.pontos.map((p) => [p.semana, p.comAt, p.pct, p.parcial])).toEqual([
      [0, 1, 33.3, false],
      [1, 2, 66.7, false],
      [2, 2, 66.7, false],
      [3, 2, 66.7, true],
    ]);
    expect(c.curvas.find((x) => x.numero === 4)!.pontos).toHaveLength(1);
  });

  it("mapa safra × semana com as ATs registradas", () => {
    expect(c.mapa.semanas).toEqual(["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(c.mapa.linhas.find((l) => l.numero === 1)!.ats).toEqual([1, 1, 1, 0]);
  });

  it("distribuição de dias até a primeira AT, P50, P90 e a maturação sugerida", () => {
    expect(c.distribuicao.total).toBe(2);
    expect(c.distribuicao.faixas.map((f) => f.n)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(c.distribuicao).toMatchObject({ p50: 3, p90: 9, maturacaoSugerida: 1 });
  });
});
