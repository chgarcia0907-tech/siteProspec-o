import { describe, expect, it } from "vitest";
import { STEPS } from "./cadencia";
import {
  cadenceGaps,
  groupByWeek,
  matchCompany,
  missingSteps,
  normalizeCompany,
  parseCompanyLines,
  parseSectorOption,
  personaFilled,
  sectorOptions,
  sectorPath,
  sortSectors,
  subsectorsOf,
  topSectors,
  weekEndISO,
  weekStartISO,
  type SectorCadences,
  type SectorNode,
} from "./empresas";
import { pickTemplate } from "./fila";

describe("semana de prospecção", () => {
  it("começa na segunda-feira", () => {
    expect(weekStartISO("2026-11-13")).toBe("2026-11-09"); // sexta
    expect(weekStartISO("2026-11-09")).toBe("2026-11-09"); // segunda
    expect(weekStartISO("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(weekStartISO("2026-11-16")).toBe("2026-11-16");
  });
  it("vira o mês e termina no domingo", () => {
    expect(weekStartISO("2026-12-02")).toBe("2026-11-30");
    expect(weekEndISO("2026-11-30")).toBe("2026-12-06");
  });
});

describe("nomes de empresa", () => {
  it("normaliza acentos, caixa e pontuação", () => {
    expect(normalizeCompany("  Açúcar  Guarani S.A. ")).toBe("acucar guarani s a");
    expect(normalizeCompany("P&G")).toBe("p&g");
  });
  it("lê várias linhas sem vazios nem repetidos", () => {
    expect(parseCompanyLines("Ambev\n\n  Natura ;AMBEV\nItaú  Unibanco")).toEqual([
      "Ambev",
      "Natura",
      "Itaú Unibanco",
    ]);
  });
});

describe("sugestão de empresa pelo LinkedIn", () => {
  const cos = [
    { id: "1", name: "Itaú" },
    { id: "2", name: "Itaú Unibanco" },
    { id: "3", name: "Vale" },
  ];
  it("acha a empresa como palavra inteira e prefere a mais específica", () => {
    expect(matchCompany("Gerente de TI no Itaú Unibanco", cos)?.id).toBe("2");
    expect(matchCompany("Analista | ITAU", cos)?.id).toBe("1");
    expect(matchCompany("Diretor na Vale S.A.", cos)?.id).toBe("3");
  });
  it("não casa pedaço de palavra nem texto vazio", () => {
    expect(matchCompany("Especialista em Valuation", cos)).toBeNull();
    expect(matchCompany("", cos)).toBeNull();
  });
});

describe("agrupamentos", () => {
  it("agrupa por semana, mais recente primeiro", () => {
    const g = groupByWeek([
      { name: "B", week_start: "2026-11-02" },
      { name: "C", week_start: "2026-11-09" },
      { name: "A", week_start: "2026-11-02" },
    ]);
    expect(g.map((x) => x.week)).toEqual(["2026-11-09", "2026-11-02"]);
    expect(g[1]!.companies.map((c) => c.name)).toEqual(["A", "B"]);
  });
  it("ordena setores pela ordem e depois pelo nome", () => {
    expect(
      sortSectors([
        { name: "Varejo", sort: 1 },
        { name: "Agro", sort: 1 },
        { name: "Saúde", sort: 0 },
      ]).map((s) => s.name),
    ).toEqual(["Saúde", "Agro", "Varejo"]);
  });
});

describe("modelo da etapa", () => {
  const defaults = { 1: { code: "IN01", body: "padrão 1" }, 2: { code: "WT01", body: "padrão 2" } };
  const bySector = {
    varejo: { 1: { code: "VAR1", body: "varejo 1" }, 2: { code: "VAR2", body: "  " } },
  };
  it("usa a cadência do setor quando a etapa tem mensagem", () => {
    expect(pickTemplate(STEPS[0]!, "varejo", bySector, defaults)).toEqual({
      code: "VAR1",
      body: "varejo 1",
      fromSector: true,
    });
  });
  it("cai no padrão sem setor, sem cadência ou com mensagem vazia", () => {
    expect(pickTemplate(STEPS[0]!, null, bySector, defaults)?.code).toBe("IN01");
    expect(pickTemplate(STEPS[0]!, "saude", bySector, defaults)?.code).toBe("IN01");
    expect(pickTemplate(STEPS[1]!, "varejo", bySector, defaults)).toMatchObject({
      code: "WT01",
      fromSector: false,
    });
  });
  it("sem modelo nenhum devolve null", () => {
    expect(pickTemplate(STEPS[2]!, "varejo", bySector, defaults)).toBeNull();
  });
  it("aponta as etapas que faltam na cadência do setor", () => {
    expect(missingSteps(bySector.varejo, STEPS).map((s) => s.n)).toEqual([2, 3, 4, 5]);
    expect(missingSteps(undefined, STEPS)).toHaveLength(5);
  });
});

describe("setor e subsetor", () => {
  const node = (
    id: string,
    name: string,
    parent_id: string | null = null,
    over: Partial<SectorNode> = {},
  ): SectorNode => ({ id, name, parent_id, active: true, sort: 0, ...over });
  const sectors = [
    node("ind", "Indústria"),
    node("var", "Varejo", null, { sort: 1 }),
    node("met", "Metalurgia", "ind"),
    node("alm", "Alimentos", "ind", { active: false }),
    node("inat", "Agro", null, { active: false }),
  ];

  it("separa setores de primeiro nível e subsetores", () => {
    expect(topSectors(sectors).map((s) => s.id)).toEqual(["inat", "ind", "var"]);
    expect(subsectorsOf(sectors, "ind").map((s) => s.id)).toEqual(["alm", "met"]);
    expect(subsectorsOf(sectors, "var")).toEqual([]);
  });

  it("monta o nome com o caminho", () => {
    expect(sectorPath(sectors, "ind", "met")).toBe("Indústria › Metalurgia");
    expect(sectorPath(sectors, "ind", null)).toBe("Indústria");
    expect(sectorPath(sectors, "ind")).toBe("Indústria");
    expect(sectorPath(sectors, "sumiu", "met")).toBe("");
    expect(sectorPath(sectors, null)).toBe("");
  });

  it("opções do seletor: só ativos, setor sozinho antes dos subsetores", () => {
    expect(sectorOptions(sectors).map((o) => o.value)).toEqual(["ind", "ind:met", "var"]);
    expect(sectorOptions(sectors)[1]).toMatchObject({
      label: "Metalurgia",
      group: "Indústria",
      sectorId: "ind",
      subsectorId: "met",
    });
  });

  it("o valor atual aparece mesmo inativo", () => {
    expect(
      sectorOptions(sectors, { sectorId: "ind", subsectorId: "alm" }).map((o) => o.value),
    ).toEqual(["ind", "ind:alm", "ind:met", "var"]);
    expect(sectorOptions(sectors, { sectorId: "inat" }).map((o) => o.value)).toEqual([
      "inat",
      "ind",
      "ind:met",
      "var",
    ]);
  });

  it("decodifica o valor da opção", () => {
    expect(parseSectorOption("ind")).toEqual({ sectorId: "ind", subsectorId: null });
    expect(parseSectorOption("ind:met")).toEqual({ sectorId: "ind", subsectorId: "met" });
    expect(parseSectorOption("")).toBeNull();
  });
});

describe("cadências por persona", () => {
  const t = (code: string) => ({ code, body: code });
  const cadences: SectorCadences = {
    ind: {
      "": { 1: t("a"), 2: t("b") },
      owner_operacao: { 1: t("c"), 3: { code: "", body: " " } },
    },
    met: { "": { 3: t("d") } },
  };

  it("aponta as etapas sem mensagem em qualquer persona; o subsetor herda do setor", () => {
    expect(cadenceGaps(cadences, "ind", null).map((s) => s.n)).toEqual([3, 4, 5]);
    expect(cadenceGaps(cadences, "ind", "met").map((s) => s.n)).toEqual([4, 5]);
    expect(cadenceGaps(undefined, "ind", "met")).toHaveLength(STEPS.length);
  });

  it("conta as etapas preenchidas por persona", () => {
    expect(personaFilled(cadences, "ind", "")).toBe(2);
    expect(personaFilled(cadences, "ind", "owner_operacao")).toBe(1);
    expect(personaFilled(cadences, "ind", "owner_tecnologia")).toBe(0);
    expect(personaFilled(undefined, "ind", "")).toBe(0);
  });
});
