import { describe, expect, it } from "vitest";
import { filterByGroup, groupOptions, subgroupOptions } from "./ranking";

const rows = [
  { id: 1, grupo: "Azul", subgrupo: "A1" },
  { id: 2, grupo: "Azul", subgrupo: "" },
  { id: 3, grupo: "Verde", subgrupo: "V1" },
  { id: 4, grupo: "", subgrupo: "" },
];

describe("filtros do ranking por grupo", () => {
  it("lista grupos e subgrupos sem vazios, em ordem", () => {
    expect(groupOptions(rows)).toEqual(["Azul", "Verde"]);
    expect(subgroupOptions(rows, "todos")).toEqual(["A1", "V1"]);
    expect(subgroupOptions(rows, "Azul")).toEqual(["A1"]);
  });

  it("filtra por grupo, por 'sem grupo' e por subgrupo", () => {
    const ids = (g: string, s = "todos") => filterByGroup(rows, g, s).map((r) => r.id);
    expect(ids("todos")).toEqual([1, 2, 3, 4]);
    expect(ids("Azul")).toEqual([1, 2]);
    expect(ids("sem")).toEqual([4]);
    expect(ids("Azul", "A1")).toEqual([1]);
  });
});
