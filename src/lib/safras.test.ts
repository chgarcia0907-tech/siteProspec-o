import { describe, expect, it } from "vitest";
import {
  PARAMETROS_PADRAO,
  codigoSafra,
  diaSP,
  erroMetasCiclo,
  erroParametros,
  erroSafra,
  inicioDaMaturidade,
  safraAnterior,
  safraDaData,
  safraDoContato,
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
    // Janela zero: madura logo depois da semana de prospecção.
    expect(statusSafra(S1, "2026-11-16", 0)).toBe("madura");
  });
});

describe("safra anterior", () => {
  it("é a de número imediatamente menor no ciclo", () => {
    expect(safraAnterior(S3, SAFRAS)).toBe(S2);
    expect(safraAnterior(S1, SAFRAS)).toBeNull();
  });
});

describe("validação da safra", () => {
  const nova = { numero: 4, inicio: "2026-11-30", fim: "2026-12-04", usa_alocacao: true };

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

  it("rejeita número inválido e datas vazias", () => {
    expect(erroSafra({ ...nova, numero: 0 }, CICLO, SAFRAS)).toMatch(/número/);
    expect(erroSafra({ ...nova, inicio: "" }, CICLO, SAFRAS)).toMatch(/início/);
  });
});

describe("semanas sugeridas", () => {
  it("gera de segunda a sexta desde o início do ciclo", () => {
    // Ciclo começando numa quarta: a S01 é a semana dessa quarta.
    expect(semanasSugeridas("2026-11-11", "2026-11-23", [], CICLO)).toEqual([
      { numero: 1, inicio: "2026-11-09", fim: "2026-11-13", usa_alocacao: true },
      { numero: 2, inicio: "2026-11-16", fim: "2026-11-20", usa_alocacao: true },
      { numero: 3, inicio: "2026-11-23", fim: "2026-11-27", usa_alocacao: true },
    ]);
  });

  it("continua a numeração depois das safras que já existem", () => {
    expect(
      semanasSugeridas("2026-11-09", "2026-12-07", SAFRAS, CICLO).map((s) => s.numero),
    ).toEqual([4, 5]);
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
