import { timingSafeEqual, createHash } from "crypto";

export type AdminCheck = {
  status: "ok" | "not_configured" | "locked" | "wrong";
  remaining?: number;
  lockedUntil?: string;
};

const MAX = 5;
const LOCK_MIN = 15;

/** Valida a senha de administrador com bloqueio de 5 tentativas / 15 min por usuário. */
export async function checkAdminPassword(userId: string, password: string): Promise<AdminCheck> {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) return { status: "not_configured" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("admin_attempts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const now = Date.now();
  if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
    return { status: "locked", lockedUntil: row.locked_until };
  }
  const h = (v: string) => createHash("sha256").update(v, "utf8").digest();
  const ok = timingSafeEqual(h(password), h(expected));
  if (ok) {
    await supabaseAdmin.from("admin_attempts").upsert({
      user_id: userId,
      failures: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });
    return { status: "ok" };
  }
  const failures = (row?.locked_until ? 0 : (row?.failures ?? 0)) + 1;
  const locked = failures >= MAX;
  const lockedUntil = locked ? new Date(now + LOCK_MIN * 60_000).toISOString() : null;
  await supabaseAdmin.from("admin_attempts").upsert({
    user_id: userId,
    failures: locked ? 0 : failures,
    locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  });
  return locked
    ? { status: "locked", lockedUntil: lockedUntil! }
    : { status: "wrong", remaining: MAX - failures };
}
