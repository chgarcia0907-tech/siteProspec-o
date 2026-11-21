import { afterEach, describe, expect, it, vi } from "vitest";
import { respostaRecusa, verificarBasic, verificarBearer } from "./segredos.server";

const pedido = (authorization?: string) =>
  new Request("https://x/api", { headers: authorization ? { authorization } : {} });

describe("segredos das rotas públicas", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("bearer: sem variável é sem_config; valor certo passa; errado é negado", () => {
    vi.stubEnv("ATS_INGEST_TOKEN", "");
    expect(verificarBearer(pedido("Bearer abc"), "ATS_INGEST_TOKEN")).toBe("sem_config");
    vi.stubEnv("ATS_INGEST_TOKEN", " abc\n"); // espaço e quebra de linha colados na Vercel
    expect(verificarBearer(pedido("Bearer abc"), "ATS_INGEST_TOKEN")).toBe("ok");
    expect(verificarBearer(pedido("Bearer abc "), "ATS_INGEST_TOKEN")).toBe("ok");
    expect(verificarBearer(pedido("Bearer abd"), "ATS_INGEST_TOKEN")).toBe("negado");
    expect(verificarBearer(pedido("abc"), "ATS_INGEST_TOKEN")).toBe("negado");
    expect(verificarBearer(pedido(), "ATS_INGEST_TOKEN")).toBe("negado");
  });

  it("basic: precisa das duas variáveis", () => {
    const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
    vi.stubEnv("U", "pd");
    vi.stubEnv("P", "");
    expect(verificarBasic(pedido(basic("pd", "x")), "U", "P")).toBe("sem_config");
    vi.stubEnv("P", "segredo");
    expect(verificarBasic(pedido(basic("pd", "segredo")), "U", "P")).toBe("ok");
    expect(verificarBasic(pedido(basic("pd", "outro")), "U", "P")).toBe("negado");
  });

  it("503 diz qual variável falta; 401 só recusa", async () => {
    const r = respostaRecusa("sem_config", "CRON_SECRET");
    expect(r.status).toBe(503);
    expect((await r.json()).erro).toContain("CRON_SECRET");
    expect(respostaRecusa("negado", "CRON_SECRET").status).toBe(401);
  });
});
