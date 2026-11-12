// Filtros do placar da competição por grupo e subgrupo (usados na tela de ranking).

type Grouped = { grupo: string; subgrupo: string };

/** Valor do filtro de grupo: "todos", "sem" (sem grupo) ou o nome do grupo. */
export type GroupFilter = "todos" | "sem" | (string & {});

export function groupOptions(rows: Grouped[]): string[] {
  return [...new Set(rows.map((r) => r.grupo).filter(Boolean))].sort();
}

export function subgroupOptions(rows: Grouped[], grupo: GroupFilter): string[] {
  return [
    ...new Set(
      rows
        .filter((r) => grupo === "todos" || r.grupo === grupo)
        .map((r) => r.subgrupo)
        .filter(Boolean),
    ),
  ].sort();
}

export function filterByGroup<T extends Grouped>(
  rows: T[],
  grupo: GroupFilter,
  subgrupo: string,
): T[] {
  return rows.filter(
    (r) =>
      (grupo === "todos" || (grupo === "sem" ? !r.grupo : r.grupo === grupo)) &&
      (subgrupo === "todos" || r.subgrupo === subgrupo),
  );
}
