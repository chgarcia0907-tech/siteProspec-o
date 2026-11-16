import { describe, expect, it } from "vitest";
import { normalizeKey } from "./cadencia";
import { buildImportRows, importPayload, importable } from "./importar";

const p = (name: string, headline: string, connected_at: string | null) => ({
  name,
  headline,
  connected_at,
});

describe("importar", () => {
  const companies = [{ id: "c-alfa", name: "Alfa" }];

  it("marca repetidos: já cadastrados e duplicados no próprio texto", () => {
    const existing = new Set([normalizeKey("Ana Souza", "CEO na Beta")]);
    const rows = buildImportRows(
      [
        p("Ana Souza", "CEO na Beta", "2026-11-10"),
        p("Bruno Lima", "Dev", "2026-11-10"),
        p("Bruno Lima", "Dev", "2026-11-10"),
      ],
      existing,
      "",
      companies,
    );
    expect(rows.map((r) => r.duplicate)).toEqual([true, false, true]);
    expect(importable(rows).map((r) => r.name)).toEqual(["Bruno Lima"]);
  });

  it("filtra pela data de conexão; sem data fica de fora quando há filtro", () => {
    const rows = buildImportRows(
      [p("A", "", "2026-11-01"), p("B", "", "2026-11-10"), p("C", "", null)],
      new Set(),
      "2026-11-05",
      companies,
    );
    expect(rows.map((r) => [r.filteredOut, r.noDate])).toEqual([
      [true, false],
      [false, false],
      [true, true],
    ]);
    const semFiltro = buildImportRows([p("C", "", null)], new Set(), "", companies);
    expect(semFiltro[0]!.filteredOut).toBe(false);
  });

  it("sugere a empresa cadastrada citada no headline e grava só ela", () => {
    const [r] = buildImportRows(
      [p("Ana", "Gerente de Operações na Alfa", "2026-11-10")],
      new Set(),
      "",
      companies,
    );
    expect(r!.suggested).toBe("c-alfa");
    expect(importPayload(r!, "c-alfa")).toEqual({
      name: "Ana",
      headline: "Gerente de Operações na Alfa",
      job_title: r!.job_title,
      connected_at: "2026-11-10",
      company_id: "c-alfa",
      // Empresa e concordância vêm do cadastro (trigger); vazias aqui só para a coluna existir.
      company: "",
      company_gender: "feminino",
      sector: r!.area ?? "",
    });
  });

  it("sem empresa escolhida, grava a empresa em texto tirada do headline", () => {
    const [r] = buildImportRows(
      [p("Otávio", "Gerente de TI na Gerdau", "2026-11-10")],
      new Set(),
      "",
      companies,
    );
    expect(r!.suggested).toBeNull();
    expect(r!.companyText).not.toBeNull();
    const payload = importPayload(r!, null);
    expect(payload).toMatchObject({
      company_id: null,
      company: r!.companyText!.company,
      company_gender: r!.companyText!.company_gender,
    });
  });

  it("lista com e sem área ou empresa: toda linha leva as mesmas colunas, sem NULL", () => {
    const rows = importable(
      buildImportRows(
        [
          p("Paula", "Gerente de Marketing no Itaú", "2026-11-10"),
          p("Sara", "Consultora", "2026-11-10"),
          p("Ana", "Gerente de Operações na Alfa", "2026-11-10"),
        ],
        new Set(),
        "",
        companies,
      ),
    );
    expect(rows[1]!.area).toBeNull();
    expect(rows[1]!.companyText).toBeNull();
    const payloads = rows.map((r) => importPayload(r, r.suggested));
    const keys = payloads.map((x) => Object.keys(x).sort().join(","));
    expect(new Set(keys).size).toBe(1);
    for (const x of payloads) {
      expect(x.sector).not.toBeNull();
      expect(x.company).not.toBeNull();
      expect(x.company_gender).not.toBeNull();
    }
    expect(payloads[1]).toMatchObject({ sector: "", company: "", company_gender: "feminino" });
  });
});
