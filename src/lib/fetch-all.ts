// Busca todas as linhas paginando com .range() (o banco limita 1.000 por consulta).
const PAGE = 1000;
/** Páginas pedidas ao mesmo tempo depois da primeira (tabelas grandes). */
const PARALLEL = 4;

/** Resultado de uma página; use para tipar consultas com `select` montado dinamicamente. */
export type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * A primeira página vai sozinha (a maioria das tabelas cabe nela). Se vier cheia, as seguintes
 * são pedidas em lotes paralelos, mantendo a ordem; para na primeira página incompleta.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const take = async (from: number) => {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    return data ?? [];
  };
  const out = await take(0);
  if (out.length < PAGE) return out;
  for (let from = PAGE; ; from += PAGE * PARALLEL) {
    const batch = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => take(from + i * PAGE)),
    );
    for (const rows of batch) {
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }
}
