// Busca todas as linhas paginando com .range() (o banco limita 1.000 por consulta).
const PAGE = 1000;

/** Resultado de uma página; use para tipar consultas com `select` montado dinamicamente. */
export type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
