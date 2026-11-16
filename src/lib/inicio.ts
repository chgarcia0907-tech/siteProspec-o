// Regras puras da tela Início: ATs da semana contra a meta, atrasados e conversão do hunter.
import { atScoreDate, mondayOf } from "./competition";
import {
  addDaysISO,
  STEPS,
  weekdayISO,
  type Contact,
  type Holidays,
  type StepDef,
} from "./cadencia";
import { businessDaysBetween, resolveGoal, type DashGoal } from "./dashboard";
import type { Queues } from "./fila";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Segunda e domingo da semana de `iso`. */
export function weekOf(iso: string): { from: string; to: string } {
  const from = mondayOf(iso);
  return { from, to: addDaysISO(from, 6) };
}

/** "2026-11-09" → "seg 09". */
export function shortWeekday(iso: string): string {
  return `${WEEKDAY[weekdayISO(iso)]} ${iso.slice(8, 10)}`;
}

/** Uma AT da equipe na semana. A empresa só vem nas ATs do próprio hunter. */
export type WeekAt = { day: string; mine: boolean; company: string | null };

export type AtContact = Pick<
  Contact,
  "user_id" | "company" | "at_marcada_em" | "at_registrado_em" | "period_id" | "created_at"
>;

/**
 * ATs da equipe registradas na semana (pela mesma data do placar, `atScoreDate`), em ordem de
 * dia. As dos outros hunters saem sem empresa: o hunter vê só o dia delas.
 */
export function weekAts(
  contacts: readonly AtContact[],
  team: ReadonlySet<string>,
  userId: string,
  week: { from: string; to: string },
): WeekAt[] {
  const out: WeekAt[] = [];
  for (const c of contacts) {
    if (!team.has(c.user_id) && c.user_id !== userId) continue;
    const day = atScoreDate(c);
    if (!day || day < week.from || day > week.to) continue;
    const mine = c.user_id === userId;
    out.push({ day, mine, company: mine ? c.company || null : null });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/**
 * Meta semanal de ATs da equipe: a soma da meta de cada hunter (a dele, senão a do grupo,
 * senão o padrão da equipe). Sem nenhuma meta de ATs definida, devolve null.
 */
export function teamWeekGoal(
  goals: readonly DashGoal[],
  team: readonly { id: string; groupId: string | null }[],
): number | null {
  let total = 0;
  let any = false;
  for (const h of team) {
    const g = resolveGoal(goals, h.id, h.groupId).ats_semana;
    if (g === null) continue;
    any = true;
    total += g;
  }
  return any ? Math.round(total) : null;
}

export type AtSlot =
  | { kind: "at"; day: string; mine: boolean; company: string | null }
  | { kind: "livre"; next: boolean };

/**
 * Uma vaga por AT da meta: primeiro as ATs feitas, depois as vagas livres (a primeira livre é a
 * "próxima"). Se a equipe passou da meta, as ATs a mais também aparecem.
 */
export function atSlots(ats: readonly WeekAt[], goal: number | null): AtSlot[] {
  const slots: AtSlot[] = ats.map((a) => ({ kind: "at", ...a }));
  for (let i = ats.length; i < (goal ?? 0); i++)
    slots.push({ kind: "livre", next: i === ats.length });
  return slots;
}

export type LateRow = {
  contactId: string;
  name: string;
  step: StepDef;
  planned: string;
  days: number;
};

/**
 * Leads atrasados (um por lead, na etapa mais antiga em atraso), do mais antigo para o mais
 * novo, com os dias úteis de atraso até `today`.
 */
export function lateRows(queues: Queues, holidays: Holidays, today: string): LateRow[] {
  const byContact = new Map<string, LateRow>();
  for (const step of STEPS)
    for (const item of queues[step.n]) {
      if (!item.late || !item.planned) continue;
      const prev = byContact.get(item.contact.id);
      if (prev && prev.planned <= item.planned) continue;
      byContact.set(item.contact.id, {
        contactId: item.contact.id,
        name: item.contact.name,
        step,
        planned: item.planned,
        days: businessDaysBetween(item.planned, today, holidays),
      });
    }
  return [...byContact.values()].sort(
    (a, b) =>
      (a.planned < b.planned ? -1 : a.planned > b.planned ? 1 : 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

export type Conversion = { ats: number; l1: number; pct: number | null };

/**
 * Conversão do hunter num intervalo: ATs registradas ÷ contatos com LinkedIn 1 enviado no
 * mesmo intervalo. Sem LinkedIn 1 enviado, o percentual fica null.
 */
export function conversion(
  contacts: readonly Pick<Contact, "sent1_at" | "at_marcada_em" | "at_registrado_em">[],
  range: { from: string; to: string },
): Conversion {
  const inR = (d: string | null | undefined) => !!d && d >= range.from && d <= range.to;
  let l1 = 0;
  let ats = 0;
  for (const c of contacts) {
    if (inR(c.sent1_at?.slice(0, 10))) l1++;
    if (inR(atScoreDate(c))) ats++;
  }
  return { ats, l1, pct: l1 > 0 ? Math.round((ats / l1) * 100) : null };
}

/** Quantos LinkedIn 1 sem data estão na fila (entram como envio de hoje). */
export function undatedL1(queues: Queues): number {
  return queues[1].filter((i) => !i.planned).length;
}
