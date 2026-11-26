import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import {
  PARAMETROS_PADRAO,
  codigoSafra,
  diaSP,
  erroMetasCiclo,
  erroParametros,
  erroSafra,
  inicioDaMaturidade,
  safraAnterior,
  safraEmCadencia,
  safraDaData,
  safraDoContato,
  calendarioSafras,
  cicloPadrao,
  semanaPadrao,
  semanasSugeridas,
  statusSafra,
  type Safra,
} from "./safras";

const CICLO = "c-26-2";
// 26.2: S01 começa em 09/11/2026 (segunda).
const safra = (numero: number, inicio: string, extra: Partial<Safra> = {}): Safra => ({
  id: `s${numero}`,
  period_id: CICLO,
  numero,
  inicio,
  fim: inicio.replace(/\d{2}$/, (d) => String(Number(d) + 4).padStart(2, "0")),
  usa_alocacao: true,
  cadencia_em: addDaysISO(inicio, 7),
  ...extra,
});
const S1 = safra(1, "2026-11-09", { usa_alocacao: false });
const S2 = safra(2, "2026-11-16", { usa_alocacao: false });
const S3 = safra(3, "2026-11-23");
const SAFRAS = [S1, S2, S3];

describe("código da safra", () => {
  it("junta o ciclo e o número com dois dígitos", () => {
    expect(codigoSafra("26.2", 3)).toBe("26.2-S03");
    expect(codigoSafra(" 26.2 ", 12)).toBe("26.2-S12");
  });
});

describe("safra do contato", () => {
  it("usa o dia de criação no fuso de São Paulo", () => {
    // 23/11 às 01h em UTC ainda é 22/11 (domingo) em São Paulo: fica na S02.
    expect(diaSP("2026-11-23T01:00:00Z")).toBe("2026-11-22");
    expect(safraDoContato("2026-11-23T01:00:00Z", SAFRAS)).toBe(S2);
    expect(safraDoContato("2026-11-23T12:00:00Z", SAFRAS)).toBe(S3);
  });

  it("sábado e domingo ficam na semana que começou na segunda anterior", () => {
    expect(safraDaData("2026-11-14", SAFRAS)).toBe(S1);
    expect(safraDaData("2026-11-15", SAFRAS)).toBe(S1);
  });

  it("fora de qualquer safra do ciclo não tem safra", () => {
    expect(safraDaData("2026-11-02", SAFRAS)).toBeNull();
    expect(safraDaData("2026-11-30", SAFRAS)).toBeNull();
  });

  it("contato adicionado na S03 continua na S03 mesmo com a AT marcada na S05", () => {
    // A safra sai só da criação do contato: a data da AT não entra na conta.
    expect(safraDoContato("2026-11-25T15:00:00Z", SAFRAS)?.numero).toBe(3);
  });
});

describe("status da safra", () => {
  const m = PARAMETROS_PADRAO.maturacao_semanas; // 3

  it("passa por planejada, prospecção, cadência, maturação e madura", () => {
    expect(statusSafra(S3, "2026-11-20", m)).toBe("planejada");
    expect(statusSafra(S3, "2026-11-23", m)).toBe("em_prospeccao");
    expect(statusSafra(S3, "2026-11-29", m)).toBe("em_prospeccao"); // domingo ainda é N
    expect(statusSafra(S3, "2026-11-30", m)).toBe("em_cadencia"); // N+1
    expect(statusSafra(S3, "2026-12-06", m)).toBe("em_cadencia");
    expect(statusSafra(S3, "2026-12-07", m)).toBe("em_maturacao"); // N+2
    expect(statusSafra(S3, "2026-12-20", m)).toBe("em_maturacao"); // fim de N+3
    expect(statusSafra(S3, "2026-12-21", m)).toBe("madura"); // N+4
  });

  it("S03 vista na semana da S05 está em maturação", () => {
    expect(statusSafra(S3, "2026-12-09", m)).toBe("em_maturacao");
  });

  it("a janela é configurável", () => {
    expect(inicioDaMaturidade(S1, 3)).toBe("2026-12-07");
    expect(inicioDaMaturidade(S1, 1)).toBe("2026-11-23");
    expect(statusSafra(S1, "2026-11-23", 1)).toBe("madura");
    // Janela zero: madura logo depois da semana da cadência (nunca antes de ela terminar).
    expect(statusSafra(S1, "2026-11-16", 0)).toBe("em_cadencia");
    expect(statusSafra(S1, "2026-11-23", 0)).toBe("madura");
  });
});

describe("26.2: prospecção e cadência na mesma semana e semana de provas", () => {
  const m = 3;
  // S01 e S02 com a cadência na própria semana; S03 com a cadência em 07/12 (30/11 = provas).
  const R1 = safra(1, "2026-11-09", { cadencia_em: "2026-11-09" });
  const R2 = safra(2, "2026-11-16", { cadencia_em: "2026-11-16" });
  const R3 = safra(3, "2026-11-23", { cadencia_em: "2026-12-07" });
  const R4 = safra(4, "2026-12-07");

  it("safra de mesma semana: prospecção e cadência juntas e madura contando da cadência", () => {
    expect(statusSafra(R1, "2026-11-10", m)).toBe("em_prospeccao_cadencia");
    expect(statusSafra(R1, "2026-11-16", m)).toBe("em_maturacao");
    expect(inicioDaMaturidade(R1, m)).toBe("2026-11-30");
    expect(statusSafra(R1, "2026-11-30", m)).toBe("madura");
    expect(inicioDaMaturidade(R2, m)).toBe("2026-12-07");
  });

  it("a semana de provas empurra a cadência, mas conta na maturação", () => {
    expect(statusSafra(R3, "2026-11-25", m)).toBe("em_prospeccao");
    expect(statusSafra(R3, "2026-12-01", m)).toBe("aguardando_cadencia");
    expect(statusSafra(R3, "2026-12-08", m)).toBe("em_cadencia");
    expect(statusSafra(R3, "2026-12-14", m)).toBe("em_maturacao");
    expect(inicioDaMaturidade(R3, m)).toBe("2026-12-21");
  });

  it("nunca amadurece antes do fim da semana da cadência", () => {
    expect(inicioDaMaturidade(R3, 0)).toBe("2026-12-14");
    expect(inicioDaMaturidade(R1, 0)).toBe("2026-11-16");
  });

  it("safra em cadência na semana", () => {
    const todas = [R1, R2, R3, R4];
    expect(safraEmCadencia("2026-11-18", todas)).toBe(R2);
    expect(safraEmCadencia("2026-11-30", todas)).toBeNull();
    expect(safraEmCadencia("2026-12-07", todas)).toBe(R3);
    expect(safraEmCadencia("2026-12-14", todas)).toBe(R4);
  });
});

describe("safra anterior", () => {
  it("é a de número imediatamente menor no ciclo", () => {
    expect(safraAnterior(S3, SAFRAS)).toBe(S2);
    expect(safraAnterior(S1, SAFRAS)).toBeNull();
  });
});

describe("validação da safra", () => {
  const nova = {
    numero: 4,
    inicio: "2026-11-30",
    fim: "2026-12-04",
    usa_alocacao: true,
    cadencia_em: "2026-12-07",
  };

  it("aceita a próxima semana do ciclo", () => {
    expect(erroSafra(nova, CICLO, SAFRAS)).toBeNull();
  });

  it("exige segunda-feira e fim na mesma semana", () => {
    expect(erroSafra({ ...nova, inicio: "2026-12-01" }, CICLO, SAFRAS)).toMatch(/segunda/);
    expect(erroSafra({ ...nova, fim: "2026-11-29" }, CICLO, SAFRAS)).toMatch(/mesma semana/);
    expect(erroSafra({ ...nova, fim: "2026-12-07" }, CICLO, SAFRAS)).toMatch(/mesma semana/);
    expect(erroSafra({ ...nova, fim: "2026-12-06" }, CICLO, SAFRAS)).toBeNull();
  });

  it("não repete número no ciclo nem semana em qualquer ciclo", () => {
    expect(erroSafra({ ...nova, numero: 3 }, CICLO, SAFRAS)).toBe("Já existe a S03 neste ciclo.");
    expect(
      erroSafra({ ...nova, inicio: "2026-11-16", fim: "2026-11-20" }, "outro-ciclo", SAFRAS),
    ).toMatch(/semana de 16\/11/);
    // O mesmo número em outro ciclo é permitido.
    expect(erroSafra({ ...nova, numero: 3 }, "outro-ciclo", SAFRAS)).toBeNull();
    expect(erroSafra({ ...nova, inicio: "2026-11-23", fim: "2026-11-27" }, CICLO, SAFRAS)).toBe(
      "Já existe uma safra na semana de 23/11/2026.",
    );
  });

  it("a cadência é uma segunda, da semana da safra até 4 semanas depois", () => {
    expect(erroSafra({ ...nova, cadencia_em: "2026-11-30" }, CICLO, SAFRAS)).toBeNull();
    expect(erroSafra({ ...nova, cadencia_em: "2026-12-28" }, CICLO, SAFRAS)).toBeNull();
    for (const cadencia_em of ["2026-11-23", "2026-12-08", "2027-01-04"])
      expect(erroSafra({ ...nova, cadencia_em }, CICLO, SAFRAS)).toMatch(/cadência/);
  });

  it("rejeita número inválido e datas vazias", () => {
    expect(erroSafra({ ...nova, numero: 0 }, CICLO, SAFRAS)).toMatch(/número/);
    expect(erroSafra({ ...nova, inicio: "" }, CICLO, SAFRAS)).toMatch(/início/);
  });
});

describe("semanas sugeridas", () => {
  it("gera de segunda a sexta desde o início do ciclo", () => {
    // Ciclo começando numa quarta: a S01 é a semana dessa quarta.
    expect(semanasSugeridas("2026-11-11", "2026-11-23", [], CICLO)).toEqual([
      {
        numero: 1,
        inicio: "2026-11-09",
        fim: "2026-11-13",
        usa_alocacao: true,
        cadencia_em: "2026-11-16",
      },
      {
        numero: 2,
        inicio: "2026-11-16",
        fim: "2026-11-20",
        usa_alocacao: true,
        cadencia_em: "2026-11-23",
      },
      {
        numero: 3,
        inicio: "2026-11-23",
        fim: "2026-11-27",
        usa_alocacao: true,
        cadencia_em: "2026-11-30",
      },
    ]);
  });

  it("continua a numeração depois das safras que já existem", () => {
    expect(
      semanasSugeridas("2026-11-09", "2026-12-07", SAFRAS, CICLO).map((s) => s.numero),
    ).toEqual([4, 5]);
  });

  it("26.2: mesma semana em S01 e S02, provas em 30/11 e a cadência da S03 na semana seguinte", () => {
    const geradas = semanasSugeridas("2026-11-09", "2026-12-14", [], CICLO, {
      pausas: ["2026-11-30"],
      mesmaSemana: ["2026-11-09", "2026-11-16"],
    });
    expect(geradas.map((s) => [s.numero, s.inicio, s.cadencia_em])).toEqual([
      [1, "2026-11-09", "2026-11-09"],
      [2, "2026-11-16", "2026-11-16"],
      [3, "2026-11-23", "2026-12-07"],
      [4, "2026-12-07", "2026-12-14"],
      [5, "2026-12-14", "2026-12-21"],
    ]);
  });

  it("pula semanas ocupadas por outro ciclo", () => {
    const outro = { period_id: "outro", numero: 1, inicio: "2026-11-16" };
    expect(
      semanasSugeridas("2026-11-09", "2026-11-23", [outro], CICLO).map((s) => s.inicio),
    ).toEqual(["2026-11-09", "2026-11-23"]);
  });
});

describe("parâmetros e metas do ciclo", () => {
  it("os padrões são válidos", () => {
    expect(erroParametros(PARAMETROS_PADRAO)).toBeNull();
  });

  it("recusa valor fora da faixa ou faixas de avanço invertidas", () => {
    expect(erroParametros({ ...PARAMETROS_PADRAO, esforco_alerta_pct: 120 })).toMatch(
      /Alerta de esforço/,
    );
    expect(erroParametros({ ...PARAMETROS_PADRAO, maturacao_semanas: 1.5 })).toMatch(/inteiro/);
    expect(erroParametros({ ...PARAMETROS_PADRAO, avanco_troca_pct: 60 })).toMatch(/trocar/);
  });

  it("metas do ciclo aceitam vazio e recusam negativo", () => {
    const vazias = {
      ats_avancaram: null,
      ats_marcadas: null,
      ats_realizadas: null,
      contatos: null,
      vendas: null,
    };
    expect(erroMetasCiclo(vazias)).toBeNull();
    expect(erroMetasCiclo({ ...vazias, ats_avancaram: 40 })).toBeNull();
    expect(erroMetasCiclo({ ...vazias, vendas: -1 })).toMatch(/Vendas/);
  });
});

describe("calendário de safras", () => {
  it("vai da primeira safra até a semana em que a última amadurece", () => {
    const cal = calendarioSafras(SAFRAS, "2026-11-26", 3);
    expect(cal.semanas.at(0)).toBe("2026-11-09");
    expect(cal.semanas.at(-1)).toBe("2026-12-21"); // S03 madura a partir de 21/12
    expect(cal.semanaAtual).toBe("2026-11-23");
  });

  it("cada linha é a escada de fases da safra, com o status de hoje", () => {
    const cal = calendarioSafras(SAFRAS, "2026-11-26", 3);
    const fases = (n: number) =>
      cal.linhas.find((l) => l.safra.numero === n)!.celulas.map((c) => c.fase);
    expect(fases(1)).toEqual([
      "em_prospeccao",
      "em_cadencia",
      "em_maturacao",
      "em_maturacao",
      "madura",
      "madura",
      "madura",
    ]);
    expect(fases(3).slice(0, 3)).toEqual([null, null, "em_prospeccao"]);
    expect(cal.linhas.map((l) => l.status)).toEqual([
      "em_maturacao",
      "em_cadencia",
      "em_prospeccao",
    ]);
  });

  it("marca as semanas futuras e corta as colunas mais antigas", () => {
    const cal = calendarioSafras(SAFRAS, "2026-11-26", 3, 4);
    expect(cal.semanas).toEqual(["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21"]);
    expect(cal.linhas[0]!.celulas.every((c) => c.futura)).toBe(true);
  });

  it("sem safras, sem colunas", () => {
    expect(calendarioSafras([], "2026-11-26", 3).semanas).toEqual([]);
  });
});

describe("ciclo padrão", () => {
  it("prefere o ativo, senão o mais recente", () => {
    const a = { id: "a", status: "closed", started_at: "2026-07-01" };
    const b = { id: "b", status: "closed", started_at: "2026-11-09" };
    const c = { id: "c", status: "active", started_at: "2026-03-01" };
    expect(cicloPadrao([a, b, c])).toBe(c);
    expect(cicloPadrao([a, b])).toBe(b);
    expect(cicloPadrao([])).toBeNull();
  });
});

describe("semana padrão", () => {
  it("a de hoje, senão a última que começou, senão a primeira", () => {
    expect(semanaPadrao(SAFRAS, "2026-11-25")).toBe("2026-11-23");
    expect(semanaPadrao(SAFRAS, "2026-12-10")).toBe("2026-11-23");
    expect(semanaPadrao(SAFRAS, "2026-11-01")).toBe("2026-11-09");
    expect(semanaPadrao([], "2026-11-25")).toBeNull();
  });
});
