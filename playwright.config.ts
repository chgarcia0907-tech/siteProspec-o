import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta contra o build de produção e um Supabase simulado (e2e/).
// Rode com `bun run e2e`: o script gera o build apontando para o mock antes dos testes.
const MOCK = "http://127.0.0.1:54399";
const APP = "http://127.0.0.1:3999";

export default defineConfig({
  testDir: "e2e",
  // O banco simulado é compartilhado: os testes rodam em sequência e cada um o reinicia.
  workers: 1,
  fullyParallel: false,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: APP,
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
    trace: "off",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-supabase.mjs",
      url: `${MOCK}/__mutations`,
      reuseExistingServer: false,
    },
    {
      command: "node .output/server/index.mjs",
      url: `${APP}/auth`,
      reuseExistingServer: false,
      env: {
        PORT: "3999",
        SUPABASE_URL: MOCK,
        SUPABASE_PUBLISHABLE_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
        SHEET_EXPORT_TOKEN: "e2e-token",
        ADMIN_PASSWORD: "e2e-admin",
      },
    },
  ],
});
