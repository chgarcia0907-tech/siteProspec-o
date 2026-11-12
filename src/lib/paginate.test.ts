import { describe, expect, it } from "vitest";
import { paginate } from "./paginate";

const rows = Array.from({ length: 120 }, (_, i) => i);

describe("paginação", () => {
  it("fatia a página pedida e informa o intervalo", () => {
    const p = paginate(rows, 1, 50);
    expect(p.pageRows[0]).toBe(50);
    expect([p.from, p.to, p.pageCount, p.total]).toEqual([51, 100, 3, 120]);
  });

  it("ajusta página fora do intervalo (ex.: após filtrar)", () => {
    expect(paginate(rows, 9, 50).page).toBe(2);
    expect(paginate(rows, -1, 50).page).toBe(0);
    expect(paginate([], 3, 50)).toMatchObject({ page: 0, pageCount: 1, from: 0, to: 0 });
  });
});
