// Contrato entre a skill criar-card (claude.ai) e a plataforma: POST /api/public/ats com
// `Authorization: Bearer <ATS_INGEST_TOKEN>`. Três ações, todas idempotentes:
//   - conferir: ATs com o mesmo prospect (duplicata, ou achar o card para remarcar).
//   - marcar: registra a AT do card recém-criado (card repetido não duplica).
//   - remarcar: grava a remarcação no log (a mesma nova data duas vezes não duplica).
// Tudo aqui é puro; o servidor (`atsSkill.server.ts`) lê e grava com service role.
import { normName } from "./auditoria";
import { paraDatetimeLocal, type AtRow } from "./ats";

const CANAIS = ["LinkedIn", "E-mail", "WhatsApp", "Cold Call", "Instagram"] as const;

export type TasksDoCard = {
  at?: number | null;
  tp1?: number | null;
  tp3?: number | null;
  tp4?: number | null;
};

export type PedidoConferir = {
  acao: "conferir";
  empresa: string;
  prospect: string;
  card: number | null;
};
export type PedidoMarcar = {
  acao: "marcar";
  card: number;
  hunter: string | null;
  cn: string | null;
  canal: string | null;
  mensagem: string | null;
  empresa: string;
  prospect: string;
  cargo: string | null;
  setor: string | null;
  linkedin: string | null;
  motivo: string | null;
  ficha: string | null;
  /** ISO com -03:00. */
  agendada: string;
  pessoa: number | null;
  organizacao: number | null;
  tasks: TasksDoCard;
};
export type PedidoRemarcar = {
  acao: "remarcar";
  card: number;
  /** ISO com -03:00. */
  nova: string;
  motivo: string | null;
  ficha: string | null;
  tasks: TasksDoCard;
};
export type Pedido = PedidoConferir | PedidoMarcar | PedidoRemarcar;

/** "2026-11-20 10:00" ou "2026-11-20T10:00" (Brasília), ou ISO com fuso → ISO; senão null. */
export function dataHoraDaSkill(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(t);
  if (m) {
    const iso = `${m[1]}T${m[2]}:${m[3]}:00-03:00`;
    return Number.isNaN(Date.parse(iso)) || Number(m[2]) > 23 || Number(m[3]) > 59 ? null : iso;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(t)) {
    return Number.isNaN(Date.parse(t)) ? null : t;
  }
  return null;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const id = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
};
const login = (v: unknown) => texto(v)?.replace(/^@/, "").toLowerCase() ?? null;

function lerTasks(v: unknown): TasksDoCard {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { at: id(o["at"]), tp1: id(o["tp1"]), tp3: id(o["tp3"]), tp4: id(o["tp4"]) };
}

/** Canal da ficha na grafia da plataforma (e-mail, whatsapp, coldcall...) ou null. */
export function canalDaSkill(v: unknown): string | null {
  const t = texto(v)
    ?.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (!t) return null;
  const mapa: Record<string, (typeof CANAIS)[number]> = {
    linkedin: "LinkedIn",
    email: "E-mail",
    whatsapp: "WhatsApp",
    wpp: "WhatsApp",
    coldcall: "Cold Call",
    ligacao: "Cold Call",
    instagram: "Instagram",
  };
  return mapa[t] ?? null;
}

/** Valida o corpo do POST. Devolve o pedido pronto ou a mensagem do que falta. */
export function lerPedido(body: unknown): { pedido: Pedido } | { erro: string } {
  if (!body || typeof body !== "object") return { erro: "Corpo JSON obrigatório." };
  const b = body as Record<string, unknown>;
  const acao = b["acao"];
  if (acao === "conferir") {
    const empresa = texto(b["empresa"]) ?? "";
    const prospect = texto(b["prospect"]) ?? "";
    const card = id(b["card"]);
    if (!card && !prospect) return { erro: "Informe card ou prospect." };
    return { pedido: { acao, empresa, prospect, card } };
  }
  if (acao === "marcar") {
    const card = id(b["card"]);
    const empresa = texto(b["empresa"]);
    const prospect = texto(b["prospect"]);
    const agendada = dataHoraDaSkill(b["agendada"]);
    const faltam = [
      !card && "card",
      !empresa && "empresa",
      !prospect && "prospect",
      !agendada && "agendada (AAAA-MM-DD HH:MM, Brasília)",
    ].filter(Boolean);
    if (faltam.length) return { erro: `Campos obrigatórios: ${faltam.join(", ")}.` };
    const canalBruto = texto(b["canal"]);
    const canal = canalDaSkill(canalBruto);
    if (canalBruto && !canal) return { erro: `Canal desconhecido: ${canalBruto}.` };
    return {
      pedido: {
        acao,
        card: card!,
        hunter: login(b["hunter"]),
        cn: login(b["cn"]),
        canal,
        mensagem: texto(b["mensagem"]),
        empresa: empresa!,
        prospect: prospect!,
        cargo: texto(b["cargo"]),
        setor: texto(b["setor"]),
        linkedin: texto(b["linkedin"]),
        motivo: texto(b["motivo"]),
        ficha: texto(b["ficha"]),
        agendada: agendada!,
        pessoa: id(b["pessoa"]),
        organizacao: id(b["organizacao"]),
        tasks: lerTasks(b["tasks"]),
      },
    };
  }
  if (acao === "remarcar") {
    const card = id(b["card"]);
    const nova = dataHoraDaSkill(b["nova"]);
    const faltam = [!card && "card", !nova && "nova (AAAA-MM-DD HH:MM, Brasília)"].filter(Boolean);
    if (faltam.length) return { erro: `Campos obrigatórios: ${faltam.join(", ")}.` };
    return {
      pedido: {
        acao,
        card: card!,
        nova: nova!,
        motivo: texto(b["motivo"]),
        ficha: texto(b["ficha"]),
        tasks: lerTasks(b["tasks"]),
      },
    };
  }
  return { erro: 'acao deve ser "conferir", "marcar" ou "remarcar".' };
}

/** "2026-11-20 10:00" em Brasília, o formato que a skill usa. */
export const paraSkill = (iso: string) => paraDatetimeLocal(iso).replace("T", " ");

export type AtParaConferir = Pick<
  AtRow,
  | "pipedrive_deal_id"
  | "empresa"
  | "prospect"
  | "hunter_login"
  | "cn_login"
  | "canal"
  | "status"
  | "agendada_atual"
  | "pipedrive_activity_at_id"
  | "pipedrive_activity_tp1_id"
  | "pipedrive_activity_tp3_id"
  | "pipedrive_activity_tp4_id"
>;

const mesmaEmpresa = (a: string, b: string) => {
  const x = normName(a);
  const y = normName(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

/**
 * ATs do mesmo card ou com o mesmo prospect (sem acento nem caixa), com o que a skill precisa para
 * decidir: mesma empresa é duplicata; outra empresa, ela pergunta.
 */
export function conferir(ats: readonly AtParaConferir[], p: PedidoConferir) {
  const nome = normName(p.prospect);
  return ats
    .filter(
      (a) => (p.card && a.pipedrive_deal_id === p.card) || (nome && normName(a.prospect) === nome),
    )
    .map((a) => ({
      card: a.pipedrive_deal_id,
      empresa: a.empresa,
      prospect: a.prospect,
      mesma_empresa: p.empresa ? mesmaEmpresa(a.empresa, p.empresa) : null,
      hunter: a.hunter_login,
      cn: a.cn_login,
      canal: a.canal,
      status: a.status,
      agendada_atual: paraSkill(a.agendada_atual),
      tasks: {
        at: a.pipedrive_activity_at_id,
        tp1: a.pipedrive_activity_tp1_id,
        tp3: a.pipedrive_activity_tp3_id,
        tp4: a.pipedrive_activity_tp4_id,
      },
    }));
}

/** Linha de `ats` para a AT registrada pela skill (o banco carimba status e o evento "marcada"). */
export function linhaDaSkill(
  p: PedidoMarcar,
  ctx: {
    userId: string | null;
    contato: { id: string; resposta_etapa: number | null; resposta_modelo: string | null } | null;
    agora: string;
  },
) {
  return {
    tipo: "diagnostico",
    origem: "skill",
    user_id: ctx.userId,
    hunter_login: p.hunter,
    cn_login: p.cn,
    contact_id: ctx.contato?.id ?? null,
    resposta_etapa: ctx.contato?.resposta_etapa ?? null,
    resposta_modelo: ctx.contato?.resposta_modelo ?? null,
    canal: p.canal,
    mensagem_ficha: p.mensagem,
    empresa: p.empresa,
    prospect: p.prospect,
    cargo: p.cargo,
    setor: p.setor,
    linkedin: p.linkedin,
    motivo_prospeccao: p.motivo,
    ficha_original: p.ficha,
    agendada_original: p.agendada,
    agendada_atual: p.agendada,
    registrada_em: ctx.agora,
    pipedrive_deal_id: p.card,
    pipedrive_person_id: p.pessoa,
    pipedrive_org_id: p.organizacao,
    pipedrive_activity_at_id: p.tasks.at ?? null,
    pipedrive_activity_tp1_id: p.tasks.tp1 ?? null,
    pipedrive_activity_tp3_id: p.tasks.tp3 ?? null,
    pipedrive_activity_tp4_id: p.tasks.tp4 ?? null,
  };
}

/** Evento de remarcação da skill; o `pipedrive_ref` faz a mesma nova data não duplicar. */
export function eventoRemarcacaoDaSkill(
  at: { id: string; agendada_atual: string },
  p: PedidoRemarcar,
  agora: string,
) {
  return {
    at_id: at.id,
    evento: "remarcada" as const,
    ocorrido_em: agora,
    horario_anterior: at.agendada_atual,
    horario_novo: p.nova,
    motivo: p.motivo ?? "Ficha de Remarcação",
    origem: "skill" as const,
    pipedrive_ref: `skill:remarcada:${p.card}:${new Date(p.nova).toISOString()}`,
  };
}

/** Ids de tasks que a remarcação recriou, para atualizar a AT (só os informados). */
export function tasksNovas(t: TasksDoCard) {
  const out: Partial<
    Record<
      | "pipedrive_activity_at_id"
      | "pipedrive_activity_tp1_id"
      | "pipedrive_activity_tp3_id"
      | "pipedrive_activity_tp4_id",
      number
    >
  > = {};
  if (t.at) out.pipedrive_activity_at_id = t.at;
  if (t.tp1) out.pipedrive_activity_tp1_id = t.tp1;
  if (t.tp3) out.pipedrive_activity_tp3_id = t.tp3;
  if (t.tp4) out.pipedrive_activity_tp4_id = t.tp4;
  return out;
}
