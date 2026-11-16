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

// Recorte do ciclo da equipe: as métricas de atividade mostram só os membros do ciclo ativo
// e só a partir do início dele. Nada é apagado; quem está fora continua em "Todos os hunters".

type PeriodLite = { id: string; status: string; kind: string; started_at: string };
type MemberLite = { period_id: string; user_id: string };

export type CycleScope = { periodId: string; start: string; memberIds: Set<string> };

const spDay = (ts: string) =>
  new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Ciclo ativo (kind 'ciclo') com data de início (em SP) e membros; null se não houver. */
export function activeCycleScope(periods: PeriodLite[], members: MemberLite[]): CycleScope | null {
  const p = periods.find((x) => x.status === "active" && x.kind === "ciclo");
  if (!p) return null;
  return {
    periodId: p.id,
    start: spDay(p.started_at),
    memberIds: new Set(members.filter((m) => m.period_id === p.id).map((m) => m.user_id)),
  };
}

/** Data inicial efetiva: nunca antes do início do ciclo. */
export function clampStart(start: string, scope: CycleScope | null): string {
  return scope && scope.start > start ? scope.start : start;
}

/** Mantém só as linhas de hunters do ciclo (sem ciclo, devolve tudo). */
export function onlyCycleMembers<T extends { hunter_id: string }>(
  rows: T[],
  scope: CycleScope | null,
): T[] {
  return scope ? rows.filter((r) => scope.memberIds.has(r.hunter_id)) : rows;
}
