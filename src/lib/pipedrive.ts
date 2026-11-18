// Regras puras da integração com o Pipedrive: a partir do card (deal) e das tasks (activities) de
// uma AT, decide quais eventos faltam no log `at_eventos`. O servidor (`pipedrive.server.ts`) busca
// o estado atual pela API (webhook ou reconciliação) e grava o que esta função devolver; como cada
// evento leva um `pipedrive_ref` único, rodar de novo com o mesmo estado não duplica nada.
//
// Como o NTec usa o Pipedrive (skill criar-card):
//   - Funil 6 "Vendas (CN)": etapa 108 "AT Diag. Agendada"; 31 "AT Diag. Realizada" e as seguintes
//     (33 AT Aprof. Marcada, 34 Proposta Agendada, 35 Negociação, 36 Aprov. Verbal) só existem
//     depois que a AT aconteceu.
//   - A task da AT tem assunto "AT - 16h30 @hunter", tipo meeting (reuniao_remarcada depois de
//     remarcar), vale o dia inteiro (sem due_time) e o horário fica no assunto.
//   - O campo nativo "Resultado" (outcome) da task diz o desfecho: Concluído, Reagendado, Não
//     compareceu ou Cancelado.

export const ETAPA_AT_AGENDADA = 108;
/** Etapas do funil 6 em que a AT diagnóstica já aconteceu. */
export const ETAPAS_DEPOIS_DA_AT: ReadonlySet<number> = new Set([31, 33, 34, 35, 36]);

/** Nomes das etapas do funil 6, para o motivo dos eventos. */
export const NOME_ETAPA: Readonly<Record<number, string>> = {
  108: "AT Diag. Agendada",
  31: "AT Diag. Realizada",
  33: "AT Aprof. Marcada",
  34: "Proposta Agendada",
  35: "Negociação",
  36: "Aprov. Verbal (Contrato)",
};

/** Opções do campo nativo "Resultado" (outcome) das activities. */
export const RESULTADO = {
  concluido: 663,
  reagendado: 664,
  naoCompareceu: 665,
  cancelado: 666,
} as const;

export type PdDeal = {
  id: number;
  stage_id: number;
  status: string;
  lost_reason?: string | null;
  update_time?: string | null;
  stage_change_time?: string | null;
  lost_time?: string | null;
};

export type PdActivity = {
  id: number;
  subject: string | null;
  type?: string | null;
  due_date: string | null;
  due_time?: string | null;
  done: boolean;
  is_deleted?: boolean | null;
  add_time?: string | null;
  update_time?: string | null;
  marked_as_done_time?: string | null;
  /** Id da opção; algumas respostas trazem `{ id, label }` ou só o rótulo. */
  outcome?: number | string | { id?: number; label?: string } | null;
};

/** O que a integração precisa saber da AT no banco. */
export type AtNoBanco = {
  status: "agendada" | "realizada" | "no_show" | "cancelada";
  agendada_atual: string;
  pipedrive_stage_id: number | null;
  pipedrive_activity_at_id: number | null;
};

export type EventoPipedrive = {
  evento: "remarcada" | "reaberta" | "no_show" | "realizada" | "cancelada" | "etapa_pipedrive";
  ocorrido_em: string;
  horario_anterior: string | null;
  horario_novo: string | null;
  motivo: string | null;
  pipedrive_stage_id: number | null;
  pipedrive_ref: string;
};

/** Datas do Pipedrive: v2 manda ISO com Z; a v1 mandava "2026-11-18 13:41:19" em UTC. */
export function isoDoPipedrive(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.includes("T") ? t : `${t.replace(" ", "T")}Z`;
  return Number.isNaN(Date.parse(s)) ? null : new Date(s).toISOString();
}

const ehTaskDaAt = (a: PdActivity) => !a.is_deleted && /^\s*AT\s*[-–—]/i.test(a.subject ?? "");

/**
 * A task da AT no card: entre as de assunto "AT - ...", a aberta mais recente; sem nenhuma aberta,
 * a mais recente (a remarcação pela skill cria outra quando a antiga já foi concluída). Sem
 * assunto reconhecível, a task gravada na AT.
 */
export function taskDaAt(acts: readonly PdActivity[], idGravado: number | null): PdActivity | null {
  const daAt = acts.filter(ehTaskDaAt);
  const recente = (l: PdActivity[]) =>
    [...l].sort((a, b) => (b.add_time ?? "").localeCompare(a.add_time ?? "") || b.id - a.id)[0] ??
    null;
  return (
    recente(daAt.filter((a) => !a.done)) ??
    recente(daAt) ??
    acts.find((a) => a.id === idGravado && !a.is_deleted) ??
    null
  );
}

/**
 * Horário da AT pela task, em Brasília (ISO com -03:00): o dia é o due_date e a hora vem do assunto
 * ("AT - 9h30 @..."); sem hora no assunto, do due_time (UTC no Pipedrive); sem nenhum dos dois,
 * a hora atual da AT no banco. Sem due_date, null.
 */
export function horarioDaTask(a: PdActivity, horaAtual: string): string | null {
  if (!a.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(a.due_date)) return null;
  const m = /AT\s*[-–—]\s*(\d{1,2})\s*h\s*(\d{2})?/i.exec(a.subject ?? "");
  let hhmm: string;
  if (m && Number(m[1]) < 24 && Number(m[2] ?? 0) < 60) {
    hhmm = `${m[1]!.padStart(2, "0")}:${m[2] ?? "00"}`;
  } else if (a.due_time && /^\d{2}:\d{2}/.test(a.due_time)) {
    const utc = new Date(`${a.due_date}T${a.due_time.slice(0, 5)}:00Z`);
    hhmm = utc.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    hhmm = new Date(horaAtual).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return `${a.due_date}T${hhmm}:00-03:00`;
}

/** Id da opção do "Resultado" em qualquer formato que a API devolva. */
export function resultadoId(o: PdActivity["outcome"]): number | null {
  if (o == null) return null;
  if (typeof o === "number") return o;
  if (typeof o === "object") {
    if (typeof o.id === "number") return o.id;
    return o.label ? resultadoId(o.label) : null;
  }
  const n = Number(o);
  if (Number.isInteger(n)) return n;
  const rotulo = o.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (rotulo === "concluido") return RESULTADO.concluido;
  if (rotulo === "reagendado") return RESULTADO.reagendado;
  if (rotulo === "nao compareceu") return RESULTADO.naoCompareceu;
  if (rotulo === "cancelado") return RESULTADO.cancelado;
  return null;
}

const mesmoInstante = (a: string, b: string) => Date.parse(a) === Date.parse(b);

/**
 * Eventos que faltam no log para a AT refletir o Pipedrive. Ordem de prioridade do desfecho: o
 * "Resultado" da task da AT; depois o card numa etapa posterior à AT (realizada); depois o card
 * perdido ainda na etapa da AT (cancelada). Task aberta com outra data/hora vira remarcação (vale
 * também depois de um no-show). Sem nenhum desses sinais, card aberto numa etapa anterior à AT
 * reabre a AT (volta a agendada, mesma data): é o card que voltou no funil. Cada evento leva no
 * `pipedrive_ref` o momento da mudança, então avançar e voltar várias vezes registra cada vez.
 */
export function eventosDoPipedrive(
  at: AtNoBanco,
  deal: PdDeal,
  acts: readonly PdActivity[],
): EventoPipedrive[] {
  const out: EventoPipedrive[] = [];
  const quandoDeal = isoDoPipedrive(deal.update_time) ?? new Date(0).toISOString();
  const base = {
    horario_anterior: null,
    horario_novo: null,
    motivo: null,
    pipedrive_stage_id: null,
  };

  if (deal.stage_id !== at.pipedrive_stage_id) {
    const quando = isoDoPipedrive(deal.stage_change_time) ?? quandoDeal;
    out.push({
      ...base,
      evento: "etapa_pipedrive",
      ocorrido_em: quando,
      pipedrive_stage_id: deal.stage_id,
      pipedrive_ref: `deal:${deal.id}:etapa:${deal.stage_id}:${quando}`,
    });
  }

  const task = taskDaAt(acts, at.pipedrive_activity_at_id);
  const quandoTask =
    isoDoPipedrive(task?.marked_as_done_time) ?? isoDoPipedrive(task?.update_time) ?? quandoDeal;

  // Remarcação: task aberta com outro horário.
  if (task && !task.done) {
    const horario = horarioDaTask(task, at.agendada_atual);
    if (horario && !mesmoInstante(horario, at.agendada_atual)) {
      out.push({
        ...base,
        evento: "remarcada",
        ocorrido_em: isoDoPipedrive(task.update_time) ?? quandoDeal,
        horario_anterior: at.agendada_atual,
        horario_novo: horario,
        motivo: "Remarcada no Pipedrive",
        pipedrive_ref: `act:${task.id}:horario:${horario}`,
      });
      return out; // AT reaberta: o desfecho antigo do card não vale para a nova data.
    }
  }

  let desfecho: {
    evento: EventoPipedrive["evento"];
    ref: string;
    quando: string;
    motivo: string | null;
  } | null = null;
  const resultado = task ? resultadoId(task.outcome) : null;
  if (task && resultado === RESULTADO.concluido)
    desfecho = {
      evento: "realizada",
      ref: `act:${task.id}:resultado:${resultado}:${quandoTask}`,
      quando: quandoTask,
      motivo: null,
    };
  else if (task && resultado === RESULTADO.naoCompareceu)
    desfecho = {
      evento: "no_show",
      ref: `act:${task.id}:resultado:${resultado}:${quandoTask}`,
      quando: quandoTask,
      motivo: null,
    };
  else if (task && resultado === RESULTADO.cancelado)
    desfecho = {
      evento: "cancelada",
      ref: `act:${task.id}:resultado:${resultado}:${quandoTask}`,
      quando: quandoTask,
      motivo: "Cancelada no Pipedrive",
    };
  else if (ETAPAS_DEPOIS_DA_AT.has(deal.stage_id)) {
    const quando = isoDoPipedrive(deal.stage_change_time) ?? quandoDeal;
    desfecho = {
      evento: "realizada",
      ref: `deal:${deal.id}:realizada:${deal.stage_id}:${quando}`,
      quando,
      motivo: null,
    };
  } else if (deal.status === "lost" && deal.stage_id === ETAPA_AT_AGENDADA) {
    const quando = isoDoPipedrive(deal.lost_time) ?? quandoDeal;
    desfecho = {
      evento: "cancelada",
      ref: `deal:${deal.id}:perdido:${quando}`,
      quando,
      motivo: deal.lost_reason ? `Card perdido: ${deal.lost_reason}` : "Card perdido no Pipedrive",
    };
  }

  // Card aberto que voltou para antes da AT (ex.: de "AT Diag. Realizada" para "AT Diag.
  // Agendada"), sem Resultado na task: a AT volta a ser agendada, na mesma data.
  if (
    !desfecho &&
    at.status !== "agendada" &&
    deal.status === "open" &&
    !ETAPAS_DEPOIS_DA_AT.has(deal.stage_id)
  ) {
    const quando = isoDoPipedrive(deal.stage_change_time) ?? quandoDeal;
    const etapa = NOME_ETAPA[deal.stage_id] ?? `etapa ${deal.stage_id}`;
    desfecho = {
      evento: "reaberta",
      ref: `deal:${deal.id}:reaberta:${deal.stage_id}:${quando}`,
      quando,
      motivo: `Card voltou para ${etapa} no Pipedrive`,
    };
  }

  const statusDoEvento = desfecho?.evento === "reaberta" ? "agendada" : desfecho?.evento;
  if (desfecho && statusDoEvento !== at.status) {
    out.push({
      ...base,
      evento: desfecho.evento,
      ocorrido_em: desfecho.quando,
      motivo: desfecho.motivo,
      pipedrive_ref: desfecho.ref,
    });
  }
  return out;
}

/** Id do card citado num webhook do Pipedrive (formatos v1 e v2) ou null. */
export function dealDoWebhook(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const meta = (b["meta"] ?? {}) as Record<string, unknown>;
  const entidade = String(meta["entity"] ?? meta["object"] ?? "");
  const dados = (b["data"] ?? b["current"] ?? {}) as Record<string, unknown>;
  const anterior = (b["previous"] ?? {}) as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && v > 0 ? v : Number(v) > 0 ? Number(v) : null;
  if (entidade === "deal") return num(meta["entity_id"] ?? meta["id"] ?? dados["id"]);
  return num(dados["deal_id"]) ?? num(anterior["deal_id"]);
}
