import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pw = z.string().min(1).max(200);

export const getCompetition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ periodId: z.string().uuid().nullish(), oficial: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    const m = await import("./competition.server");
    if (data?.periodId && data.oficial) return m.loadSnapshot(data.periodId);
    return m.loadCompetition(data?.periodId ?? null);
  });

async function counts(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [mine, all] = await Promise.all([
    supabaseAdmin.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("contacts").select("id", { count: "exact", head: true }),
  ]);
  return { mine: mine.count ?? 0, all: all.count ?? 0 };
}

export const adminVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: pw }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkAdminPassword } = await import("./admin.server");
    const check = await checkAdminPassword(context.userId, data.password);
    if (check.status !== "ok") return { ...check, counts: null };
    return { ...check, counts: await counts(context.userId) };
  });

export const adminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ configured: !!process.env["ADMIN_PASSWORD"] }));

export const adminDeleteContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: pw, scope: z.enum(["mine", "all"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkAdminPassword } = await import("./admin.server");
    const check = await checkAdminPassword(context.userId, data.password);
    if (check.status !== "ok") return { ...check, deleted: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("contacts").delete({ count: "exact" });
    q = data.scope === "mine" ? q.eq("user_id", context.userId) : q.not("id", "is", null);
    const { count, error } = await q;
    if (error) throw new Error("Falha ao excluir contatos");
    return { status: "ok" as const, deleted: count ?? 0 };
  });

export const adminSetCompetition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      password: pw,
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { checkAdminPassword } = await import("./admin.server");
    const check = await checkAdminPassword(context.userId, data.password);
    if (check.status !== "ok") return check;
    if (data.end && data.end < data.start) return { status: "invalid" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("competition_settings").upsert({
      id: 1, start_date: data.start, end_date: data.end, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Falha ao salvar período");
    return { status: "ok" as const };
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminAddHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: pw, date: isoDate, name: z.string().trim().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkAdminPassword } = await import("./admin.server");
    const check = await checkAdminPassword(context.userId, data.password);
    if (check.status !== "ok") return check;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("holidays").upsert({ date: data.date, name: data.name });
    if (error) throw new Error("Falha ao salvar feriado");
    return { status: "ok" as const };
  });

export const adminRemoveHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: pw, date: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkAdminPassword } = await import("./admin.server");
    const check = await checkAdminPassword(context.userId, data.password);
    if (check.status !== "ok") return check;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("holidays").delete().eq("date", data.date);
    if (error) throw new Error("Falha ao remover feriado");
    return { status: "ok" as const };
  });
