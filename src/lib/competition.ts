// Cálculo puro da competição (usado só no servidor; o cliente recebe apenas totais).
import { FUNNEL, addDaysISO, type FunnelField, type FunnelRegisteredField } from "./cadencia";

export type CompContact = {
  user_id: string;
  sent1_at: string | null;
  created_at: string;
} & Record<FunnelField, string | null> &
  Partial<Record<FunnelRegisteredField, string | null>>;

/** Colunas de `contacts` que o cálculo usa (as do funil vêm do FUNNEL). */
export const COMP_CONTACT_COLUMNS = [
  "user_id",
  "sent1_at",
  "created_at",
  ...FUNNEL.flatMap((f) => [f.field, f.registeredField]),
].join(", ");

/**
 * Contatos que podem mudar o placar de um período que começa em `start`: LinkedIn 1 enviada
 * a partir do início (conta na conversão) ou alguma etapa do funil preenchida. Os demais não
 * somam nada, então a consulta pode deixá-los no banco. `competitionFilter` é o mesmo critério
 * no formato do PostgREST (`.or(...)`); os dois precisam andar juntos.
 */
export function isRelevantContact(c: CompContact, start: string): boolean {
  return (!!c.sent1_at && c.sent1_at >= start) || FUNNEL.some((f) => !!c[f.field]);
}
export function competitionFilter(start: string): string {
  return [`sent1_at.gte.${start}`, ...FUNNEL.map((f) => `${f.field}.not.is.null`)].join(",");
}

/** Data (SP) em que a etapa foi registrada na plataforma; sem registro, usa a data informada. */
export function stageScoreDate(c: CompContact, f: FunnelField): string | null {
  if (!c[f]) return null;
  const reg = c[FUNNEL.find((s) => s.field === f)!.registeredField];
  if (!reg) return c[f];
  return new Date(reg).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export type CompRow = {
  hunter_id: string;
  hunter: string;
  ats: number;
  leads: number;
  propostas: number;
  aprovacoes: number;
  vendidos: number;
  pontos_funil: number;
  bonus_primeiro_at: number;
  semanas_vencidas: number;
  bonus_semanas: number;
  total_pontos: number;
  linkedin1: number;
  taxa_conversao: number;
  pontuacao_final: number;
};

export type CompWeek = {
  inicio: string;
  fim: string;
  parcial: boolean;
  max: number;
  vencedores: string[];
};

export type CompResult = {
  start: string;
  end: string | null;
  rows: CompRow[];
  weeks: CompWeek[];
  primeiroAt: { hunter: string; data: string } | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Data (SP) em que a AT foi registrada na plataforma; sem registro, usa a data informada. */
export function atScoreDate(
  c: Pick<CompContact, "at_marcada_em" | "at_registrado_em">,
): string | null {
  if (!c.at_marcada_em) return null;
  if (!c.at_registrado_em) return c.at_marcada_em;
  return new Date(c.at_registrado_em).toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0=domingo
  return addDaysISO(iso, wd === 0 ? -6 : 1 - wd);
}

export function computeCompetition(
  contacts: CompContact[],
  hunters: { id: string; name: string }[],
  period: { start: string; end: string | null },
  todaySP: string,
  opts: { firstAtBonus?: boolean } = {},
): CompResult {
  const inP = (d: string | null) =>
    !!d && d.slice(0, 10) >= period.start && (!period.end || d.slice(0, 10) <= period.end);
  const name = new Map(hunters.map((h) => [h.id, h.name]));
  const rows = new Map<string, CompRow>();
  for (const h of hunters) {
    rows.set(h.id, {
      hunter_id: h.id,
      hunter: h.name,
      ats: 0,
      leads: 0,
      propostas: 0,
      aprovacoes: 0,
      vendidos: 0,
      pontos_funil: 0,
      bonus_primeiro_at: 0,
      semanas_vencidas: 0,
      bonus_semanas: 0,
      total_pontos: 0,
      linkedin1: 0,
      taxa_conversao: 0,
      pontuacao_final: 0,
    });
  }

  let first: { c: CompContact; key: string } | null = null;
  const weekCounts = new Map<string, Map<string, number>>();

  for (const c of contacts) {
    const r = rows.get(c.user_id);
    if (!r) continue;
    if (inP(c.sent1_at)) r.linkedin1++;
    // AT conta no dia em que foi registrada na plataforma (não no dia da reunião).
    const at = atScoreDate(c);
    for (const f of FUNNEL) {
      const d = f.field === "at_marcada_em" ? at : stageScoreDate(c, f.field);
      if (inP(d)) {
        r[f.countKey]++;
        r.pontos_funil += f.points;
      }
    }
    if (inP(at)) {
      const key = c.at_registrado_em ?? `${at}T99`;
      if (!first || key < first.key) first = { c, key };
      const wk = mondayOf(at!);
      const m = weekCounts.get(wk) ?? new Map<string, number>();
      m.set(c.user_id, (m.get(c.user_id) ?? 0) + 1);
      weekCounts.set(wk, m);
    }
  }

  if (first && opts.firstAtBonus !== false) rows.get(first.c.user_id)!.bonus_primeiro_at = 5;

  const currentWeek = mondayOf(todaySP);
  const weeks: CompWeek[] = [...weekCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, m]) => {
      const max = Math.max(...m.values());
      const winners = [...m.entries()].filter(([, n]) => n === max).map(([id]) => id);
      for (const id of winners) {
        const r = rows.get(id)!;
        r.semanas_vencidas++;
        r.bonus_semanas += 6;
      }
      return {
        inicio: wk,
        fim: addDaysISO(wk, 6),
        parcial: wk === currentWeek,
        max,
        vencedores: winners.map((id) => name.get(id) ?? ""),
      };
    });

  for (const r of rows.values()) {
    r.total_pontos = r.pontos_funil + r.bonus_primeiro_at + r.bonus_semanas;
    r.taxa_conversao = r.linkedin1 ? round1((r.ats / r.linkedin1) * 100) : 0;
    const rate = r.linkedin1 ? (r.ats / r.linkedin1) * 100 : 0; // número: 7% conta como 7
    r.pontuacao_final = round1(0.7 * r.total_pontos + 0.3 * rate);
  }

  return {
    start: period.start,
    end: period.end,
    rows: [...rows.values()].sort(
      (a, b) =>
        b.pontuacao_final - a.pontuacao_final ||
        b.total_pontos - a.total_pontos ||
        a.hunter.localeCompare(b.hunter, "pt-BR"),
    ),
    weeks,
    primeiroAt: first
      ? { hunter: name.get(first.c.user_id) ?? "", data: atScoreDate(first.c)! }
      : null,
  };
}

export type WeekBoard = { inicio: string; fim: string; parcial: boolean; rows: CompRow[] };

/**
 * Ranking de cada semana (segunda a domingo, SP) dentro do período, com a mesma regra da
 * competição: pontos do funil + 6 para quem fez mais ATs na semana + conversão.
 * O bônus de 1º AT é só do período inteiro, então não entra na semana.
 * Semanas mais recentes primeiro; a semana atual vem marcada como parcial.
 */
export function computeWeekly(
  contacts: CompContact[],
  hunters: { id: string; name: string }[],
  period: { start: string; end: string | null },
  todaySP: string,
): WeekBoard[] {
  const last = period.end && period.end < todaySP ? period.end : todaySP;
  if (last < period.start) return [];
  const out: WeekBoard[] = [];
  for (let wk = mondayOf(period.start); wk <= last; wk = addDaysISO(wk, 7)) {
    const sun = addDaysISO(wk, 6);
    const start = wk < period.start ? period.start : wk;
    const end = sun > last ? last : sun;
    const res = computeCompetition(contacts, hunters, { start, end }, todaySP, {
      firstAtBonus: false,
    });
    out.push({ inicio: wk, fim: sun, parcial: sun > last, rows: res.rows });
  }
  return out.reverse();
}
