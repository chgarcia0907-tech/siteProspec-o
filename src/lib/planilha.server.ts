// Exportação CSV para a planilha (IMPORTDATA). Somente servidor.
import { timingSafeEqual } from "crypto";
import {
  DEFAULT_OFFSETS,
  STATUS_LABEL,
  STEPS,
  computedStatus,
  plannedDates,
  type Contact,
  type Offsets,
} from "./cadencia";
import { fetchAll } from "./fetch-all";

const TZ = "America/Sao_Paulo";

export function checkToken(request: Request): boolean {
  const given = new URL(request.url).searchParams.get("token") ?? "";
  const expected = process.env["SHEET_EXPORT_TOKEN"] ?? "";
  if (!given || !expected) return false;
  const a = Buffer.from(given),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export const toCsv = (rows: unknown[][]) =>
  rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";

export function csvResponse(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" },
  });
}
export const unauthorized = () => new Response("Unauthorized", { status: 401 });

const dfmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
/** Datas puras (YYYY-MM-DD) só reformatadas; timestamps convertidos para o fuso de SP. */
function br(v: string | null | undefined) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return dfmt.format(new Date(s));
}
export function brDateTime(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}
const dec = (n: number) => String(n).replace(".", ",");

export async function contatosCsv(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [c, p, s, per, mem, grp, sub, hol] = await Promise.all([
    fetchAll((a, b) => supabaseAdmin.from("contacts").select("*").order("id").range(a, b)).then(
      (data) => ({ data, error: null }),
    ),
    fetchAll((a, b) =>
      supabaseAdmin.from("profiles").select("id, display_name, email").order("id").range(a, b),
    ).then((data) => ({ data, error: null })),
    fetchAll((a, b) =>
      supabaseAdmin.from("settings").select("*").order("user_id").range(a, b),
    ).then((data) => ({ data, error: null })),
    supabaseAdmin.from("periods").select("id, name"),
    fetchAll((a, b) =>
      supabaseAdmin
        .from("period_members")
        .select("period_id, user_id, group_id, subgroup_id")
        .order("id")
        .range(a, b),
    ),
    supabaseAdmin.from("groups").select("id, name"),
    supabaseAdmin.from("subgroups").select("id, name"),
    supabaseAdmin.from("holidays").select("date"),
  ]);
  if (hol.error) throw hol.error;
  const holidays = new Set((hol.data ?? []).map((h) => h.date));
  const pern = new Map((per.data ?? []).map((x) => [x.id, x.name]));
  const gn = new Map((grp.data ?? []).map((x) => [x.id, x.name]));
  const sn = new Map((sub.data ?? []).map((x) => [x.id, x.name]));
  const memb = new Map(mem.map((m) => [`${m.period_id}|${m.user_id}`, m]));
  if (c.error || p.error || s.error) throw c.error ?? p.error ?? s.error;
  const names = new Map(p.data.map((h) => [h.id, h.display_name?.trim() || h.email || ""]));
  const offs = new Map(s.data.map((o) => [o.user_id, o as Offsets]));
  const items = (c.data as unknown as Contact[])
    .map((ct) => ({ ct, hunter: names.get(ct.user_id) ?? "" }))
    .sort(
      (a, b) =>
        a.hunter.localeCompare(b.hunter, "pt-BR") || b.ct.created_at.localeCompare(a.ct.created_at),
    );
  const header = [
    "Hunter",
    "Nome",
    "Cargo/Headline",
    "Cargo na empresa",
    "Empresa",
    "Setor",
    "Telefone",
    "Data da conexão",
    ...STEPS.flatMap((st) => [`${st.label} prevista`, `${st.label} enviada`]),
    "Status",
    "AT marcada",
    "Lead",
    "Proposta marcada",
    "Aprovação verbal",
    "Projeto vendido",
    "Importado em",
    "Período",
    "Grupo",
    "Subgrupo",
  ];
  const rows = items.map(({ ct, hunter }) => {
    const planned = plannedDates(ct, offs.get(ct.user_id) ?? DEFAULT_OFFSETS, holidays);
    return [
      hunter,
      ct.name,
      ct.headline,
      ct.job_title,
      ct.company,
      ct.sector,
      ct.phone,
      br(ct.connected_at),
      ...STEPS.flatMap((st) => [br(planned[st.n]), br(ct[st.sentField])]),
      STATUS_LABEL[computedStatus(ct)],
      br(ct.at_marcada_em),
      br(ct.lead_em),
      br(ct.proposta_em),
      br(ct.aprovacao_em),
      br(ct.vendido_em),
      br(ct.created_at),
      ...(() => {
        const pid = (ct as unknown as { period_id: string | null }).period_id;
        const m = pid ? memb.get(`${pid}|${ct.user_id}`) : undefined;
        return [
          pid ? (pern.get(pid) ?? "") : "",
          (m?.group_id && gn.get(m.group_id)) || "",
          (m?.subgroup_id && sn.get(m.subgroup_id)) || "",
        ];
      })(),
    ];
  });
  return toCsv([header, ...rows]);
}

export async function rankingCsv(): Promise<string> {
  const { loadCompetition } = await import("./competition.server");
  const comp = await loadCompetition();
  return toCsv([
    ["Atualizado em", brDateTime(new Date())],
    [],
    [
      "Posição",
      "Hunter",
      "ATs",
      "Leads",
      "Propostas",
      "Aprovações verbais",
      "Vendidos",
      "Pontos do funil",
      "Bônus",
      "Total de pontos",
      "Taxa de conversão (%)",
      "Pontuação final",
      "Grupo",
      "Subgrupo",
    ],
    ...comp.rows.map((r, i) => [
      i + 1,
      r.hunter,
      r.ats,
      r.leads,
      r.propostas,
      r.aprovacoes,
      r.vendidos,
      r.pontos_funil,
      r.bonus_primeiro_at + r.bonus_semanas,
      r.total_pontos,
      dec(r.taxa_conversao),
      dec(r.pontuacao_final),
      r.grupo,
      r.subgrupo,
    ]),
  ]);
}

const RANK_HEADER = [
  "Posição",
  "Hunter",
  "ATs",
  "Leads",
  "Propostas",
  "Aprovações verbais",
  "Vendidos",
  "LinkedIn 1 enviadas",
  "Pontos do funil",
  "Bônus",
  "Total de pontos",
  "Taxa de conversão (%)",
  "Pontuação final",
  "Grupo",
  "Subgrupo",
];
type RankRow = Awaited<
  ReturnType<typeof import("./competition.server").loadCompetition>
>["rows"][number];
const rankCells = (r: RankRow, i: number) => [
  i + 1,
  r.hunter,
  r.ats,
  r.leads,
  r.propostas,
  r.aprovacoes,
  r.vendidos,
  r.linkedin1,
  r.pontos_funil,
  r.bonus_primeiro_at + r.bonus_semanas,
  r.total_pontos,
  dec(r.taxa_conversao),
  dec(r.pontuacao_final),
  r.grupo,
  r.subgrupo,
];

/** Ranking geral do ciclo da equipe (ativo, senão o mais recente). */
export async function cicloCsv(): Promise<string> {
  const { loadCurrentCycle } = await import("./competition.server");
  const comp = await loadCurrentCycle();
  if (!comp) return toCsv([["Nenhum ciclo cadastrado"]]);
  return toCsv([
    [
      "Ciclo",
      comp.periodName ?? "",
      "Período",
      `${br(comp.start)} a ${comp.end ? br(comp.end) : "hoje"}`,
      "Atualizado em",
      brDateTime(new Date()),
    ],
    [],
    RANK_HEADER,
    ...comp.rows.map(rankCells),
  ]);
}

/** Ranking de cada semana do ciclo (mais recente primeiro), uma linha por hunter e semana. */
export async function cicloSemanasCsv(): Promise<string> {
  const { loadCurrentCycle } = await import("./competition.server");
  const comp = await loadCurrentCycle();
  if (!comp) return toCsv([["Nenhum ciclo cadastrado"]]);
  return toCsv([
    ["Ciclo", comp.periodName ?? "", "Atualizado em", brDateTime(new Date())],
    [],
    ["Semana", "Início", "Fim", "Parcial", ...RANK_HEADER],
    ...(comp.semanas ?? []).flatMap((w) =>
      w.rows.map((r, i) => [
        `${br(w.inicio)} a ${br(w.fim)}`,
        br(w.inicio),
        br(w.fim),
        w.parcial ? "sim" : "não",
        ...rankCells(r, i),
      ]),
    ),
  ]);
}
