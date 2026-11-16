import { describe, expect, it } from "vitest";
import {
  activeCycleScope,
  clampStart,
  filterByGroup,
  groupOptions,
  onlyCycleMembers,
  subgroupOptions,
} from "./ranking";

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

describe("recorte do ciclo da equipe", () => {
  const periods = [
    { id: "old", status: "closed", kind: "ciclo", started_at: "2026-10-01T03:00:00Z" },
    { id: "c1", status: "active", kind: "ciclo", started_at: "2026-11-09T03:00:00Z" },
  ];
  const members = [
    { period_id: "c1", user_id: "lais" },
    { period_id: "c1", user_id: "enzo" },
    { period_id: "old", user_id: "antigo" },
  ];

  it("usa o ciclo ativo, com início em SP e só os membros dele", () => {
    const s = activeCycleScope(periods, members)!;
    expect(s.periodId).toBe("c1");
    expect(s.start).toBe("2026-11-09");
    expect([...s.memberIds].sort()).toEqual(["enzo", "lais"]);
  });

  it("sem ciclo ativo (ou com competição ativa) não recorta nada", () => {
    expect(activeCycleScope([{ ...periods[1]!, kind: "competicao" }], members)).toBeNull();
    const rows = [{ hunter_id: "x" }];
    expect(onlyCycleMembers(rows, null)).toEqual(rows);
    expect(clampStart("2026-10-01", null)).toBe("2026-10-01");
  });

  it("filtra hunters de fora e não deixa a data começar antes do ciclo", () => {
    const s = activeCycleScope(periods, members);
    const rows = [{ hunter_id: "lais" }, { hunter_id: "antigo" }, { hunter_id: "enzo" }];
    expect(onlyCycleMembers(rows, s).map((r) => r.hunter_id)).toEqual(["lais", "enzo"]);
    expect(clampStart("2026-10-18", s)).toBe("2026-11-09");
    expect(clampStart("2026-11-16", s)).toBe("2026-11-16");
  });
});
