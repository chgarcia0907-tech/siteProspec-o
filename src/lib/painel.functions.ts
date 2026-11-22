import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FUNNEL, STEPS } from "./cadencia";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Tables } from "@/integrations/supabase/types";
import type { DashContact, TemplateCodes } from "./dashboard";
import type { PageResult } from "./fetch-all";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso negado");
}

export const painelIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

export const painelHunters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const [profiles, contacts] = await Promise.all([
      fetchAll((a, b) =>
        supabaseAdmin.from("profiles").select("id, display_name, email").order("id").range(a, b),
      ),
      fetchAll((a, b) =>
        supabaseAdmin
          .from("contacts")
          .select("user_id, status, at_marcada_em")
          .order("id")
          .range(a, b),
      ),
    ]);
    const stats = new Map<string, { total: number; descartados: number; ats: number }>();
    for (const c of contacts) {
      const s = stats.get(c.user_id) ?? { total: 0, descartados: 0, ats: 0 };
      s.total++;
      if (c.status === "descartado") s.descartados++;
      if (c.at_marcada_em) s.ats++;
      stats.set(c.user_id, s);
    }
    const hunters = profiles
      .map((p) => ({
        id: p.id,
        name: p.display_name?.trim() || p.email || "Hunter",
        email: p.email ?? "",
        ...(stats.get(p.id) ?? { total: 0, descartados: 0, ats: 0 }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { hunters, total: contacts.length };
  });

/** Colunas de atividade do contato (envios da cadência e etapas do funil) com seus rótulos. */
const ACTIVITY = [
  ...STEPS.map((st) => [st.sentField, st.label] as const),
  ...FUNNEL.map((f) => [f.field, f.label] as const),
];
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Busca de contatos do admin. Filtro opcional de intervalo (dia ou semana seg–dom, datas no fuso de São Paulo):
 * entra o contato importado no intervalo OU com qualquer envio/avanço de funil no intervalo.
 */
export const painelContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        hunterId: z.string().uuid().nullable(),
        q: z.string().max(100),
        from: isoDay.nullable().optional(),
        to: isoDay.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const q = data.q.trim().replace(/[%,()]/g, " ");
    const range =
      data.from && data.to && data.from <= data.to ? { from: data.from, to: data.to } : null;
    if (!data.hunterId && q.length < 2 && !range) return { rows: [] };
    const cols = ACTIVITY.map(([f]) => f).join(", ");
    const rows = await fetchAll((a, b) => {
      let s = supabaseAdmin
        .from("contacts")
        .select(
          `id, user_id, name, headline, company, phone, status, connected_at, created_at, ${cols}`,
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b);
      if (data.hunterId) s = s.eq("user_id", data.hunterId);
      if (q) s = s.or(`name.ilike.%${q}%,company.ilike.%${q}%`);
      if (range) {
        const conds = [
          `and(created_at.gte.${range.from}T00:00:00-03:00,created_at.lte.${range.to}T23:59:59.999-03:00)`,
          ...ACTIVITY.map(([f]) => `and(${f}.gte.${range.from},${f}.lte.${range.to})`),
        ];
        s = s.or(conds.join(","));
      }
      return s;
    });
    const spDay = (ts: string) =>
      new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const inR = (d: string | null) => !!range && !!d && d >= range.from && d <= range.to;
    type Row = Pick<
      Tables<"contacts">,
      | "id"
      | "user_id"
      | "name"
      | "headline"
      | "company"
      | "phone"
      | "status"
      | "connected_at"
      | "created_at"
      | (typeof ACTIVITY)[number][0]
    >;
    // O select é montado a partir de ACTIVITY (string dinâmica), então o tipo é declarado aqui.
    const out = (rows as unknown as Row[]).map((r) => ({
      ...r,
      atividades: range
        ? [
            ...(inR(spDay(r.created_at)) ? [`Importado em ${spDay(r.created_at)}`] : []),
            ...ACTIVITY.filter(([f]) => inR(r[f])).map(([f, l]) => `${l} em ${r[f]}`),
          ]
        : [],
    }));
    return { rows: data.hunterId || range ? out.slice(0, 2000) : out.slice(0, 300) };
  });

export const painelDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .union([
        z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1).max(5000) }),
        z.object({ mode: z.literal("hunter"), hunterId: z.string().uuid() }),
      ])
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let deleted = 0;
    if (data.mode === "hunter") {
      const { count, error } = await supabaseAdmin
        .from("contacts")
        .delete({ count: "exact" })
        .eq("user_id", data.hunterId);
      if (error) throw new Error("Falha ao excluir");
      deleted = count ?? 0;
    } else {
      for (let i = 0; i < data.ids.length; i += 200) {
        const { count, error } = await supabaseAdmin
          .from("contacts")
          .delete({ count: "exact" })
          .in("id", data.ids.slice(i, i + 200));
        if (error) throw new Error("Falha ao excluir");
        deleted += count ?? 0;
      }
    }
    return { deleted };
  });

export const painelSetPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.end && data.end < data.start) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("competition_settings").upsert({
      id: 1,
      start_date: data.start,
      end_date: data.end,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Falha ao salvar");
    return { ok: true as const };
  });

/**
 * Indicadores do painel (aba "Indicadores"). Carrega com service role e calcula com
 * `computeDashboard` (`dashboard.ts`); o cliente recebe só os números e as listas de atrasados.
 * `today` vem do navegador (fuso de São Paulo) para o "hoje" ser o mesmo da tela.
 * Grupo e subgrupo são os do período escolhido (padrão: o ativo).
 */
export const painelDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: isoDay,
        to: isoDay,
        today: isoDay,
        periodId: z.string().uuid().nullable(),
        groupId: z.string().uuid().nullable(),
        subgroupId: z.string().uuid().nullable(),
        hunterId: z.string().uuid().nullable(),
        sectorId: z.string().uuid().nullable(),
        channel: z.enum(["todos", "linkedin", "whatsapp"]),
      })
      .refine((v) => v.from <= v.to, "O início deve vir antes do fim")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const { adminIds } = await import("./competition.server");
    const { computeDashboard, clampToCycle, DASH_CONTACT_COLUMNS } = await import("./dashboard");
    const { hackathonPeriods, splitHackathon } = await import("./fila");

    const [
      profiles,
      admins,
      periods,
      groups,
      subgroups,
      members,
      sectors,
      templates,
      goals,
      defaults,
    ] = await Promise.all([
      fetchAll((a, b) =>
        db.from("profiles").select("id, display_name, email").order("id").range(a, b),
      ),
      adminIds(db),
      db.from("periods").select("id, name, status, kind, started_at, closed_at"),
      db.from("groups").select("id, name, period_id").order("name"),
      db.from("subgroups").select("id, name, group_id").order("name"),
      fetchAll((a, b) =>
        db
          .from("period_members")
          .select("period_id, user_id, group_id, subgroup_id")
          .order("id")
          .range(a, b),
      ),
      // Só setores de primeiro nível: `companies.sector_id` nunca é subsetor, então subsetores
      // não casariam com nenhuma empresa no filtro e no alerta de cadência.
      db.from("sectors").select("id, name, active, sort").is("parent_id", null),
      fetchAll((a, b) =>
        db
          .from("sector_templates")
          .select("sector_id, persona, step, code, body")
          .order("sector_id")
          .order("persona")
          .order("step")
          .range(a, b),
      ).then((data) => ({ data, error: null })),
      db
        .from("goals")
        .select("id, user_id, group_id, envios_dia, l1_semana, ats_semana, no_prazo_pct"),
      db.from("message_templates").select("step, code, body"),
    ]);

    const allPeriods = (periods.data ?? []).sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    const period =
      allPeriods.find((p) => p.id === data.periodId) ??
      allPeriods.find((p) => p.status === "active") ??
      null;
    const pGroups = (groups.data ?? []).filter((g) => g.period_id === period?.id);
    const pGroupIds = new Set(pGroups.map((g) => g.id));
    const pSubgroups = (subgroups.data ?? []).filter((s) => pGroupIds.has(s.group_id));
    const gname = new Map(pGroups.map((g) => [g.id, g.name]));
    const sname = new Map(pSubgroups.map((s) => [s.id, s.name]));
    const mem = new Map(
      members.filter((m) => m.period_id === period?.id).map((m) => [m.user_id, m]),
    );
    const spDay = (ts: string) =>
      new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    // Ciclo da equipe: só os membros dele e só dentro das datas do ciclo. Quem está fora
    // continua na base (e nos outros períodos); só não entra nestes números.
    const cycle =
      period?.kind === "ciclo"
        ? {
            name: period.name,
            start: spDay(period.started_at),
            end: period.closed_at ? spDay(period.closed_at) : null,
          }
        : null;
    const range = cycle ? clampToCycle(data, cycle) : { from: data.from, to: data.to };

    const everyone = profiles
      .filter((p) => !admins.has(p.id) && (!cycle || mem.has(p.id)))
      .map((p) => {
        const m = mem.get(p.id);
        return {
          id: p.id,
          name: p.display_name?.trim() || p.email || "Hunter",
          grupo: (m?.group_id && gname.get(m.group_id)) || "",
          subgrupo: (m?.subgroup_id && sname.get(m.subgroup_id)) || "",
          groupId: m?.group_id ?? null,
          subgroupId: m?.subgroup_id ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const hunters = everyone.filter(
      (h) =>
        !!range &&
        (!data.groupId || h.groupId === data.groupId) &&
        (!data.subgroupId || h.subgroupId === data.subgroupId) &&
        (!data.hunterId || h.id === data.hunterId),
    );
    const ids = hunters.map((h) => h.id);
    const filtered = !!cycle || hunters.length !== everyone.length;

    const [allContacts, companies, settings, holidays] = await Promise.all([
      ids.length === 0
        ? Promise.resolve([] as DashContact[])
        : fetchAll((a, b) => {
            let q = db.from("contacts").select(DASH_CONTACT_COLUMNS);
            if (filtered) q = q.in("user_id", ids);
            // select montado a partir de STEPS/FUNNEL: o tipo da linha é declarado aqui.
            return q.order("id").range(a, b) as unknown as PageResult<DashContact>;
          }),
      fetchAll((a, b) =>
        db
          .from("companies")
          .select("id, user_id, name, sector_id, week_start")
          .order("id")
          .range(a, b),
      ),
      fetchAll((a, b) =>
        db
          .from("settings")
          .select("user_id, offset1, offset2, offset3, offset4, offset5")
          .order("user_id")
          .range(a, b),
      ),
      db.from("holidays").select("date"),
    ]);

    // Com um ciclo (ou sem período), os cards do Hackathon encerrado não entram nos números atuais.
    // Escolhendo a própria competição no filtro, o histórico dela continua inteiro.
    const contacts =
      period?.kind === "competicao"
        ? allContacts
        : splitHackathon(allContacts, hackathonPeriods(allPeriods)).current;
    const sectorSteps: Record<string, number[]> = {};
    const templateCodes: TemplateCodes = { defaults: {}, sectors: {} };
    // Só "qualquer persona" (persona ''): é o sentido atual de sectorSteps e templateCodes.
    for (const t of templates.data ?? [])
      if (t.persona === "" && t.body.trim()) {
        (sectorSteps[t.sector_id] ??= []).push(t.step);
        (templateCodes.sectors[t.sector_id] ??= {})[t.step] = t.code;
      }
    for (const t of defaults.data ?? []) if (t.body.trim()) templateCodes.defaults[t.step] = t.code;

    const dashboard = computeDashboard({
      contacts,
      companies,
      sectors: sectors.data ?? [],
      sectorSteps,
      hunters,
      offsets: Object.fromEntries(settings.map(({ user_id, ...o }) => [user_id, o])),
      holidays: new Set((holidays.data ?? []).map((h) => h.date)),
      from: range?.from ?? data.from,
      to: range?.to ?? data.to,
      today: data.today,
      lateSince: cycle?.start ?? null,
      channel: data.channel,
      sectorId: data.sectorId,
      goals: goals.data ?? [],
      templateCodes,
    });

    return {
      dashboard,
      periodId: period?.id ?? null,
      cycle: cycle && { ...cycle, members: everyone.length, outside: !range },
      goals: goals.data ?? [],
      options: {
        periods: allPeriods.map((p) => ({
          id: p.id,
          name: p.name,
          active: p.status === "active",
          start: spDay(p.started_at),
          end: p.closed_at ? spDay(p.closed_at) : null,
        })),
        groups: pGroups.map((g) => ({ id: g.id, name: g.name })),
        subgroups: pSubgroups.map((s) => ({ id: s.id, name: s.name, groupId: s.group_id })),
        hunters: everyone.map((h) => ({ id: h.id, name: h.name, groupId: h.groupId })),
        sectors: (sectors.data ?? [])
          .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "pt-BR"))
          .map((s) => ({ id: s.id, name: s.name })),
      },
    };
  });

const goalValue = z.number().min(0).max(100000).nullable();

/**
 * Cria ou atualiza a meta de um escopo: equipe (sem userId e groupId), grupo ou hunter.
 * Campo nulo = herda do escopo acima (hunter → grupo → equipe).
 */
export const painelSaveGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        groupId: z.string().uuid().nullable(),
        envios_dia: goalValue,
        l1_semana: goalValue,
        ats_semana: goalValue,
        no_prazo_pct: z.number().int().min(0).max(100).nullable(),
      })
      .refine((v) => !(v.userId && v.groupId), "Meta é do hunter ou do grupo, não dos dois")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { userId, groupId, ...values } = data;
    const row = {
      ...values,
      envios_dia: values.envios_dia === null ? null : Math.round(values.envios_dia),
      l1_semana: values.l1_semana === null ? null : Math.round(values.l1_semana),
      ats_semana: values.ats_semana === null ? null : Math.round(values.ats_semana * 10) / 10,
    };
    // O índice único do escopo usa COALESCE, que o upsert do PostgREST não aceita: busca e grava.
    let q = db.from("goals").select("id");
    q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
    q = groupId ? q.eq("group_id", groupId) : q.is("group_id", null);
    const { data: existing, error: findError } = await q.maybeSingle();
    if (findError) throw new Error("Falha ao carregar a meta");
    const { error } = existing
      ? await db.from("goals").update(row).eq("id", existing.id)
      : await db.from("goals").insert({ ...row, user_id: userId, group_id: groupId });
    if (error) throw new Error("Falha ao salvar a meta");
    return { ok: true as const };
  });

/** Remove a meta de um grupo ou hunter (passa a valer a do escopo acima). */
export const painelDeleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("goals").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao remover a meta");
    return { ok: true as const };
  });

/** Contatos de um hunter para a auditoria de conexões (todos, sem limite, só as colunas usadas). */
export const painelAuditContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hunterId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const rows = await fetchAll((a, b) =>
      supabaseAdmin
        .from("contacts")
        .select("id, name, headline, connected_at, created_at, status, sent1_at")
        .eq("user_id", data.hunterId)
        .order("id")
        .range(a, b),
    );
    return { rows };
  });
