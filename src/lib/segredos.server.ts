// Conferência dos segredos das rotas públicas (somente servidor). Distingue "o segredo não está
// configurado nesta implantação" (503, problema de variável na Vercel) de "o pedido mandou o
// segredo errado" (401), para o diagnóstico não depender de tentativa e erro.
import { timingSafeEqual } from "crypto";

export type Verificacao = "ok" | "sem_config" | "negado";

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const variavel = (nome: string) => (process.env[nome] ?? "").trim();

/** `Authorization: Bearer <valor de env>`. */
export function verificarBearer(request: Request, env: string): Verificacao {
  const segredo = variavel(env);
  if (!segredo) return "sem_config";
  const m = /^Bearer\s+(.+)$/i.exec((request.headers.get("authorization") ?? "").trim());
  return m && iguais(m[1]!.trim(), segredo) ? "ok" : "negado";
}

/** Basic auth com usuário e senha vindos de duas variáveis de ambiente. */
export function verificarBasic(request: Request, envUser: string, envPass: string): Verificacao {
  const user = variavel(envUser);
  const pass = variavel(envPass);
  if (!user || !pass) return "sem_config";
  const m = /^Basic\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m) return "negado";
  return iguais(Buffer.from(m[1]!, "base64").toString("utf8"), `${user}:${pass}`) ? "ok" : "negado";
}

/** Resposta para quem não passou: 503 diz qual variável falta, 401 só recusa. */
export function respostaRecusa(v: Exclude<Verificacao, "ok">, variaveis: string): Response {
  if (v === "sem_config") {
    return Response.json(
      {
        erro: `Não configurado nesta implantação: ${variaveis}. Cadastre na Vercel (Production) e faça um novo deploy.`,
      },
      { status: 503 },
    );
  }
  return new Response("Unauthorized", { status: 401 });
}
