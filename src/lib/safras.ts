// Safras (semanas de prospecção) de um ciclo da Dashboard de Outbound. Regras puras: a safra de
// um contato não é gravada, sai da data de criação dele (fuso de São Paulo) e das datas das
// safras. O status sai do dia de hoje e da janela de maturação (`dashboard_parametros`).
// Plano: .claude/plans/dashboard-outbound.md (fase 1).
import type { Tables } from "@/integrations/supabase/types";
import { addDaysISO, formatBR, weekdayISO } from "./cadencia";
import { weekStartISO } from "./empresas";

export type Safra = Pick<
  Tables<"safras">,
  "id" | "period_id" | "numero" | "inicio" | "fim" | "usa_alocacao"
>;

export type StatusSafra = "planejada" | "em_prospeccao" | "em_cadencia" | "em_maturacao" | "madura";

export const STATUS_SAFRA_LABEL: Record<StatusSafra, string> = {
  planejada: "Planejada",
  em_prospeccao: "Em prospecção",
  em_cadencia: "Em cadência",
  em_maturacao: "Em maturação",
  madura: "Madura",
};

/** Código da safra: `26.2-S03`. */
export function codigoSafra(nomeCiclo: string, numero: number): string {
  return `${nomeCiclo.trim()}-S${String(numero).padStart(2, "0")}`;
}

/** Rótulo curto: `S03`. */
export function rotuloSafra(numero: number): string {
  return `S${String(numero).padStart(2, "0")}`;
}

/** Dia (yyyy-mm-dd) de um instante no fuso de São Paulo. */
export function diaSP(ts: string): string {
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/**
 * Último dia da semana da safra para atribuição: o domingo. A safra é exibida de segunda a sexta,
 * mas o contato criado no sábado ou no domingo fica na semana que começou na segunda anterior.
 */
export const fimDaSemana = (s: Pick<Safra, "inicio">): string => addDaysISO(s.inicio, 6);

/** Safra que contém o dia (yyyy-mm-dd), ou null. */
export function safraDaData<T extends Pick<Safra, "inicio">>(
  dia: string,
  safras: readonly T[],
): T | null {
  const semana = weekStartISO(dia);
  return safras.find((s) => s.inicio === semana) ?? null;
}

/** Safra de um contato: a semana em que ele foi criado na plataforma (fuso de São Paulo). */
export function safraDoContato<T extends Pick<Safra, "inicio">>(
  createdAt: string,
  safras: readonly T[],
): T | null {
  return safraDaData(diaSP(createdAt), safras);
}

/**
 * Status da safra no dia `hoje`, com a janela de maturação em semanas depois do fim da safra
 * (padrão 3: madura a partir de N+4).
 *   planejada     antes da semana da safra
 *   em_prospeccao semana N
 *   em_cadencia   semana N+1
 *   em_maturacao  de N+2 até o fim da janela
 *   madura        depois da janela
 */
export function statusSafra(
  s: Pick<Safra, "inicio">,
  hoje: string,
  maturacaoSemanas: number,
): StatusSafra {
  if (hoje < s.inicio) return "planejada";
  if (hoje <= fimDaSemana(s)) return "em_prospeccao";
  if (hoje >= inicioDaMaturidade(s, maturacaoSemanas)) return "madura";
  if (hoje <= addDaysISO(s.inicio, 13)) return "em_cadencia";
  return "em_maturacao";
}

/** Primeiro dia em que a safra está madura. */
export function inicioDaMaturidade(s: Pick<Safra, "inicio">, maturacaoSemanas: number): string {
  return addDaysISO(s.inicio, 7 * (1 + Math.max(0, maturacaoSemanas)));
}

export const safraMadura = (s: Pick<Safra, "inicio">, hoje: string, maturacaoSemanas: number) =>
  statusSafra(s, hoje, maturacaoSemanas) === "madura";

/** Safra anterior (N−1) na ordem do ciclo, ou null. */
export function safraAnterior<T extends Pick<Safra, "numero">>(
  s: T,
  safras: readonly T[],
): T | null {
  return (
    safras
      .filter((x) => x.numero < s.numero)
      .sort((a, b) => b.numero - a.numero)
      .at(0) ?? null
  );
}

/* ------------------------------- Edição -------------------------------- */

export type SafraForm = { numero: number; inicio: string; fim: string; usa_alocacao: boolean };

/**
 * Erro de uma safra nova ou editada, ou null. `outras` são as safras de todos os ciclos, sem a
 * própria (o banco também confere: uma safra por semana e só em ciclo).
 */
export function erroSafra(
  f: SafraForm,
  periodId: string,
  outras: readonly Pick<Safra, "period_id" | "numero" | "inicio">[],
): string | null {
  if (!Number.isInteger(f.numero) || f.numero < 1) return "O número da safra deve ser 1 ou mais.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(f.fim))
    return "Informe o início e o fim.";
  if (weekdayISO(f.inicio) !== 1) return "A safra começa numa segunda-feira.";
  if (f.fim < f.inicio || f.fim > fimDaSemana(f))
    return "O fim fica na mesma semana do início (até o domingo).";
  if (outras.some((s) => s.period_id === periodId && s.numero === f.numero))
    return `Já existe a ${rotuloSafra(f.numero)} neste ciclo.`;
  const mesmaSemana = outras.find((s) => s.inicio === f.inicio);
  if (mesmaSemana) return `Já existe uma safra na semana de ${formatBR(f.inicio)}.`;
  return null;
}

/**
 * Semanas sugeridas para um ciclo: de `inicioCiclo` (a segunda dessa semana) até `ate`, de segunda
 * a sexta, continuando a numeração e pulando as semanas que já têm safra (deste ou de outro ciclo).
 */
export function semanasSugeridas(
  inicioCiclo: string,
  ate: string,
  existentes: readonly Pick<Safra, "period_id" | "numero" | "inicio">[],
  periodId: string,
): SafraForm[] {
  const ocupadas = new Set(existentes.map((s) => s.inicio));
  const doCiclo = existentes.filter((s) => s.period_id === periodId);
  let numero = doCiclo.reduce((m, s) => Math.max(m, s.numero), 0);
  const out: SafraForm[] = [];
  const primeira = weekStartISO(inicioCiclo);
  // Continua depois da última safra do ciclo, para não intercalar números.
  const ultima = doCiclo.reduce<string | null>((m, s) => (!m || s.inicio > m ? s.inicio : m), null);
  for (let seg = primeira; seg <= ate; seg = addDaysISO(seg, 7)) {
    if (ocupadas.has(seg) || (ultima && seg < ultima)) continue;
    numero += 1;
    out.push({ numero, inicio: seg, fim: addDaysISO(seg, 4), usa_alocacao: true });
  }
  return out;
}

/* ------------------------------ Parâmetros ------------------------------ */

export type Parametros = Omit<Tables<"dashboard_parametros">, "id" | "updated_at">;

/** Valores iniciais da spec (os mesmos padrões da migração). */
export const PARAMETROS_PADRAO: Parametros = {
  maturacao_semanas: 3,
  amostra_minima_ab: 500,
  min_ats_segmento: 10,
  avanco_fica_pct: 50,
  avanco_troca_pct: 35,
  esforco_alerta_pct: 70,
  dias_contato_parado: 3,
  concentracao_ats_pct: 30,
  nao_realizadas_pct: 15,
  semanas_seguidas: 2,
};

/** Rótulo e faixa de cada parâmetro, na ordem da tela. */
export const PARAMETROS_INFO: readonly {
  key: keyof Parametros;
  label: string;
  unidade: string;
  min: number;
  max: number;
}[] = [
  {
    key: "maturacao_semanas",
    label: "Janela de maturação",
    unidade: "semanas após a safra",
    min: 0,
    max: 12,
  },
  {
    key: "dias_contato_parado",
    label: "Contato parado",
    unidade: "dias úteis sem envio",
    min: 1,
    max: 30,
  },
  {
    key: "esforco_alerta_pct",
    label: "Alerta de esforço",
    unidade: "% da meta",
    min: 0,
    max: 100,
  },
  {
    key: "concentracao_ats_pct",
    label: "Concentração de ATs",
    unidade: "% das ATs da equipe",
    min: 0,
    max: 100,
  },
  {
    key: "nao_realizadas_pct",
    label: "ATs não realizadas",
    unidade: "% das marcadas",
    min: 0,
    max: 100,
  },
  {
    key: "semanas_seguidas",
    label: "Semanas seguidas para alertar",
    unidade: "semanas",
    min: 1,
    max: 12,
  },
  {
    key: "min_ats_segmento",
    label: "Amostra mínima por segmento",
    unidade: "ATs realizadas",
    min: 1,
    max: 1000,
  },
  {
    key: "avanco_fica_pct",
    label: "Segmento fica com avanço de",
    unidade: "% ou mais",
    min: 0,
    max: 100,
  },
  {
    key: "avanco_troca_pct",
    label: "Segmento é trocado abaixo de",
    unidade: "% de avanço",
    min: 0,
    max: 100,
  },
  {
    key: "amostra_minima_ab",
    label: "Amostra mínima do teste A/B",
    unidade: "contatos por versão",
    min: 1,
    max: 100000,
  },
];

/** Erro dos parâmetros, ou null. */
export function erroParametros(p: Parametros): string | null {
  for (const info of PARAMETROS_INFO) {
    const v = p[info.key];
    if (!Number.isInteger(v) || v < info.min || v > info.max)
      return `${info.label}: use um número inteiro de ${info.min} a ${info.max}.`;
  }
  if (p.avanco_troca_pct > p.avanco_fica_pct)
    return "O limite para trocar o segmento não pode passar o limite para mantê-lo.";
  return null;
}

/* ----------------------------- Metas do ciclo ----------------------------- */

export type MetasCiclo = Pick<
  Tables<"ciclo_metas">,
  "ats_avancaram" | "ats_marcadas" | "ats_realizadas" | "contatos" | "vendas"
>;

export const METAS_CICLO_INFO: readonly { key: keyof MetasCiclo; label: string }[] = [
  { key: "ats_avancaram", label: "ATs que avançaram" },
  { key: "ats_marcadas", label: "ATs marcadas" },
  { key: "ats_realizadas", label: "ATs realizadas" },
  { key: "contatos", label: "Contatos prospectados" },
  { key: "vendas", label: "Vendas" },
];

export const METAS_CICLO_VAZIAS: MetasCiclo = {
  ats_avancaram: null,
  ats_marcadas: null,
  ats_realizadas: null,
  contatos: null,
  vendas: null,
};

/** Erro das metas do ciclo (nula = sem meta), ou null. */
export function erroMetasCiclo(m: MetasCiclo): string | null {
  for (const info of METAS_CICLO_INFO) {
    const v = m[info.key];
    if (v !== null && (!Number.isInteger(v) || v < 0))
      return `${info.label}: use um número inteiro, 0 ou mais.`;
  }
  return null;
}

/* ------------------------------ Calendário ------------------------------ */

export type CelulaSafra = {
  /** Segunda-feira da coluna. */
  semana: string;
  /** Fase da safra naquela semana (null antes da semana da safra). */
  fase: Exclude<StatusSafra, "planejada"> | null;
  /** Semana depois da semana de hoje: fase prevista, não vivida. */
  futura: boolean;
};

export type Calendario<T extends Pick<Safra, "inicio">> = {
  /** Segundas-feiras das colunas, em ordem. */
  semanas: string[];
  /** Segunda-feira da semana de hoje (pode estar fora das colunas). */
  semanaAtual: string;
  linhas: { safra: T; status: StatusSafra; celulas: CelulaSafra[] }[];
};

/**
 * Calendário em escada da aba Semanas: safras nas linhas (em ordem de número), semanas nas
 * colunas, da primeira safra até a semana em que a última amadurece (no máximo `maxSemanas`
 * colunas, cortando as mais antigas). Cada célula é a fase da safra naquela semana.
 */
export function calendarioSafras<T extends Pick<Safra, "inicio" | "numero">>(
  safras: readonly T[],
  hoje: string,
  maturacaoSemanas: number,
  maxSemanas = 14,
): Calendario<T> {
  const semanaAtual = weekStartISO(hoje);
  const ordem = [...safras].sort((a, b) => a.numero - b.numero);
  if (ordem.length === 0) return { semanas: [], semanaAtual, linhas: [] };
  const primeira = ordem.reduce((m, s) => (s.inicio < m ? s.inicio : m), ordem[0]!.inicio);
  const ultima = ordem.reduce((m, s) => (s.inicio > m ? s.inicio : m), ordem[0]!.inicio);
  const fimCalendario = inicioDaMaturidade({ inicio: ultima }, maturacaoSemanas);
  let semanas: string[] = [];
  for (let seg = primeira; seg <= fimCalendario; seg = addDaysISO(seg, 7)) semanas.push(seg);
  if (semanas.length > maxSemanas) semanas = semanas.slice(-maxSemanas);
  return {
    semanas,
    semanaAtual,
    linhas: ordem.map((safra) => ({
      safra,
      status: statusSafra(safra, hoje, maturacaoSemanas),
      celulas: semanas.map((semana) => {
        const st = statusSafra(safra, semana, maturacaoSemanas);
        return { semana, fase: st === "planejada" ? null : st, futura: semana > semanaAtual };
      }),
    })),
  };
}

/** Ciclo aberto por padrão: o ativo; sem ativo, o de início mais recente. */
export function cicloPadrao<T extends { id: string; status: string; started_at: string }>(
  ciclos: readonly T[],
): T | null {
  return (
    ciclos.find((c) => c.status === "active") ??
    [...ciclos].sort((a, b) => b.started_at.localeCompare(a.started_at)).at(0) ??
    null
  );
}

/**
 * Semana aberta por padrão nas abas por semana: a de hoje, se houver safra nela; senão a última
 * safra que já começou; senão a primeira do ciclo. Devolve a segunda-feira, ou null sem safras.
 */
export function semanaPadrao(
  safras: readonly Pick<Safra, "inicio">[],
  hoje: string,
): string | null {
  const atual = safraDaData(hoje, safras);
  if (atual) return atual.inicio;
  const ordem = [...safras].sort((a, b) => a.inicio.localeCompare(b.inicio));
  return ordem.filter((s) => s.inicio <= hoje).at(-1)?.inicio ?? ordem.at(0)?.inicio ?? null;
}
