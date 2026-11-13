import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

const table = (n: number) => Array.from({ length: n }, (_, i) => i);
function source(rows: number[]) {
  const calls: number[] = [];
  const page = (from: number, to: number) => {
    calls.push(from);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { page, calls };
}

describe("fetchAll", () => {
  it("tabela pequena: uma única consulta", async () => {
    const s = source(table(10));
    expect(await fetchAll(s.page)).toEqual(table(10));
    expect(s.calls).toEqual([0]);
  });

  it("tabela grande: traz tudo, em ordem, com as páginas seguintes em paralelo", async () => {
    for (const n of [1000, 1001, 4999, 5000, 5001, 12345]) {
      const s = source(table(n));
      expect(await fetchAll(s.page)).toEqual(table(n));
    }
  });

  it("propaga o erro de qualquer página", async () => {
    const page = (from: number) =>
      Promise.resolve(
        from === 2000
          ? { data: null, error: new Error("falhou") }
          : { data: table(1000), error: null },
      );
    await expect(fetchAll(page)).rejects.toThrow("falhou");
  });
});
