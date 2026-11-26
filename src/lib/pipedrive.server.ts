// Integração com o Pipedrive (somente servidor). O status das ATs com card vem do Pipedrive:
// o webhook avisa que um card ou uma task mudou, a reconciliação diária passa por todas as ATs, e
// as duas buscam o estado atual pela API v2 e gravam o que `eventosDoPipedrive` devolver.
// Segredos (variáveis da Vercel): PIPEDRIVE_API_TOKEN, PIPEDRIVE_WEBHOOK_USER,
// PIPEDRIVE_WEBHOOK_PASSWORD e CRON_SECRET.
import { verificarBasic, verificarBearer } from "./segredos.server";
import {
  dealDoWebhook,
  eventosDoPipedrive,
  type AtNoBanco,
  type EventoPipedrive,
  type PdActivity,
  type PdDeal,
} from "./pipedrive";

// PIPEDRIVE_API_URL só existe para os testes de ponta a ponta (Pipedrive simulado).
const API_V2 = "https://api.pipedrive.com/api/v2";
const api = () => process.env["PIPEDRIVE_API_URL"] ?? API_V2;
/** API v1 (histórico do card): no simulado, `<base>/v1`. */
const apiV1 = () => (api() === API_V2 ? "https://api.pipedrive.com/v1" : `${api()}/v1`);

type Pagina<T> = { success?: boolean; data?: T; additional_data?: { next_cursor?: string | null } };

async function pdBruto<T>(path: string): Promise<Pagina<T>> {
  const token = (process.env["PIPEDRIVE_API_TOKEN"] ?? "").trim();
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN não configurado nesta implantação");
  const res = await fetch(`${api()}${path}`, {
    headers: { "x-api-token": token, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Pipedrive ${res.status} em ${path.split("?")[0]}`);
  const body = (await res.json()) as Pagina<T>;
  if (body.success === false || body.data === undefined) {
    throw new Error(`Pipedrive sem dados em ${path.split("?")[0]}`);
  }
  return body;
}

export async function pd<T>(path: string): Promise<T> {
  return (await pdBruto<T>(path)).data as T;
}

/** Lista inteira de um endpoint paginado por cursor (API v2), 500 por página. */
export async function pdTodas<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null | undefined = null;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const pagina: Pagina<T[]> = await pdBruto<T[]>(
      `${path}${sep}limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    out.push(...(pagina.data ?? []));
    cursor = pagina.additional_data?.next_cursor;
  } while (cursor);
  return out;
}

/** Basic auth configurado no webhook do Pipedrive ("HTTP auth" ao criar o webhook). */
export const verificarWebhook = (request: Request) =>
  verificarBasic(request, "PIPEDRIVE_WEBHOOK_USER", "PIPEDRIVE_WEBHOOK_PASSWORD");

/** Cron da Vercel: `Authorization: Bearer <CRON_SECRET>`. */
export const verificarCron = (request: Request) => verificarBearer(request, "CRON_SECRET");

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
  // Cópia do card para a dashboard: falha aqui não muda a resposta do webhook (o cron recupera).
  if (deal) {
    try {
      const r = await sincronizarCards({ dealIds: [deal] });
      if (r.erros.length) console.error("[pipedrive/webhook] cópia do card", r.erros);
    } catch (e) {
      console.error("[pipedrive/webhook] cópia do card", (e as Error).message);
    }
  }
  if (log?.id) {
    await db
      .from("pipedrive_webhook_log")
      .update({ processado_em: new Date().toISOString(), erro })
      .eq("id", log.id);
  }
  return { deal, ok: !erro };
}

/* ------------------------------ Cópia dos cards ------------------------------ */

type PaginaV1<T> = {
  success?: boolean;
  data?: T[] | null;
  additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } };
};

/** Lista inteira de um endpoint da API v1 (paginada por `start`). */
async function pdV1Todas<T>(path: string): Promise<T[]> {
  const token = (process.env["PIPEDRIVE_API_TOKEN"] ?? "").trim();
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN não configurado nesta implantação");
  const out: T[] = [];
  let start: number | null = 0;
  while (start !== null) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${apiV1()}${path}${sep}start=${start}&limit=500`, {
      headers: { "x-api-token": token, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Pipedrive ${res.status} em ${path.split("?")[0]}`);
    const body = (await res.json()) as PaginaV1<T>;
    out.push(...(body.data ?? []));
    const pg = body.additional_data?.pagination;
    start = pg?.more_items_in_collection && pg.next_start !== undefined ? pg.next_start : null;
  }
  return out;
}

/** Roda `fn` em todos os itens, `limite` por vez (respeita o limite de chamadas do Pipedrive). */
async function emLotes<T>(itens: readonly T[], limite: number, fn: (t: T) => Promise<void>) {
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) await fn(itens[proximo++]!);
    }),
  );
}

const pedacos = <T>(v: readonly T[], n: number) =>
  Array.from({ length: Math.ceil(v.length / n) }, (_, i) => v.slice(i * n, i * n + n));

export type ResultadoCards = {
  sincronizados: number;
  /** Cards que mudaram e ficaram para a próxima chamada (limite por chamada). */
  restantes: number;
  erros: { deal: number; erro: string }[];
};

/**
 * Copia para `pd_cards` (com o histórico de etapas e as tasks) os cards do outbound NTec e os
 * ligados a uma AT, só os que mudaram desde a última cópia, até `limite` por chamada. Com
 * `dealIds`, olha só esses cards (webhook). Um card com erro não para os outros.
 */
export async function sincronizarCards(
  opcoes: { limite?: number; dealIds?: number[] } = {},
): Promise<ResultadoCards> {
  const limite = opcoes.limite ?? 100;
  const db = await adminDb();
  const esp = await import("./espelhoPipedrive");
  type CampoPd = { field_code: string; options?: { id: number; label: string }[] | null };

  const [lista, campos, copia, ats] = await Promise.all([
    opcoes.dealIds
      ? Promise.all(
          pedacos(opcoes.dealIds, 100).map((ids) =>
            pd<import("./espelhoPipedrive").PdCard[]>(`/deals?ids=${ids.join(",")}`),
          ),
        ).then((p) => p.flat())
      : pdTodas<import("./espelhoPipedrive").PdCard>(`/deals?pipeline_id=${esp.FUNIL_NTEC}`),
    pd<CampoPd[]>("/dealFields?limit=500"),
    db.from("pd_cards").select("deal_id, update_time"),
    db.from("ats").select("pipedrive_deal_id").not("pipedrive_deal_id", "is", null),
  ]);
  if (copia.error ?? ats.error) throw copia.error ?? ats.error;
  const ligados = new Set((ats.data ?? []).map((a) => a.pipedrive_deal_id as number));

  // Cards ligados a uma AT que não vieram na lista (outro funil, por exemplo).
  const naLista = new Set(lista.map((d) => d.id));
  const faltam = opcoes.dealIds ? [] : [...ligados].filter((id) => !naLista.has(id));
  const extras = (
    await Promise.all(
      pedacos(faltam, 100).map((ids) =>
        pd<import("./espelhoPipedrive").PdCard[]>(`/deals?ids=${ids.join(",")}`),
      ),
    )
  ).flat();

  const copiados = new Map((copia.data ?? []).map((c) => [c.deal_id, c]));
  const candidatos = [...lista, ...extras].filter(
    (d) => esp.ehCardOutbound(d) || ligados.has(d.id),
  );
  const pendentes = candidatos.filter((d) => esp.precisaSincronizar(d, copiados.get(d.id)));
  const lote = pendentes.slice(0, limite);

  const opcoesDe = (code: string) =>
    new Map((campos.find((c) => c.field_code === code)?.options ?? []).map((o) => [o.id, o.label]));
  const { CAMPO_HUNTER } = await import("./tasksHunter");
  const mapas = {
    hunter: opcoesDe(CAMPO_HUNTER),
    canal: opcoesDe(esp.CAMPO_CANAL_ENTRADA),
    funcionarios: opcoesDe(esp.CAMPO_FUNCIONARIOS),
  };

  // Cargo da pessoa de cada card, em lotes de 100.
  type PessoaPd = { id: number; custom_fields?: Record<string, unknown> | null };
  const pessoas = [...new Set(lote.map((d) => d.person_id).filter((x): x is number => !!x))];
  const cargoDe = new Map<number, string>();
  for (const ids of pedacos(pessoas, 100)) {
    const ps = await pd<PessoaPd[]>(`/persons?ids=${ids.join(",")}`);
    for (const p of ps) {
      const c = p.custom_fields?.[esp.CAMPO_CARGO_PESSOA];
      if (typeof c === "string" && c.trim()) cargoDe.set(p.id, c);
    }
  }

  const erros: ResultadoCards["erros"] = [];
  let sincronizados = 0;
  await emLotes(lote, 4, async (d) => {
    try {
      const [acts, fluxo] = await Promise.all([
        pd<(PdActivity & { type?: string | null })[]>(`/activities?deal_id=${d.id}&limit=500`),
        pdV1Todas<import("./espelhoPipedrive").PdFluxo>(`/deals/${d.id}/flow`),
      ]);
      const linha = esp.linhaDoCard(
        d,
        mapas,
        d.person_id ? (cargoDe.get(d.person_id) ?? null) : null,
        esp.ehCardOutbound(d),
      );
      const up = await db.from("pd_cards").upsert(linha);
      if (up.error) throw up.error;
      const etapas = esp.etapasDoFluxo(d, fluxo).map((e) => ({ ...e, deal_id: d.id }));
      const tasks = (acts ?? [])
        .map((a) => esp.linhaDaTask(a, d.id, linha.hunter_login ?? null))
        .filter((t): t is NonNullable<typeof t> => t !== null);
      const [delE, delT] = await Promise.all([
        db.from("pd_card_etapas").delete().eq("deal_id", d.id),
        db.from("pd_tasks").delete().eq("deal_id", d.id),
      ]);
      if (delE.error ?? delT.error) throw delE.error ?? delT.error;
      if (etapas.length) {
        const r = await db.from("pd_card_etapas").insert(etapas);
        if (r.error) throw r.error;
      }
      if (tasks.length) {
        const r = await db.from("pd_tasks").insert(tasks);
        if (r.error) throw r.error;
      }
      sincronizados++;
    } catch (e) {
      erros.push({ deal: d.id, erro: (e as Error).message });
    }
  });
  return { sincronizados, restantes: pendentes.length - lote.length, erros };
}
