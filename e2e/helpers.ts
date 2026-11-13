import { test as base, expect, type Page } from "@playwright/test";

export const MOCK = "http://127.0.0.1:54399";
const U1 = "11111111-1111-4111-8111-111111111111";
/** "Hoje" dos dados de teste (quinta-feira). */
export const TODAY = "2026-11-12";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
// Token no formato que o supabase-js aceita; o mock não confere a assinatura.
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: U1, role: "authenticated", aud: "authenticated", exp: 4102444800, email: "hunter1@example.com" })}.sig`;
const session = {
  access_token: jwt,
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4102444800,
  user: { id: U1, aud: "authenticated", role: "authenticated", email: "hunter1@example.com" },
};

export type Mutation = { method: string; table: string; query: string; body: string };

export async function mutations(): Promise<Mutation[]> {
  return (await fetch(`${MOCK}/__mutations`)).json();
}

export async function seed(n: number) {
  await fetch(`${MOCK}/__seed?n=${n}`, { method: "POST" });
}

/** Página com o hunter "Hunter Um" logado, relógio em 12/11/2026 e banco simulado zerado. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page, context }, provide) => {
    await fetch(`${MOCK}/__reset`, { method: "POST" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`));
    await page.addInitScript(
      (s) => localStorage.setItem("sb-127-auth-token", JSON.stringify(s)),
      session,
    );
    await provide(page);
  },
});

export { expect };
