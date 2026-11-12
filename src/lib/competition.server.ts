import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  computeCompetition,
  computeWeekly,
  type CompContact,
  type CompResult,
  type CompRow,
} from "./competition";
import { spParts } from "./cadencia";
import { fetchAll } from "./fetch-all";

export type CompRowG = CompRow & { grupo: string; subgrupo: string };
export type WeekBoardG = { inicio: string; fim: string; parcial: boolean; rows: CompRowG[] };
export type CompResultG = Omit<CompResult, "rows"> & {
  rows: CompRowG[];
  periodId: string | null;
  periodName: string | null;
  periodKind?: "competicao" | "ciclo" | undefined;
  /** Só para ciclos: ranking de cada semana, mais recente primeiro. */
  semanas?: WeekBoardG[] | undefined;
};

const spDate = (ts: string) =>
  new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/**
 * Carrega dados com service role e calcula (somente servidor).
 * Sem periodId: comportamento original (competition_settings, todos os contatos), com grupo do período ativo.
 * Com periodId: placar vivo do período (só contatos do período, datas do período).
 * Ciclo (periods.kind = 'ciclo'): só os membros do ciclo participam e contam TODOS os contatos
 * deles pela data de cada etapa, para leads antigos que avançam no ciclo também pontuarem.
 */
export async function loadCompetition(periodId?: string | null): Promise<CompResultG> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const period = periodId
    ? (await db.from("periods").select("*").eq("id", periodId).maybeSingle()).data
    : (await db.from("periods").select("*").eq("status", "active").maybeSingle()).data;
  if (periodId && !period) throw new Error("Período não encontrado");
  const ciclo = !!periodId && period?.kind === "ciclo";

  const cols =
    "user_id, sent1_at, at_marcada_em, lead_em, proposta_em, aprovacao_em, vendido_em, at_registrado_em, lead_registrado_em, proposta_registrado_em, aprovacao_registrado_em, vendido_registrado_em, created_at";
  const [contacts, profiles, s, members, groups, subgroups] = await Promise.all([
    fetchAll((a, b) => {
      let q = db.from("contacts").select(cols);
      if (periodId && !ciclo) q = q.eq("period_id", periodId);
      return q.order("id").range(a, b);
    }),
    fetchAll((a, b) =>
      db.from("profiles").select("id, display_name, email").order("id").range(a, b),
    ),
    db.from("competition_settings").select("start_date, end_date").eq("id", 1).maybeSingle(),
    period
      ? fetchAll((a, b) =>
          db
            .from("period_members")
            .select("user_id, group_id, subgroup_id")
            .eq("period_id", period.id)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve(
          [] as { user_id: string; group_id: string | null; subgroup_id: string | null }[],
        ),
    db.from("groups").select("id, name"),
    db.from("subgroups").select("id, name"),
  ]);

  const pname = new Map(profiles.map((h) => [h.id, h.display_name?.trim() || h.email || "Hunter"]));
  let hunters: { id: string; name: string }[];
  let range: { start: string; end: string | null };
  if (periodId && period) {
    const ids = new Set<string>(members.map((m) => m.user_id));
    if (!ciclo) for (const c of contacts) ids.add(c.user_id);
    hunters = [...ids].map((id) => ({ id, name: pname.get(id) ?? "Hunter" }));
    range = {
      start: spDate(period.started_at),
      end: period.closed_at ? spDate(period.closed_at) : null,
    };
  } else {
    hunters = profiles.map((h) => ({ id: h.id, name: pname.get(h.id)! }));
    range = { start: s.data?.start_date ?? "2026-10-01", end: s.data?.end_date ?? null };
  }
  const today = spParts().iso;
  const res = computeCompetition(contacts as CompContact[], hunters, range, today);
  const gname = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const sname = new Map((subgroups.data ?? []).map((g) => [g.id, g.name]));
  const mem = new Map(members.map((m) => [m.user_id, m]));
  const admins = await adminIds(db);
  const withGroup = (rows: CompRow[]): CompRowG[] =>
    rows
      .filter((r) => !admins.has(r.hunter_id))
      .map((r) => {
        const m = mem.get(r.hunter_id);
        return {
          ...r,
          grupo: (m?.group_id && gname.get(m.group_id)) || "",
          subgrupo: (m?.subgroup_id && sname.get(m.subgroup_id)) || "",
        };
      });
  return {
    ...res,
    periodId: period?.id ?? null,
    periodName: period?.name ?? null,
    periodKind: periodId ? (ciclo ? "ciclo" : "competicao") : undefined,
    rows: withGroup(res.rows),
    semanas: ciclo
      ? computeWeekly(contacts as CompContact[], hunters, range, today).map((w) => ({
          ...w,
          rows: withGroup(w.rows),
        }))
      : undefined,
  };
}

/** Ciclo para a planilha: o ciclo ativo, senão o mais recente. */
export async function loadCurrentCycle(): Promise<CompResultG | null> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db
    .from("periods")
    .select("id")
    .eq("kind", "ciclo")
    .order("status", { ascending: true })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? loadCompetition(data.id) : null;
}

/** Placar oficial congelado de um período encerrado, no mesmo formato do placar vivo. */
export async function loadSnapshot(periodId: string): Promise<CompResultG> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data: p }, rows] = await Promise.all([
    db.from("periods").select("*").eq("id", periodId).maybeSingle(),
    fetchAll((a, b) =>
      db.from("period_snapshots").select("*").eq("period_id", periodId).order("id").range(a, b),
    ),
  ]);
  if (!p) throw new Error("Período não encontrado");
  const admins = await adminIds(db);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = (r: (typeof rows)[number]) => (r.extra ?? {}) as any;
  const first = rows[0] ? ex(rows[0]) : {};
  return {
    periodId: p.id,
    periodName: p.name,
    start: first.inicio ?? spDate(p.started_at),
    end: first.fim ?? (p.closed_at ? spDate(p.closed_at) : null),
    weeks: first.semanas ?? [],
    primeiroAt: first.primeiro_at ?? null,
    rows: rows
      .filter((r) => !admins.has(r.hunter_id))
      .map((r) => {
        const e = ex(r);
        return {
          hunter_id: r.hunter_id,
          hunter: r.hunter_name,
          grupo: r.group_name,
          subgrupo: r.subgroup_name,
          ats: r.ats_count,
          leads: r.leads_count,
          propostas: r.propostas_count,
          aprovacoes: r.aprovacoes_count,
          vendidos: r.vendas_count,
          pontos_funil: e.pontos_funil ?? 0,
          bonus_primeiro_at: r.first_at_bonus ? 5 : 0,
          semanas_vencidas: r.weekly_wins,
          bonus_semanas: e.bonus_semanas ?? r.weekly_wins * 6,
          total_pontos: e.total_pontos ?? 0,
          linkedin1: e.linkedin1 ?? r.sent1,
          taxa_conversao: e.taxa_conversao ?? 0,
          pontuacao_final: Number(r.points),
        };
      })
      .sort(
        (a, b) =>
          b.pontuacao_final - a.pontuacao_final ||
          b.total_pontos - a.total_pontos ||
          a.hunter.localeCompare(b.hunter, "pt-BR"),
      ),
  };
}

/** Contas com papel admin não participam do ranking. */
async function adminIds(db: SupabaseClient<Database>): Promise<Set<string>> {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return new Set((data ?? []).map((r) => r.user_id));
}
