import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import { computeAlertas, fatorQueMaisCaiu, type AlertasInput } from "./dashAlertas";
import { computeVisao, diaDoAvanco, naoRealizada, type VAt, type VisaoInput } from "./dashRitmo";
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
const ct = (id: string, dia: string) => ({ id, user_id: "ana", created_at: `${dia}T12:00:00Z` });
const CONTATOS = [
  ct("c1", "2026-11-09"),
  ct("c2", "2026-11-10"),
  ct("c3", "2026-11-11"),
  ct("c4", "2026-11-12"),
  ct("c5", "2026-11-16"),
  ct("c6", "2026-11-17"),
  ct("c7", "2026-11-23"),
  ct("c8", "2026-11-30"),
  ct("c9", "2026-12-01"),
  ct("c10", "2026-12-02"),
];
const at = (o: Partial<VAt> & Pick<VAt, "id">): VAt => ({
  user_id: "ana",
  contact_id: null,
  registrada_em: "2026-11-10T12:00:00Z",
  agendada_atual: "2026-11-12T15:00:00Z",
  status: "agendada",
  pipedrive_stage_id: null,
  pipedrive_deal_id: null,
  ...o,
});
const ATS: VAt[] = [
  // S01: realizada e avançou em 14/11 (histórico do card 1).
  at({ id: "a1", contact_id: "c1", status: "realizada", pipedrive_deal_id: 1 }),
  // S01: no-show.
  at({
    id: "a2",
    contact_id: "c2",
    registrada_em: "2026-11-11T12:00:00Z",
    agendada_atual: "2026-11-13T15:00:00Z",
    status: "no_show",
  }),
  // S01: realizada, card fora da cópia, etapa atual 33: avançou, sem data.
  at({
    id: "a7",
    contact_id: "c3",
    registrada_em: "2026-11-12T12:00:00Z",
    agendada_atual: "2026-11-14T15:00:00Z",
    status: "realizada",
    pipedrive_stage_id: 33,
    pipedrive_deal_id: 9,
  }),
  // S02: realizada, card perdido sem passar da AT Diag. Realizada.
  at({
    id: "a3",
    contact_id: "c5",
    registrada_em: "2026-11-17T12:00:00Z",
    agendada_atual: "2026-11-19T15:00:00Z",
    status: "realizada",
    pipedrive_deal_id: 2,
  }),
  // S02 (marcada na semana da S03): realizada, chegou à proposta em 30/11 e foi ganha.
  at({
    id: "a4",
    contact_id: "c6",
    registrada_em: "2026-11-24T12:00:00Z",
    agendada_atual: "2026-11-26T15:00:00Z",
    status: "realizada",
    pipedrive_deal_id: 3,
  }),
  // Sem contato: fora de cadência; cancelada.
  at({
    id: "a5",
    registrada_em: "2026-11-18T12:00:00Z",
    agendada_atual: "2026-11-20T15:00:00Z",
    status: "cancelada",
  }),
  // S04: agendada para sexta.
  at({
    id: "a6",
    contact_id: "c8",
    registrada_em: "2026-12-01T12:00:00Z",
    agendada_atual: "2026-12-05T15:00:00Z",
  }),
];
const CARDS: VisaoInput["cards"] = {
  1: {
    status: "open",
    won_time: null,
    etapas: [
      { stage_id: 108, entrou_em: "2026-11-10T12:00:00Z" },
      { stage_id: 31, entrou_em: "2026-11-12T18:00:00Z" },
      { stage_id: 33, entrou_em: "2026-11-14T12:00:00Z" },
    ],
  },
  2: {
    status: "lost",
    won_time: null,
    etapas: [
      { stage_id: 108, entrou_em: "2026-11-17T12:00:00Z" },
      { stage_id: 31, entrou_em: "2026-11-19T18:00:00Z" },
    ],
  },
  3: {
    status: "won",
    won_time: "2026-12-01T12:00:00Z",
    etapas: [
      { stage_id: 108, entrou_em: "2026-11-24T12:00:00Z" },
      { stage_id: 31, entrou_em: "2026-11-26T18:00:00Z" },
      { stage_id: 34, entrou_em: "2026-11-30T12:00:00Z" },
    ],
  },
};
const INPUT: VisaoInput = {
  hoje: HOJE,
  safras: SAFRAS,
  maturacaoSemanas: 1,
  contatos: CONTATOS,
  ats: ATS,
  cards: CARDS,
  metaAvancaram: 8,
  metaSemanalAts: 3,
};
const v = computeVisao(INPUT);

describe("visão geral", () => {
  it("data do avanço pelo histórico do card; sem cópia, sem data", () => {
    expect(diaDoAvanco(ATS[0]!, CARDS)).toBe("2026-11-14");
    expect(
      diaDoAvanco(
        ATS.find((a) => a.id === "a4")!,
        CARDS,
      ),
    ).toBe("2026-11-30");
    expect(
      diaDoAvanco(
        ATS.find((a) => a.id === "a7")!,
        CARDS,
      ),
    ).toBeNull();
    expect(
      diaDoAvanco(
        ATS.find((a) => a.id === "a3")!,
        CARDS,
      ),
    ).toBeNull();
  });

  it("não realizada: no-show, cancelada ou ainda agendada com a data passada", () => {
    expect(naoRealizada({ status: "no_show", agendada_atual: "2026-12-10T12:00:00Z" }, HOJE)).toBe(
      true,
    );
    expect(naoRealizada({ status: "agendada", agendada_atual: "2026-11-30T12:00:00Z" }, HOJE)).toBe(
      true,
    );
    expect(naoRealizada({ status: "agendada", agendada_atual: "2026-12-05T12:00:00Z" }, HOJE)).toBe(
      false,
    );
    expect(
      naoRealizada({ status: "realizada", agendada_atual: "2026-11-30T12:00:00Z" }, HOJE),
    ).toBe(false);
  });

  it("cartão central: semana atual, média das semanas fechadas, meta e esperado", () => {
    expect(v.semanaAtual).toBe("2026-11-30");
    expect(v.central).toEqual({
      semana: 1,
      mediaCiclo: 0.3,
      totalCiclo: 2,
      meta: 8,
      esperado: 8,
      semData: 1,
    });
    expect(v.metaSemanalAvancaram).toBe(2);
  });

  it("fatores: última safra madura contra a anterior; contatos pela safra da semana", () => {
    const f = Object.fromEntries(v.fatores.map((x) => [x.chave, x]));
    expect(f["contatos"]).toMatchObject({ atual: 3, anterior: 1, safras: [4, 3], variacao: 200 });
    expect(f["prospectAt"]).toMatchObject({
      atual: { n: 2, d: 2 },
      anterior: { n: 3, d: 4 },
      safras: [2, 1],
      variacao: 25,
    });
    expect(f["naoRealizadas"]).toMatchObject({ atual: { n: 0, d: 2 }, anterior: { n: 1, d: 3 } });
    expect(f["avanco"]).toMatchObject({
      atual: { n: 1, d: 2 },
      anterior: { n: 2, d: 2 },
      variacao: -50,
    });
    expect(fatorQueMaisCaiu(v.fatores)?.chave).toBe("avanco");
  });

  it("ritmo semanal com as ATs da semana pela safra de origem", () => {
    expect(
      v.ritmo.map(({ numero, marcadas, realizadas, avancaram, porSafra, futura }) => ({
        numero,
        marcadas,
        realizadas,
        avancaram,
        porSafra,
        futura,
      })),
    ).toEqual([
      { numero: 1, marcadas: 3, realizadas: 2, avancaram: 1, porSafra: { "1": 3 }, futura: false },
      {
        numero: 2,
        marcadas: 2,
        realizadas: 1,
        avancaram: 0,
        porSafra: { "2": 1, fora: 1 },
        futura: false,
      },
      { numero: 3, marcadas: 1, realizadas: 1, avancaram: 0, porSafra: { "2": 1 }, futura: false },
      { numero: 4, marcadas: 1, realizadas: 0, avancaram: 1, porSafra: { "4": 1 }, futura: false },
    ]);
  });

  it("funil do ciclo até a venda", () => {
    expect(v.funil).toEqual([
      { rotulo: "Contatos", n: 10 },
      { rotulo: "ATs marcadas", n: 6 },
      { rotulo: "Realizadas", n: 4 },
      { rotulo: "Avançaram", n: 3 },
      { rotulo: "Proposta", n: 1 },
      { rotulo: "Venda", n: 1 },
    ]);
  });
});

describe("alertas", () => {
  const esf = (pct: number) => ({ real: pct, meta: 100, pct, parcial: false, abaixo: pct < 70 });
  const base: AlertasInput = {
    hoje: HOJE,
    parametros: {
      esforco_alerta_pct: 70,
      semanas_seguidas: 2,
      concentracao_ats_pct: 30,
      nao_realizadas_pct: 15,
      dias_contato_parado: 3,
    },
    hunters: [
      { id: "ana", nome: "Ana", parados: 0 },
      { id: "bia", nome: "Bia", parados: 2 },
      { id: "caio", nome: "Caio", parados: 0 },
    ],
    esforcoSemanas: [
      { semana: "2026-11-16", numero: 2, porHunter: { ana: esf(50), bia: esf(90), caio: null } },
      { semana: "2026-11-23", numero: 3, porHunter: { ana: esf(60), bia: esf(40), caio: null } },
      // Semana atual (não fechada) não entra.
      { semana: "2026-11-30", numero: 4, porHunter: { ana: esf(10), bia: esf(10), caio: null } },
    ],
    participacao: [{ semana: "2026-11-23", total: 4, porHunter: { ana: 1, bia: 3 } }],
    ritmo: v.ritmo,
    metaSemanalAts: 3,
    fatores: v.fatores,
    ats: ATS,
    atsSemCard: 2,
  };
  const a = computeAlertas(base);
  const chaves = a.map((x) => x.chave);

  it("esforço abaixo por N semanas fechadas seguidas; sem meta não alerta", () => {
    expect(a.find((x) => x.chave === "esforco-ana")?.texto).toBe(
      "Ana: esforço abaixo de 70% da meta há 2 semanas (50% e 60%)",
    );
    expect(chaves).not.toContain("esforco-bia");
    expect(chaves).not.toContain("esforco-caio");
  });

  it("meta semanal falhou N semanas com o fator que mais caiu", () => {
    expect(a.find((x) => x.chave === "meta-semanal")?.texto).toBe(
      "Meta semanal de ATs (3) falhou 2 semanas seguidas (S02: 2; S03: 1); o fator que mais caiu foi % avanço",
    );
  });

  it("não realizadas só quando todas as N semanas passam do limite", () => {
    // S02: 1 de 2 (50%); S03: 0 de 1. Não alerta.
    expect(chaves).not.toContain("nao-realizadas");
    const tudo = computeAlertas({
      ...base,
      parametros: { ...base.parametros, semanas_seguidas: 1, nao_realizadas_pct: 15 },
      ritmo: v.ritmo.slice(0, 2),
    });
    expect(tudo.find((x) => x.chave === "nao-realizadas")?.texto).toContain("S02: 50% (1 de 2)");
    // O "Ver" leva à aba Realização e avanço.
    expect(tudo.find((x) => x.chave === "nao-realizadas")?.aba).toBe("realizacao");
  });

  it("AT sem card, concentração e parados; os de nível alto primeiro", () => {
    expect(chaves).toContain("at-sem-card");
    expect(a.find((x) => x.chave === "concentracao-bia")?.texto).toBe(
      "Bia fez 75% das ATs da equipe na semana de 23/11 (3 de 4)",
    );
    expect(chaves).not.toContain("concentracao-ana");
    expect(a.find((x) => x.chave === "parados-bia")?.texto).toBe(
      "Bia: 2 contatos parados há mais de 3 dias úteis",
    );
    const niveis = a.map((x) => x.nivel);
    expect(niveis.indexOf("media")).toBeGreaterThan(niveis.lastIndexOf("alta"));
  });
});
