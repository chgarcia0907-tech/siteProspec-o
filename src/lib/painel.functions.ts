import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso negado");
}

export const painelIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const painelHunters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const [profiles, contacts] = await Promise.all([
      fetchAll((a, b) => supabaseAdmin.from("profiles").select("id, display_name, email").order("id").range(a, b)),
      fetchAll((a, b) => supabaseAdmin.from("contacts").select("user_id, status, at_marcada_em").order("id").range(a, b)),
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
      .map((p) => ({ id: p.id, name: p.display_name?.trim() || p.email || "Hunter", email: p.email ?? "", ...(stats.get(p.id) ?? { total: 0, descartados: 0, ats: 0 }) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { hunters, total: contacts.length };
  });

const ACTIVITY = [
  ["sent1_at", "LinkedIn 1"], ["sent2_at", "WhatsApp 1"], ["sent3_at", "LinkedIn 2"], ["sent4_at", "WhatsApp 2"], ["sent5_at", "LinkedIn 3"],
  ["at_marcada_em", "AT marcada"], ["lead_em", "Lead"], ["proposta_em", "Proposta"], ["aprovacao_em", "Aprovação verbal"], ["vendido_em", "Projeto vendido"],
] as const;
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Busca de contatos do admin. Filtro opcional de intervalo (dia ou semana seg–dom, datas no fuso de São Paulo):
 * entra o contato importado no intervalo OU com qualquer envio/avanço de funil no intervalo.
 */
export const painelContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      hunterId: z.string().uuid().nullable(),
      q: z.string().max(100),
      from: isoDay.nullable().optional(),
      to: isoDay.nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const q = data.q.trim().replace(/[%,()]/g, " ");
    const range = data.from && data.to && data.from <= data.to ? { from: data.from, to: data.to } : null;
    if (!data.hunterId && q.length < 2 && !range) return { rows: [] };
    const cols = ACTIVITY.map(([f]) => f).join(", ");
    const rows = await fetchAll((a, b) => {
      let s = supabaseAdmin
        .from("contacts")
        .select(`id, user_id, name, headline, company, phone, status, connected_at, created_at, ${cols}`)
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
    const spDay = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const inR = (d: string | null) => !!range && !!d && d >= range.from && d <= range.to;
    const out = (rows as any[]).map((r) => ({
      ...r,
      atividades: range
        ? [...(inR(spDay(r.created_at)) ? [`Importado em ${spDay(r.created_at)}`] : []),
           ...ACTIVITY.filter(([f]) => inR(r[f])).map(([f, l]) => `${l} em ${r[f]}`)]
        : [],
    }));
    return { rows: data.hunterId || range ? out.slice(0, 2000) : out.slice(0, 300) };
  });

export const painelDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.union([
      z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1).max(5000) }),
      z.object({ mode: z.literal("hunter"), hunterId: z.string().uuid() }),
    ]).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let deleted = 0;
    if (data.mode === "hunter") {
      const { count, error } = await supabaseAdmin.from("contacts").delete({ count: "exact" }).eq("user_id", data.hunterId);
      if (error) throw new Error("Falha ao excluir");
      deleted = count ?? 0;
    } else {
      for (let i = 0; i < data.ids.length; i += 200) {
        const { count, error } = await supabaseAdmin.from("contacts").delete({ count: "exact" }).in("id", data.ids.slice(i, i + 200));
        if (error) throw new Error("Falha ao excluir");
        deleted += count ?? 0;
      }
    }
    return { deleted };
  });

export const painelSetPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.end && data.end < data.start) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("competition_settings").upsert({ id: 1, start_date: data.start, end_date: data.end, updated_at: new Date().toISOString() });
    if (error) throw new Error("Falha ao salvar");
    return { ok: true as const };
  });
