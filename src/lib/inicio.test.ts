import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, STEPS, type Contact } from "./cadencia";
import type { DashGoal } from "./dashboard";
import { buildQueues } from "./fila";
import {
  atSlots,
  conversion,
  lateRows,
  shortWeekday,
  teamWeekGoal,
  undatedL1,
  weekAts,
  weekOf,
} from "./inicio";

let id = 0;
const c = (over: Partial<Contact>) =>
  ({
    id: String(++id),
    user_id: "eu",
    name: `C${id}`,
    company: "Empresa",
    sector: "Indústria",
    job_title: "CEO",
    status: "aguardando",
    step1_date: null,
    sent1_at: null,
    sent2_at: null,
    sent3_at: null,
    sent4_at: null,
    sent5_at: null,
    at_marcada_em: null,
    at_registrado_em: null,
    ...over,
  }) as Contact;

const TODAY = "2026-11-12"; // quinta-feira
const WEEK = weekOf(TODAY);

const goal = (over: Partial<DashGoal>): DashGoal => ({
  user_id: null,
  group_id: null,
  envios_dia: null,
  l1_semana: null,
  ats_semana: null,
  no_prazo_pct: null,
  ...over,
});

describe("semana", () => {
  it("vai de segunda a domingo", () => {
    expect(weekOf(TODAY)).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(weekOf("2026-11-15")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(shortWeekday("2026-11-09")).toBe("seg 09");
  });
});

describe("ATs da semana", () => {
  const team = new Set(["eu", "ana"]);

  it("conta pela data de registro, só da equipe, e esconde a empresa das ATs dos outros", () => {
    const ats = weekAts(
      [
        // Registrada nesta semana para uma reunião na outra: conta nesta.
        c({
          company: "Delta",
          at_marcada_em: "2026-11-20",
          at_registrado_em: "2026-11-10T13:00:00Z",
        }),
        c({ user_id: "ana", company: "Zeta", at_marcada_em: "2026-11-09" }),
        // Registrada na semana anterior: fora.
        c({ at_marcada_em: "2026-11-10", at_registrado_em: "2026-11-06T13:00:00Z" }),
        // Hunter fora da equipe do ciclo: fora.
        c({ user_id: "outro", at_marcada_em: "2026-11-11" }),
      ],
      team,
      "eu",
      WEEK,
    );
    expect(ats).toEqual([
      { day: "2026-11-09", mine: false, company: null },
      { day: "2026-11-10", mine: true, company: "Delta" },
    ]);
  });

  it("as ATs do próprio hunter contam mesmo se ele não estiver na equipe", () => {
    const ats = weekAts([c({ at_marcada_em: "2026-11-11" })], new Set(["ana"]), "eu", WEEK);
    expect(ats).toHaveLength(1);
  });

  it("uma vaga por AT da meta; a primeira livre é a próxima", () => {
    const slots = atSlots([{ day: "2026-11-09", mine: true, company: "Delta" }], 3);
    expect(slots).toEqual([
      { kind: "at", day: "2026-11-09", mine: true, company: "Delta" },
      { kind: "livre", next: true },
      { kind: "livre", next: false },
    ]);
  });

  it("acima da meta, mostra todas as ATs; sem meta, só as ATs", () => {
    const ats = [1, 2, 3].map(() => ({ day: "2026-11-10", mine: false, company: null }));
    expect(atSlots(ats, 2)).toHaveLength(3);
    expect(atSlots(ats, null)).toHaveLength(3);
    expect(atSlots([], null)).toEqual([]);
  });
});

describe("meta de ATs da equipe", () => {
  const team = [
    { id: "eu", groupId: "g1" },
    { id: "ana", groupId: null },
    { id: "bia", groupId: null },
  ];

  it("soma a meta de cada hunter: a dele, senão a do grupo, senão a da equipe", () => {
    const goals = [
      goal({ ats_semana: 2 }),
      goal({ group_id: "g1", ats_semana: 4 }),
      goal({ user_id: "ana", ats_semana: 1 }),
    ];
    expect(teamWeekGoal(goals, team)).toBe(4 + 1 + 2);
  });

  it("sem meta de ATs definida, não há meta", () => {
    expect(teamWeekGoal([goal({ envios_dia: 5 })], team)).toBeNull();
    expect(teamWeekGoal([], team)).toBeNull();
  });
});

describe("atrasados", () => {
  it("um por lead, na etapa mais antiga, com os dias úteis de atraso", () => {
    // LinkedIn 1 em 05/11: WhatsApp 1 previsto 06/11, LinkedIn 2 previsto 09/11 (ambos atrasados).
    const antigo = c({ name: "Antigo", step1_date: "2026-11-05", sent1_at: "2026-11-05" });
    const recente = c({ name: "Recente", step1_date: "2026-11-10", sent1_at: "2026-11-10" });
    const emDia = c({ name: "Em dia", step1_date: "2026-11-11", sent1_at: "2026-11-11" });
    const q = buildQueues([recente, antigo, emDia], DEFAULT_OFFSETS, new Set(), TODAY);
    const rows = lateRows(q, new Set(), TODAY);
    expect(rows.map((r) => [r.name, r.step.label, r.planned, r.days])).toEqual([
      ["Antigo", STEPS[1]!.label, "2026-11-06", 4],
      ["Recente", STEPS[1]!.label, "2026-11-11", 1],
    ]);
  });

  it("feriado não conta como dia de atraso", () => {
    const x = c({ step1_date: "2026-11-05", sent1_at: "2026-11-05" });
    const holidays = new Set(["2026-11-10"]);
    const q = buildQueues([x], DEFAULT_OFFSETS, holidays, TODAY);
    expect(lateRows(q, holidays, TODAY)[0]!.days).toBe(3);
  });

  it("conta os LinkedIn 1 sem data que entram na fila de hoje", () => {
    const q = buildQueues(
      [c({}), c({}), c({ step1_date: TODAY })],
      DEFAULT_OFFSETS,
      new Set(),
      TODAY,
    );
    expect(undatedL1(q)).toBe(2);
  });
});

describe("conversão", () => {
  it("ATs registradas na semana ÷ LinkedIn 1 enviados na semana", () => {
    const contacts = [
      c({ sent1_at: "2026-11-09" }),
      c({ sent1_at: "2026-11-10" }),
      c({ sent1_at: "2026-11-11T14:00:00Z" }),
      c({ sent1_at: "2026-11-03", at_marcada_em: "2026-11-11" }),
      c({ sent1_at: "2026-11-02" }),
    ];
    expect(conversion(contacts, WEEK)).toEqual({ ats: 1, l1: 3, pct: 33 });
    expect(conversion(contacts, weekOf("2026-11-03"))).toEqual({ ats: 0, l1: 2, pct: 0 });
  });

  it("sem LinkedIn 1 enviado não há percentual", () => {
    expect(conversion([c({ at_marcada_em: "2026-11-11" })], WEEK)).toEqual({
      ats: 1,
      l1: 0,
      pct: null,
    });
  });
});
