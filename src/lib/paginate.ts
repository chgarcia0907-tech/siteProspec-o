/** Fatia de uma lista para exibição paginada (página começa em 0 e é ajustada ao intervalo). */
export function paginate<T>(rows: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * size;
  const pageRows = rows.slice(start, start + size);
  return {
    pageRows,
    page: current,
    pageCount,
    total: rows.length,
    from: rows.length ? start + 1 : 0,
    to: start + pageRows.length,
  };
}

export type Paged<T> = ReturnType<typeof paginate<T>>;
