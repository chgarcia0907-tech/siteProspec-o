// Endpoint da skill criar-card (somente servidor): POST /api/public/ats com
// `Authorization: Bearer <ATS_INGEST_TOKEN>`. A regra do contrato está em `atsSkill.ts`.
import { contatoDaAt } from "./ats";
import {
  conferir,
  eventoRemarcacaoDaSkill,
  linhaDaSkill,
  paraSkill,
  tasksNovas,
  type AtParaConferir,
  type Pedido,
  type PedidoMarcar,
  type PedidoRemarcar,
} from "./atsSkill";
import { fetchAll } from "./fetch-all";
import { verificarBearer } from "./segredos.server";

export const verificarSkill = (request: Request) => verificarBearer(request, "ATS_INGEST_TOKEN");

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Resposta = { status: number; corpo: Record<string, unknown> };

const COLUNAS_CONFERIR =
  "pipedrive_deal_id, empresa, prospect, hunter_login, cn_login, canal, status, agendada_atual, pipedrive_activity_at_id, pipedrive_activity_tp1_id, pipedrive_activity_tp3_id, pipedrive_activity_tp4_id";

/** Conta da plataforma do hunter: a do time comercial, senão a do e-mail que começa pelo login. */
async function contaDoHunter(login: string | null): Promise<string | null> {
  if (!login) return null;
  const db = await adminDb();
  const { data: t } = await db
    .from("time_comercial")
    .select("user_id")
    .eq("login", login)
    .maybeSingle();
  if (t?.user_id) return t.user_id;
  const { data: perfis } = await db
    .from("profiles")
    .select("id, email")
    .ilike("email", `${login}@%`);
  const iguais = (perfis ?? []).filter(
    (p) => (p.email ?? "").toLowerCase().split("@")[0] === login,
  );
  return iguais.length === 1 ? iguais[0]!.id : null;
}

async function marcar(p: PedidoMarcar): Promise<Resposta> {
  const db = await adminDb();
  const { data: existe, error: e1 } = await db
    .from("ats")
    .select("id")
    .eq("pipedrive_deal_id", p.card)
    .maybeSingle();
  if (e1) throw e1;
  if (existe) return { status: 200, corpo: { ok: true, ja_existia: true, card: p.card } };

  const userId = await contaDoHunter(p.hunter);
  let contato: {
    id: string;
    resposta_etapa: number | null;
    resposta_modelo: string | null;
  } | null = null;
  if (userId) {
    const { data: contatos, error } = await db
      .from("contacts")
      .select("id, name, company, resposta_etapa, resposta_modelo")
      .eq("user_id", userId);
    if (error) throw error;
    const idContato = contatoDaAt(p, contatos ?? []);
    contato = (contatos ?? []).find((c) => c.id === idContato) ?? null;
  }
  const linha = linhaDaSkill(p, { userId, contato, agora: new Date().toISOString() });
  const { error } = await db.from("ats").insert(linha);
  if (error?.code === "23505")
    return { status: 200, corpo: { ok: true, ja_existia: true, card: p.card } };
  if (error) throw error;
  return {
    status: 201,
    corpo: {
      ok: true,
      ja_existia: false,
      card: p.card,
      hunter_com_conta: !!userId,
      contato_ligado: !!contato,
    },
  };
}

async function remarcar(p: PedidoRemarcar): Promise<Resposta> {
  const db = await adminDb();
  const { data: at, error: e1 } = await db
    .from("ats")
    .select("id, agendada_atual")
    .eq("pipedrive_deal_id", p.card)
    .maybeSingle();
  if (e1) throw e1;
  if (!at) {
    return {
      status: 404,
      corpo: {
        ok: false,
        erro: `Nenhuma AT com o card ${p.card} na plataforma. Registre com acao "marcar".`,
      },
    };
  }
  const tasks = tasksNovas(p.tasks);
  if (Object.keys(tasks).length) {
    const { error } = await db.from("ats").update(tasks).eq("id", at.id);
    if (error) throw error;
  }
  const anterior = paraSkill(at.agendada_atual);
  // Já está nessa data (pedido repetido, ou o webhook do Pipedrive chegou antes ao mover as tasks):
  // não grava outra remarcação; só troca o motivo genérico do webhook pelo da ficha.
  if (Date.parse(at.agendada_atual) === Date.parse(p.nova)) {
    if (p.motivo) {
      await db
        .from("at_eventos")
        .update({ motivo: p.motivo })
        .eq("at_id", at.id)
        .eq("evento", "remarcada")
        .eq("motivo", "Remarcada no Pipedrive");
    }
    return {
      status: 200,
      corpo: { ok: true, ja_registrada: true, card: p.card, horario: paraSkill(p.nova) },
    };
  }
  const evento = eventoRemarcacaoDaSkill(at, p, new Date().toISOString());
  const { error } = await db.from("at_eventos").insert(evento);
  if (error && error.code !== "23505") throw error;
  return {
    status: 200,
    corpo: {
      ok: true,
      ja_registrada: false,
      card: p.card,
      horario_anterior: anterior,
      horario_novo: paraSkill(p.nova),
    },
  };
}

export async function atenderSkill(p: Pedido): Promise<Resposta> {
  if (p.acao === "marcar") return marcar(p);
  if (p.acao === "remarcar") return remarcar(p);
  const db = await adminDb();
  // status no banco é texto com CHECK; o tipo da tela estreita para AtStatus.
  const ats = (await fetchAll((a, b) =>
    db.from("ats").select(COLUNAS_CONFERIR).order("registrada_em").range(a, b),
  )) as AtParaConferir[];
  return { status: 200, corpo: { ok: true, ats: conferir(ats, p) } };
}
