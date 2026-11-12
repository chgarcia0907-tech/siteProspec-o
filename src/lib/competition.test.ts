import { describe, expect, it } from "vitest";
import { computeCompetition, type CompContact } from "./competition";

const base = {
  sent1_at: null,
  lead_em: null,
  proposta_em: null,
  aprovacao_em: null,
  vendido_em: null,
  created_at: "2026-10-05T12:00:00Z",
};
const c = (
  user_id: string,
  at: string | null,
  reg: string | null,
  sent1 = "2026-10-05",
): CompContact =>
  ({ ...base, user_id, sent1_at: sent1, at_marcada_em: at, at_registrado_em: reg }) as CompContact;
const hunters = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
const period = { start: "2026-10-05", end: null };

describe("competição", () => {
  it("AT conta no dia do registro, não no dia da reunião", () => {
    // reunião em 15/10, registrada em 08/10 → conta na semana de 05/10
    const r = computeCompetition(
      [c("a", "2026-10-15", "2026-10-08T15:00:00Z")],
      hunters,
      period,
      "2026-10-10",
    );
    expect(r.weeks[0]!.inicio).toBe("2026-10-05");
    expect(r.rows.find((x) => x.hunter_id === "a")!.ats).toBe(1);
  });

  it("AT registrada antes de 05/10 não conta", () => {
    const r = computeCompetition(
      [c("a", "2026-10-07", "2026-10-03T15:00:00Z")],
      hunters,
      period,
      "2026-10-10",
    );
    expect(r.rows.find((x) => x.hunter_id === "a")!.ats).toBe(0);
  });

  it("+5 só para a primeira AT registrada do Hacka", () => {
    const r = computeCompetition(
      [c("a", "2026-10-06", "2026-10-07T10:00:00Z"), c("b", "2026-10-20", "2026-10-06T10:00:00Z")],
      hunters,
      period,
      "2026-10-10",
    );
    expect(r.rows.find((x) => x.hunter_id === "b")!.bonus_primeiro_at).toBe(5);
    expect(r.rows.find((x) => x.hunter_id === "a")!.bonus_primeiro_at).toBe(0);
  });

  it("proposta agendada para 30/10 pontua no dia em que foi registrada (22/10)", () => {
    const ct = {
      ...c("a", "2026-10-22", "2026-10-19T15:00:00Z"),
      lead_em: "2026-10-30",
      proposta_em: "2026-10-30",
      lead_registrado_em: "2026-10-22T11:49:00Z",
      proposta_registrado_em: "2026-10-22T11:49:00Z",
    } as CompContact;
    const r = computeCompetition(
      [ct],
      hunters,
      { start: "2026-10-05", end: "2026-10-23" },
      "2026-10-23",
    );
    const a = r.rows.find((x) => x.hunter_id === "a")!;
    expect(a.propostas).toBe(1);
    expect(a.leads).toBe(1);
  });

  it("pontuação final = 0,7 × pontos + 0,3 × taxa em número", () => {
    // 1 AT em 1 LinkedIn 1: 3 (AT) + 5 (1º AT) + 6 (semana) = 14 pts; taxa 100 → 9,8 + 30 = 39,8
    const r = computeCompetition(
      [c("a", "2026-10-15", "2026-10-08T15:00:00Z")],
      hunters,
      period,
      "2026-10-10",
    );
    const a = r.rows.find((x) => x.hunter_id === "a")!;
    expect(a.total_pontos).toBe(14);
    expect(a.pontuacao_final).toBe(39.8);
  });
});

describe("ranking semanal", () => {
  it("separa por semana, sem bônus de 1º AT e com +6 para quem fez mais ATs", async () => {
    const { computeWeekly } = await import("./competition");
    const weeks = computeWeekly(
      [
        c("a", "2026-10-27", "2026-10-27T15:00:00Z"),
        c("a", "2026-10-28", "2026-10-28T15:00:00Z"),
        c("b", "2026-11-03", "2026-11-03T15:00:00Z"),
      ],
      hunters,
      { start: "2026-10-26", end: null },
      "2026-11-06",
    );
    expect(weeks.map((w) => w.inicio)).toEqual(["2026-11-02", "2026-10-26"]);
    expect(weeks[0]!.parcial).toBe(true);
    expect(weeks[1]!.parcial).toBe(false);
    const a1 = weeks[1]!.rows.find((x) => x.hunter_id === "a")!;
    expect(a1.ats).toBe(2);
    expect(a1.bonus_primeiro_at).toBe(0);
    expect(a1.bonus_semanas).toBe(6);
    expect(weeks[0]!.rows.find((x) => x.hunter_id === "a")!.ats).toBe(0);
    expect(weeks[0]!.rows[0]!.hunter_id).toBe("b");
  });

  it("corta a semana no fim do período", async () => {
    const { computeWeekly } = await import("./competition");
    const weeks = computeWeekly(
      [c("a", "2026-10-24", "2026-10-24T15:00:00Z")],
      hunters,
      { start: "2026-10-05", end: "2026-10-23" },
      "2026-11-06",
    );
    expect(weeks[0]!.inicio).toBe("2026-10-19");
    expect(weeks[0]!.rows.find((x) => x.hunter_id === "a")!.ats).toBe(0);
    expect(weeks).toHaveLength(3);
  });
});

describe("filtro de contatos relevantes", () => {
  it("o placar com só os contatos relevantes é idêntico ao calculado com todos", async () => {
    const { computeCompetition, computeWeekly, isRelevantContact } = await import("./competition");
    const { FUNNEL } = await import("./cadencia");
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const day = (n: number) =>
      new Date(Date.UTC(2026, 8, 1) + Math.floor(n) * 86400000).toISOString().slice(0, 10);
    const ids = ["a", "b", "c", "d"];
    const all: CompContact[] = Array.from({ length: 3000 }, () => {
      const c = {
        user_id: ids[Math.floor(rnd() * ids.length)]!,
        sent1_at: rnd() < 0.7 ? day(rnd() * 90) : null,
        created_at: `${day(rnd() * 90)}T12:00:00Z`,
      } as CompContact;
      let d = rnd() * 90;
      for (const f of FUNNEL) {
        const has =
          rnd() < (f.field === "at_marcada_em" ? 0.08 : 0.5) &&
          (f.field === "at_marcada_em" || !!c.at_marcada_em);
        c[f.field] = has ? day((d += rnd() * 10)) : null;
        c[f.registeredField] = has && rnd() < 0.8 ? `${day(d - rnd() * 5)}T15:00:00Z` : null;
      }
      return c;
    });
    const hs = ids.map((id) => ({ id, name: id.toUpperCase() }));
    for (const period of [
      { start: "2026-10-01", end: null },
      { start: "2026-09-15", end: "2026-10-20" },
    ]) {
      const relevant = all.filter((c) => isRelevantContact(c, period.start));
      expect(relevant.length).toBeLessThan(all.length);
      expect(computeCompetition(relevant, hs, period, "2026-11-12")).toEqual(
        computeCompetition(all, hs, period, "2026-11-12"),
      );
      expect(computeWeekly(relevant, hs, period, "2026-11-12")).toEqual(
        computeWeekly(all, hs, period, "2026-11-12"),
      );
    }
  });

  it("o filtro do banco usa o mesmo critério", async () => {
    const { competitionFilter } = await import("./competition");
    expect(competitionFilter("2026-10-01")).toBe(
      "sent1_at.gte.2026-10-01,at_marcada_em.not.is.null,lead_em.not.is.null,proposta_em.not.is.null,aprovacao_em.not.is.null,vendido_em.not.is.null",
    );
  });
});
