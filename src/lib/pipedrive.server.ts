// Integração com o Pipedrive (somente servidor). O status das ATs com card vem do Pipedrive:
// o webhook avisa que um card ou uma task mudou, a reconciliação diária passa por todas as ATs, e
// as duas buscam o estado atual pela API v2 e gravam o que `eventosDoPipedrive` devolver.
// Segredos (variáveis da Vercel): PIPEDRIVE_API_TOKEN, PIPEDRIVE_WEBHOOK_USER,
// PIPEDRIVE_WEBHOOK_PASSWORD e CRON_SECRET.
import { timingSafeEqual } from "crypto";
import {
  dealDoWebhook,
  eventosDoPipedrive,
  type AtNoBanco,
  type EventoPipedrive,
  type PdActivity,
  type PdDeal,
} from "./pipedrive";

// PIPEDRIVE_API_URL só existe para os testes de ponta a ponta (Pipedrive simulado).
const api = () => process.env["PIPEDRIVE_API_URL"] ?? "https://api.pipedrive.com/api/v2";

async function pd<T>(path: string): Promise<T> {
  const token = process.env["PIPEDRIVE_API_TOKEN"];
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN não configurado");
  const res = await fetch(`${api()}${path}`, {
    headers: { "x-api-token": token, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Pipedrive ${res.status} em ${path.split("?")[0]}`);
  const body = (await res.json()) as { success?: boolean; data?: T };
  if (body.success === false || body.data === undefined) {
    throw new Error(`Pipedrive sem dados em ${path.split("?")[0]}`);
  }
  return body.data;
}

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Basic auth configurado no webhook do Pipedrive ("HTTP auth" ao criar o webhook). */
export function webhookAutorizado(request: Request): boolean {
  const user = process.env["PIPEDRIVE_WEBHOOK_USER"] ?? "";
  const pass = process.env["PIPEDRIVE_WEBHOOK_PASSWORD"] ?? "";
  if (!user || !pass) return false;
  const m = /^Basic\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m) return false;
  const dado = Buffer.from(m[1]!, "base64").toString("utf8");
  return iguais(dado, `${user}:${pass}`);
}

/** Cron da Vercel: `Authorization: Bearer <CRON_SECRET>`. */
export function cronAutorizado(request: Request): boolean {
  const segredo = process.env["CRON_SECRET"] ?? "";
  if (!segredo) return false;
  return iguais(request.headers.get("authorization") ?? "", `Bearer ${segredo}`);
}

export type ResultadoSync = {
  deal: number;
  gravados: EventoPipedrive["evento"][];
  erro?: string;
};

type AtRow = AtNoBanco & { id: string; pipedrive_deal_id: number };

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const COLUNAS =
  "id, status, agendada_atual, pipedrive_stage_id, pipedrive_activity_at_id, pipedrive_deal_id";

/** Busca o card e as tasks no Pipedrive e grava no log os eventos que faltam para uma AT. */
type Origem = "pipedrive_webhook" | "pipedrive_reconciliacao";

/** Busca o card e as tasks no Pipedrive e grava no log os eventos que faltam para uma AT. */
async function sincronizarAt(at: AtRow, origem: Origem): Promise<ResultadoSync> {
  const db = await adminDb();
  const [deal, acts, ja] = await Promise.all([
    pd<PdDeal>(`/deals/${at.pipedrive_deal_id}`),
    pd<PdActivity[]>(`/activities?deal_id=${at.pipedrive_deal_id}&limit=100`),
    db
      .from("at_eventos")
      .select("pipedrive_ref")
      .eq("at_id", at.id)
      .not("pipedrive_ref", "is", null),
  ]);
  if (ja.error) throw ja.error;
  // O índice único é por (origem, pipedrive_ref): a conferência aqui evita que a reconciliação
  // repita o que o webhook já gravou (e vice-versa).
  const registrados = new Set((ja.data ?? []).map((r) => r.pipedrive_ref));
  const eventos = eventosDoPipedrive(at, deal, acts ?? []).filter(
    (e) => !registrados.has(e.pipedrive_ref),
  );
  const gravados: EventoPipedrive["evento"][] = [];
  // Um por vez: cada insert ganha seu created_at e o trigger recalcula o resumo na ordem.
  for (const e of eventos) {
    const { error } = await db.from("at_eventos").insert({ ...e, at_id: at.id, origem });
    if (error && error.code !== "23505") throw error; // 23505: gravado ao mesmo tempo por outra chamada
    if (!error) gravados.push(e.evento);
  }
  return { deal: at.pipedrive_deal_id, gravados };
}

/** Sincroniza a AT do card, se houver. */
export async function sincronizarDeal(dealId: number): Promise<ResultadoSync | null> {
  const db = await adminDb();
  const { data, error } = await db
    .from("ats")
    .select(COLUNAS)
    .eq("pipedrive_deal_id", dealId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sincronizarAt(data as AtRow, "pipedrive_webhook");
}

/**
 * Reconciliação: passa por todas as ATs com card que ainda podem mudar (agendadas, ou com a AT nos
 * últimos 30 dias), uma de cada vez para respeitar o limite da API. Um card com erro não para os
 * outros.
 */
export async function sincronizarTodas(agora = new Date()): Promise<ResultadoSync[]> {
  const db = await adminDb();
  const desde = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("ats")
    .select(COLUNAS)
    .not("pipedrive_deal_id", "is", null)
    .or(`status.eq.agendada,agendada_atual.gte.${desde}`)
    .order("agendada_atual");
  if (error) throw error;
  const out: ResultadoSync[] = [];
  for (const at of (data ?? []) as AtRow[]) {
    try {
      out.push(await sincronizarAt(at, "pipedrive_reconciliacao"));
    } catch (e) {
      out.push({ deal: at.pipedrive_deal_id, gravados: [], erro: (e as Error).message });
    }
  }
  return out;
}

/**
 * Webhook: guarda o payload bruto, sincroniza o card citado e anota o resultado no log. Responde
 * 200 mesmo quando o card não tem AT (o Pipedrive desativa webhooks que falham muito).
 */
export async function receberWebhook(body: unknown): Promise<{ deal: number | null; ok: boolean }> {
  const db = await adminDb();
  const deal = dealDoWebhook(body);
  const meta = ((body as Record<string, unknown> | null)?.["meta"] ?? {}) as Record<
    string,
    unknown
  >;
  const evento = [meta["action"], meta["entity"] ?? meta["object"]].filter(Boolean).join(".");
  const { data: log } = await db
    .from("pipedrive_webhook_log")
    .insert({ evento: evento || null, objeto_id: deal, payload: (body ?? {}) as never })
    .select("id")
    .single();
  let erro: string | null = null;
  try {
    if (deal) await sincronizarDeal(deal);
  } catch (e) {
    erro = (e as Error).message;
    console.error("[pipedrive/webhook]", erro);
  }
  if (log?.id) {
    await db
      .from("pipedrive_webhook_log")
      .update({ processado_em: new Date().toISOString(), erro })
      .eq("id", log.id);
  }
  return { deal, ok: !erro };
}
