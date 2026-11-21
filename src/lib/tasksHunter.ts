// Acompanhamento das tasks do Pipedrive por hunter (tela Tasks). Tudo puro: o servidor
// (`tasksHunter.functions.ts`) busca no Pipedrive os cards do NTec nas etapas acompanhadas e as
// tasks deles, e estas funções classificam e somam.
//
// O hunter de cada card é o campo "Hunter" do card (as tasks têm o CN como dono, porque a skill
// criar-card cria assim). A opção "Nenhum" e card sem o campo viram "Sem hunter".

import { NOME_ETAPA } from "./pipedrive";

/** Etapas acompanhadas (funil 6): AT Diag. Agendada e AT Diag. Realizada. */
export const ETAPAS_TASKS = [108, 31] as const;
export type EtapaTasks = (typeof ETAPAS_TASKS)[number];
export const NOME_ETAPA_TASKS: Record<EtapaTasks, string> = {
  108: NOME_ETAPA[108]!,
  31: NOME_ETAPA[31]!,
};

/** Campo "Hunter" do card no Pipedrive (opção única). */
export const CAMPO_HUNTER = "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4";
/** Etiqueta NTec. */
export const ETIQUETA_NTEC = 34;
export const SEM_HUNTER = "Sem hunter";

export type CardTasks = {
  id: number;
  title: string;
  stage_id: number;
  /** Login do hunter (rótulo da opção) ou SEM_HUNTER. */
  hunter: string;
};

export type TaskPd = {
  id: number;
  deal_id: number | null;
  subject: string | null;
  type: string | null;
  due_date: string | null;
  done: boolean;
  marked_as_done_time: string | null;
  is_deleted?: boolean | null;
};

export type Situacao =
  "atrasada" | "hoje" | "proxima" | "sem_data" | "concluida_no_prazo" | "concluida_com_atraso";

export const SITUACAO_LABEL: Record<Situacao, string> = {
  atrasada: "Atrasada",
  hoje: "Vence hoje",
  proxima: "Próxima",
  sem_data: "Sem data",
  concluida_no_prazo: "Concluída no prazo",
  concluida_com_atraso: "Concluída com atraso",
};

/** Dia (AAAA-MM-DD) de um timestamp do Pipedrive no fuso de São Paulo. */
function diaSP(t: string): string {
  const iso = t.includes("T") ? t : `${t.replace(" ", "T")}Z`;
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/**
 * Situação de uma task em relação a `hoje` (AAAA-MM-DD, São Paulo). Aberta: atrasada se venceu
 * antes de hoje. Concluída: no prazo se foi marcada até o dia do vencimento (sem data, no prazo).
 */
export function situacaoTask(t: TaskPd, hoje: string): Situacao {
  if (t.done) {
    if (!t.due_date || !t.marked_as_done_time) return "concluida_no_prazo";
    return diaSP(t.marked_as_done_time) <= t.due_date
      ? "concluida_no_prazo"
      : "concluida_com_atraso";
  }
  if (!t.due_date) return "sem_data";
  if (t.due_date < hoje) return "atrasada";
  return t.due_date === hoje ? "hoje" : "proxima";
}

/** Dias corridos de atraso de uma task aberta (0 se não está atrasada). */
export function diasDeAtraso(t: TaskPd, hoje: string): number {
  if (t.done || !t.due_date || t.due_date >= hoje) return 0;
  return Math.round((Date.parse(hoje) - Date.parse(t.due_date)) / 86_400_000);
}

/** Hunter do card a partir das opções do campo (id → login). */
export function hunterDoCard(valor: unknown, opcoes: ReadonlyMap<number, string>): string {
  const id = typeof valor === "object" && valor ? (valor as { id?: unknown }).id : valor;
  const rotulo = typeof id === "number" ? opcoes.get(id) : undefined;
  if (!rotulo || rotulo.trim().toLowerCase() === "nenhum") return SEM_HUNTER;
  return rotulo.trim().toLowerCase();
}

export type Contagem = {
  cards: Record<EtapaTasks, number>;
  abertas: number;
  atrasadas: number;
  hoje: number;
  proximas: number;
  semData: number;
  concluidas: number;
  noPrazo: number;
  comAtraso: number;
  /** noPrazo ÷ concluidas; null sem concluída. */
  taxaNoPrazo: number | null;
};

const zerada = (): Contagem => ({
  cards: { 108: 0, 31: 0 },
  abertas: 0,
  atrasadas: 0,
  hoje: 0,
  proximas: 0,
  semData: 0,
  concluidas: 0,
  noPrazo: 0,
  comAtraso: 0,
  taxaNoPrazo: null,
});

function somar(c: Contagem, s: Situacao) {
  if (s === "concluida_no_prazo" || s === "concluida_com_atraso") {
    c.concluidas++;
    if (s === "concluida_no_prazo") c.noPrazo++;
    else c.comAtraso++;
    return;
  }
  c.abertas++;
  if (s === "atrasada") c.atrasadas++;
  else if (s === "hoje") c.hoje++;
  else if (s === "proxima") c.proximas++;
  else c.semData++;
}

export type LinhaHunter = { hunter: string; contagem: Contagem };

export type TaskDaLista = {
  id: number;
  assunto: string;
  vence: string | null;
  situacao: Situacao;
  diasAtraso: number;
  card: number;
  cardTitulo: string;
  etapa: EtapaTasks;
  hunter: string;
};

export type ResumoTasks = {
  total: Contagem;
  hunters: LinhaHunter[];
  /** Tasks abertas, atrasadas primeiro (mais atrasada no topo), depois por vencimento. */
  abertas: TaskDaLista[];
};

const ehEtapa = (n: number): n is EtapaTasks => (ETAPAS_TASKS as readonly number[]).includes(n);

/**
 * Soma as tasks dos cards por hunter. `etapa` restringe a uma etapa; sem ela, as duas. Tasks
 * apagadas e de card fora da lista ficam de fora.
 */
export function resumoTasks(
  cards: readonly CardTasks[],
  tasks: readonly TaskPd[],
  hoje: string,
  etapa?: EtapaTasks,
): ResumoTasks {
  const doFiltro = cards.filter((c) => ehEtapa(c.stage_id) && (!etapa || c.stage_id === etapa));
  const porId = new Map(doFiltro.map((c) => [c.id, c]));
  const total = zerada();
  const porHunter = new Map<string, Contagem>();
  const contagemDe = (h: string) => {
    let c = porHunter.get(h);
    if (!c) porHunter.set(h, (c = zerada()));
    return c;
  };
  for (const c of doFiltro) {
    const e = c.stage_id as EtapaTasks;
    total.cards[e]++;
    contagemDe(c.hunter).cards[e]++;
  }
  const abertas: TaskDaLista[] = [];
  for (const t of tasks) {
    if (t.is_deleted || t.deal_id == null) continue;
    const card = porId.get(t.deal_id);
    if (!card) continue;
    const s = situacaoTask(t, hoje);
    somar(total, s);
    somar(contagemDe(card.hunter), s);
    if (!t.done) {
      abertas.push({
        id: t.id,
        assunto: t.subject?.trim() || "(sem assunto)",
        vence: t.due_date,
        situacao: s,
        diasAtraso: diasDeAtraso(t, hoje),
        card: card.id,
        cardTitulo: card.title,
        etapa: card.stage_id as EtapaTasks,
        hunter: card.hunter,
      });
    }
  }
  for (const c of [total, ...porHunter.values()]) {
    c.taxaNoPrazo = c.concluidas ? c.noPrazo / c.concluidas : null;
  }
  const hunters = [...porHunter]
    .map(([hunter, contagem]) => ({ hunter, contagem }))
    .sort(
      (a, b) =>
        Number(a.hunter === SEM_HUNTER) - Number(b.hunter === SEM_HUNTER) ||
        b.contagem.atrasadas - a.contagem.atrasadas ||
        b.contagem.abertas - a.contagem.abertas ||
        a.hunter.localeCompare(b.hunter),
    );
  abertas.sort(
    (a, b) =>
      b.diasAtraso - a.diasAtraso ||
      (a.vence ?? "9999").localeCompare(b.vence ?? "9999") ||
      a.cardTitulo.localeCompare(b.cardTitulo),
  );
  return { total, hunters, abertas };
}
