// Alocação da semana (Dashboard de Outbound, fase 2): qual hunter prospecta qual setor numa safra,
// com metas de empresas e contatos. Regras puras; gravação em `dashboard.functions.ts`.
//
// - Uma linha por safra × hunter × vigência. Troca de setor no meio da semana cria nova linha com
//   `vigente_desde`; o contato fica no setor da linha vigente no dia em que foi criado.
// - As metas da safra do hunter são as da linha vigente mais recente.
// - Metas zeradas = semana sem prospecção (exige motivo) e não disparam alertas de esforço.
// - Edição livre até o início da safra; durante a semana, só troca de setor ou alocação de quem
//   ainda não tem setor na safra (nova vigência a partir de hoje); depois da semana, nada.
// - Dupla: dois hunters com o mesmo rótulo na safra. As métricas continuam individuais.
import type { Tables } from "@/integrations/supabase/types";
import { addDaysISO, formatBR } from "./cadencia";
import { diaSP, fimDaSemana, type Safra } from "./safras";

export type Alocacao = Pick<
  Tables<"alocacoes">,
  | "id"
  | "safra_id"
  | "user_id"
  | "sector_id"
  | "subsector_id"
  | "dupla"
  | "meta_empresas"
  | "meta_contatos"
  | "motivo_meta_zero"
  | "vigente_desde"
>;

export type AlocacaoForm = Omit<Alocacao, "id" | "safra_id">;

/* ------------------------------- Consulta ------------------------------- */

const porVigencia = (a: Pick<Alocacao, "vigente_desde">, b: Pick<Alocacao, "vigente_desde">) =>
  a.vigente_desde.localeCompare(b.vigente_desde);

/** Linhas de um hunter numa safra, da vigência mais antiga para a mais recente. */
export function linhasDoHunter<T extends Pick<Alocacao, "safra_id" | "user_id" | "vigente_desde">>(
  alocacoes: readonly T[],
  safraId: string,
  userId: string,
): T[] {
  return alocacoes.filter((a) => a.safra_id === safraId && a.user_id === userId).sort(porVigencia);
}

/**
 * Linha vigente no dia: a de maior `vigente_desde` até o dia. Dia antes da primeira vigência (ex.:
 * contato criado na segunda e alocação a partir da terça) fica com a primeira linha.
 */
export function alocacaoVigente<T extends Pick<Alocacao, "safra_id" | "user_id" | "vigente_desde">>(
  alocacoes: readonly T[],
  safraId: string,
  userId: string,
  dia: string,
): T | null {
  const linhas = linhasDoHunter(alocacoes, safraId, userId);
  return linhas.filter((a) => a.vigente_desde <= dia).at(-1) ?? linhas.at(0) ?? null;
}

/** Alocação de um contato: a do dono dele, vigente no dia em que foi criado (fuso SP). */
export function alocacaoDoContato<
  T extends Pick<Alocacao, "safra_id" | "user_id" | "vigente_desde">,
>(c: { user_id: string; created_at: string }, safraId: string, alocacoes: readonly T[]): T | null {
  return alocacaoVigente(alocacoes, safraId, c.user_id, diaSP(c.created_at));
}

/** Linha atual (vigência mais recente) de cada hunter alocado na safra. */
export function alocacoesAtuais<T extends Pick<Alocacao, "safra_id" | "user_id" | "vigente_desde">>(
  alocacoes: readonly T[],
  safraId: string,
): T[] {
  const ultima = new Map<string, T>();
  for (const a of alocacoes.filter((x) => x.safra_id === safraId).sort(porVigencia))
    ultima.set(a.user_id, a);
  return [...ultima.values()];
}

/** Metas da safra do hunter (linha mais recente), ou null sem alocação. */
export function metasDaSafra(
  alocacoes: readonly Alocacao[],
  safraId: string,
  userId: string,
): Pick<Alocacao, "meta_empresas" | "meta_contatos"> | null {
  const a = linhasDoHunter(alocacoes, safraId, userId).at(-1);
  return a ? { meta_empresas: a.meta_empresas, meta_contatos: a.meta_contatos } : null;
}

/** Semana sem prospecção: as duas metas zeradas. */
export const semMeta = (a: Pick<Alocacao, "meta_empresas" | "meta_contatos">) =>
  a.meta_empresas === 0 && a.meta_contatos === 0;

/** Duplas da safra: rótulo → hunters (pela linha atual de cada um). */
export function duplasDaSafra(
  alocacoes: readonly Alocacao[],
  safraId: string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const a of alocacoesAtuais(alocacoes, safraId)) {
    if (!a.dupla) continue;
    out.set(a.dupla, [...(out.get(a.dupla) ?? []), a.user_id]);
  }
  return out;
}

/** O outro hunter da dupla, ou null. */
export function parceiroDaDupla(
  alocacoes: readonly Alocacao[],
  safraId: string,
  userId: string,
): string | null {
  const minha = alocacoesAtuais(alocacoes, safraId).find((a) => a.user_id === userId);
  if (!minha?.dupla) return null;
  return (
    duplasDaSafra(alocacoes, safraId)
      .get(minha.dupla)
      ?.find((u) => u !== userId) ?? null
  );
}

/* -------------------------------- Edição -------------------------------- */

/** O que pode ser feito na alocação de uma safra no dia `hoje`. */
export type ModoEdicao = "livre" | "troca_setor" | "encerrada";

export function modoEdicao(safra: Pick<Safra, "inicio">, hoje: string): ModoEdicao {
  if (hoje < safra.inicio) return "livre";
  if (hoje <= fimDaSemana(safra)) return "troca_setor";
  return "encerrada";
}

export const MODO_EDICAO_TEXTO: Record<ModoEdicao, string> = {
  livre: "Editável até o início da safra.",
  troca_setor:
    "Safra em andamento: só a troca de setor e a alocação de quem está sem setor, valendo a partir de hoje.",
  encerrada: "Safra encerrada: a alocação não muda mais.",
};

const normDupla = (d: string | null) => (d ?? "").trim() || null;

/**
 * Erro de uma alocação nova ou editada, ou null. `outras` são as linhas da mesma safra, sem a
 * própria. `subsetores` diz o setor pai de cada subsetor.
 */
export function erroAlocacao(
  f: AlocacaoForm,
  safra: Pick<Safra, "id" | "inicio" | "usa_alocacao">,
  outras: readonly Alocacao[],
  paiDoSubsetor: ReadonlyMap<string, string>,
): string | null {
  if (!safra.usa_alocacao) return "Esta safra não usa alocação.";
  if (!f.user_id) return "Escolha o hunter.";
  if (!f.sector_id) return "Escolha o setor.";
  if (f.subsector_id && paiDoSubsetor.get(f.subsector_id) !== f.sector_id)
    return "O subsetor não pertence ao setor escolhido.";
  for (const [v, nome] of [
    [f.meta_empresas, "empresas"],
    [f.meta_contatos, "contatos"],
  ] as const)
    if (!Number.isInteger(v) || v < 0) return `Meta de ${nome}: use um número inteiro, 0 ou mais.`;
  if (semMeta(f) && !(f.motivo_meta_zero ?? "").trim())
    return "Sem meta na semana: informe o motivo (ex.: semana de provas).";
  if (f.vigente_desde < safra.inicio || f.vigente_desde > fimDaSemana(safra))
    return "A vigência fica dentro da semana da safra.";
  if (
    outras.some(
      (a) =>
        a.safra_id === safra.id && a.user_id === f.user_id && a.vigente_desde === f.vigente_desde,
    )
  )
    return `Este hunter já tem alocação a partir de ${formatBR(f.vigente_desde)} nesta safra.`;
  const dupla = normDupla(f.dupla);
  if (dupla && dupla.length > 20) return "O nome da dupla tem no máximo 20 caracteres.";
  if (dupla) {
    const outrosNaDupla = new Set(
      alocacoesAtuais(outras, safra.id)
        .filter((a) => a.dupla === dupla && a.user_id !== f.user_id)
        .map((a) => a.user_id),
    );
    if (outrosNaDupla.size >= 2) return `A dupla ${dupla} já tem dois hunters nesta safra.`;
  }
  return null;
}

/** Alocação pronta para gravar (dupla e motivo limpos; motivo só com metas zeradas). */
export function alocacaoLimpa(f: AlocacaoForm): AlocacaoForm {
  return {
    ...f,
    subsector_id: f.subsector_id || null,
    dupla: normDupla(f.dupla),
    motivo_meta_zero: semMeta(f) ? (f.motivo_meta_zero ?? "").trim() || null : null,
  };
}

/**
 * Troca de setor durante a safra: nova linha a partir de `hoje`, com as metas e a dupla da linha
 * atual. Null quando o setor não muda.
 */
export function trocaDeSetor(
  atual: Alocacao,
  setor: { sector_id: string; subsector_id: string | null },
  hoje: string,
): AlocacaoForm | null {
  if (atual.sector_id === setor.sector_id && atual.subsector_id === setor.subsector_id) return null;
  return {
    user_id: atual.user_id,
    sector_id: setor.sector_id,
    subsector_id: setor.subsector_id,
    dupla: atual.dupla,
    meta_empresas: atual.meta_empresas,
    meta_contatos: atual.meta_contatos,
    motivo_meta_zero: atual.motivo_meta_zero,
    vigente_desde: hoje,
  };
}

/**
 * Copia a alocação atual de cada hunter da safra anterior para a nova, a partir da segunda-feira
 * dela. Hunters que já têm alocação na nova ficam de fora.
 */
export function copiarAlocacoes(
  alocacoes: readonly Alocacao[],
  anterior: Pick<Safra, "id">,
  nova: Pick<Safra, "id" | "inicio">,
): AlocacaoForm[] {
  const jaAlocados = new Set(alocacoes.filter((a) => a.safra_id === nova.id).map((a) => a.user_id));
  return alocacoesAtuais(alocacoes, anterior.id)
    .filter((a) => !jaAlocados.has(a.user_id))
    .map((a) => ({
      user_id: a.user_id,
      sector_id: a.sector_id,
      subsector_id: a.subsector_id,
      dupla: a.dupla,
      meta_empresas: a.meta_empresas,
      meta_contatos: a.meta_contatos,
      motivo_meta_zero: a.motivo_meta_zero,
      vigente_desde: nova.inicio,
    }));
}

/**
 * Nova alocação vazia para um hunter, valendo desde a segunda-feira da safra ou, com a safra em
 * andamento, desde `hoje`.
 */
export const alocacaoVazia = (
  userId: string,
  safra: Pick<Safra, "inicio">,
  hoje?: string,
): AlocacaoForm => ({
  user_id: userId,
  sector_id: "",
  subsector_id: null,
  dupla: null,
  meta_empresas: 0,
  meta_contatos: 0,
  motivo_meta_zero: null,
  vigente_desde: hoje && hoje > safra.inicio ? hoje : safra.inicio,
});

/**
 * Erro de uma alocação gravada com a safra em andamento, ou null. Vale a partir de hoje; quem já
 * tem alocação na safra só troca de setor (metas e dupla ficam), e quem não tem é alocado por
 * inteiro. `alocacoes` pode trazer outras safras: só as da `safraId` contam.
 */
export function erroDuranteSafra(
  f: AlocacaoForm,
  safraId: string,
  alocacoes: readonly Alocacao[],
  hoje: string,
): string | null {
  if (f.vigente_desde < hoje) return "Com a safra em andamento, a alocação vale a partir de hoje.";
  const atual = alocacoes
    .filter((a) => a.safra_id === safraId && a.user_id === f.user_id)
    .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
    .at(-1);
  if (!atual) return null;
  const esperado = trocaDeSetor(atual, f, f.vigente_desde);
  if (!esperado) return "O setor é o mesmo da alocação atual.";
  if (!mesmaAlocacao(esperado, f))
    return "Safra em andamento: só o setor muda; metas e dupla ficam como estão.";
  return null;
}

/** Dias da semana da safra em que uma troca de setor pode começar (de hoje ao fim da semana). */
export function diasParaTroca(safra: Pick<Safra, "inicio">, hoje: string): string[] {
  const out: string[] = [];
  for (
    let d = hoje < safra.inicio ? safra.inicio : hoje;
    d <= fimDaSemana(safra);
    d = addDaysISO(d, 1)
  )
    out.push(d);
  return out;
}

const CAMPOS_FORM: readonly (keyof AlocacaoForm)[] = [
  "user_id",
  "sector_id",
  "subsector_id",
  "dupla",
  "meta_empresas",
  "meta_contatos",
  "motivo_meta_zero",
  "vigente_desde",
];

/** Duas alocações iguais campo a campo (depois de `alocacaoLimpa`). */
export function mesmaAlocacao(a: AlocacaoForm, b: AlocacaoForm): boolean {
  const x = alocacaoLimpa(a);
  const y = alocacaoLimpa(b);
  return CAMPOS_FORM.every((k) => x[k] === y[k]);
}

/* ------------------------------- Tabela ------------------------------- */

export type LinhaAlocacao = {
  userId: string;
  /** Vigência mais recente (null = hunter não alocado). */
  atual: Alocacao | null;
  /** Vigências anteriores da semana, da mais antiga para a mais recente. */
  anteriores: Alocacao[];
};

/**
 * Linhas da tabela de alocação: uma por membro do ciclo (na ordem recebida) e, no fim, quem tem
 * alocação na safra sem ser membro.
 */
export function linhasDaAlocacao(
  alocacoes: readonly Alocacao[],
  safraId: string,
  membros: readonly string[],
): LinhaAlocacao[] {
  const alocados = [
    ...new Set(alocacoes.filter((a) => a.safra_id === safraId).map((a) => a.user_id)),
  ];
  const ordem = [...membros, ...alocados.filter((u) => !membros.includes(u))];
  return ordem.map((userId) => {
    const linhas = linhasDoHunter(alocacoes, safraId, userId);
    return { userId, atual: linhas.at(-1) ?? null, anteriores: linhas.slice(0, -1) };
  });
}

/**
 * Safra aberta por padrão na alocação: a da semana de hoje se usar alocação; senão a próxima que
 * usa e ainda não começou; senão a última que usa; senão a primeira do ciclo.
 */
export function safraPadraoDaAlocacao<T extends Pick<Safra, "inicio" | "numero" | "usa_alocacao">>(
  safras: readonly T[],
  hoje: string,
): T | null {
  const ordem = [...safras].sort((a, b) => a.numero - b.numero);
  const usam = ordem.filter((s) => s.usa_alocacao);
  return (
    usam.find((s) => s.inicio <= hoje && hoje <= fimDaSemana(s)) ??
    usam.find((s) => s.inicio > hoje) ??
    usam.at(-1) ??
    ordem.at(0) ??
    null
  );
}

/** Rótulos de dupla já usados na safra, para sugerir no formulário. */
export function duplasSugeridas(alocacoes: readonly Alocacao[], safraId: string): string[] {
  return [...duplasDaSafra(alocacoes, safraId).keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
