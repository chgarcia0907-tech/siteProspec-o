// Regras da tela de contatos: busca, filtro, edição com situação coerente e exportação.
import {
  STATUS_LABEL,
  STEPS,
  stepApplies,
  computedStatus,
  OUTRO_CANAL,
  formatBR,
  isActive,
  plannedDates,
  RESPOSTA_TIPO_LABEL,
  type Contact,
  type ContactStatus,
  type Holidays,
  type Offsets,
  type RespostaTipo,
  type StepDef,
} from "./cadencia";

/** Situações na ordem em que aparecem nos filtros e seletores. */
export const CONTACT_STATUSES = Object.keys(STATUS_LABEL) as ContactStatus[];

/**
 * Situações que o hunter escolhe na edição do contato. "Descartado" saiu: quem recusou vira
 * "Respondeu" com resposta negativa. Contato que já está descartado continua mostrando a situação.
 */
export function statusOptions(current: ContactStatus): ContactStatus[] {
  return CONTACT_STATUSES.filter((s) => s !== "descartado" || s === current);
}

export type StatusFilter = "todos" | ContactStatus;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Contatos com dado faltando, para completar a empresa ou a área. */
export type MissingFilter = "todos" | "empresa" | "area";

export const MISSING_LABEL: Record<MissingFilter, string> = {
  todos: "Com ou sem pendência",
  empresa: "Sem empresa",
  area: "Sem área",
};

export const hasNoCompany = (c: Pick<Contact, "company_id" | "company">) =>
  !c.company_id && !c.company.trim();

/** Tipo da resposta do lead (`contacts.resposta_tipo`), para ver só as positivas ou as negativas. */
export type RespostaFilter = "todos" | RespostaTipo;

export const RESPOSTA_FILTER_LABEL: Record<RespostaFilter, string> = {
  todos: "Todas as respostas",
  positiva: `${RESPOSTA_TIPO_LABEL.positiva}s`,
  negativa: `${RESPOSTA_TIPO_LABEL.negativa}s`,
};

/**
 * Filtra por situação, pendência, tipo de resposta e por nome/empresa, sem diferenciar acentos e
 * maiúsculas. A situação é a calculada (`computedStatus`), a mesma que o selo da tabela mostra.
 */
export function filterContacts(
  contacts: Contact[],
  search: string,
  status: StatusFilter,
  missing: MissingFilter = "todos",
  resposta: RespostaFilter = "todos",
): Contact[] {
  const term = fold(search).trim();
  return contacts.filter((c) => {
    if (status !== "todos" && computedStatus(c) !== status) return false;
    if (missing === "empresa" && !hasNoCompany(c)) return false;
    if (missing === "area" && c.sector.trim()) return false;
    // O tipo fica gravado se o contato volta à cadência; só vale enquanto ele está "respondeu".
    if (resposta !== "todos" && (c.resposta_tipo !== resposta || computedStatus(c) !== "respondeu"))
      return false;
    return !term || fold(`${c.name} ${c.company}`).includes(term);
  });
}

/** Alterações de um contato acrescidas da nova situação, quando as etapas a mudam. */
export function withSyncedStatus(contact: Contact, changes: Partial<Contact>): Partial<Contact> {
  const next: Partial<Contact> = { ...changes };
  const status = computedStatus({ ...contact, ...changes } as Contact);
  if (status !== contact.status) next.status = status;
  return next;
}

/** Linhas do CSV de contatos (cabeçalho + uma linha por contato). */
export function contactsCsvRows(rows: Contact[], offsets: Offsets, holidays: Holidays): string[][] {
  const header = [
    "Nome",
    "Cargo/Headline",
    "Empresa",
    "Telefone",
    "Data da conexão",
    ...STEPS.flatMap((s) => [`${s.label} prevista`, `${s.label} enviada`]),
    "Situação",
  ];
  const body = rows.map((c) => {
    const planned = plannedDates(c, offsets, holidays);
    return [
      c.name,
      c.headline,
      c.company,
      c.phone,
      formatBR(c.connected_at),
      ...STEPS.flatMap((s) => [formatBR(planned[s.n]), formatBR(c[s.sentField])]),
      STATUS_LABEL[computedStatus(c)],
    ];
  });
  return [header, ...body];
}

/** Próximo envio da cadência: a primeira etapa ainda não enviada e a data prevista dela. */
export type NextSend = { step: StepDef; date: string | null; late: boolean };

/**
 * Próximo envio do contato no dia `today`. `null` quando não há o que enviar: cadência
 * concluída ou contato fora das filas (respondeu, descartado ou com AT marcada).
 * `date` é `null` no LinkedIn 1 sem data definida.
 */
export function nextSend(
  contact: Contact,
  offsets: Offsets,
  holidays: Holidays,
  today: string,
): NextSend | null {
  if (!isActive(contact)) return null;
  const step = STEPS.find((s) => !contact[s.sentField] && stepApplies(contact, s));
  if (!step) return null;
  const date = plannedDates(contact, offsets, holidays)[step.n] ?? null;
  return { step, date, late: !!date && date < today };
}

/** Marcador de cada etapa na coluna Cadência (DESIGN.md, seção 7). */
export type StepMark = "enviada" | "proxima" | "atrasada" | "futura" | "dispensada";

/** Um marcador por etapa de `STEPS`: enviada, a próxima (ou atrasada) e as futuras. */
export function cadenceMarks(contact: Contact, next: NextSend | null): StepMark[] {
  return STEPS.map((s) => {
    if (contact[s.sentField]) return "enviada";
    if (!stepApplies(contact, s)) return "dispensada";
    if (next?.step.n === s.n) return next.late ? "atrasada" : "proxima";
    return "futura";
  });
}

/** Dados do formulário "Adicionar contato" (AT marcada fora da cadência, ex.: por e-mail). */
export type ManualAtInput = {
  name: string;
  job_title: string;
  sector: string;
  phone: string;
  company_id: string | null;
  /** Empresa em texto livre, quando não há empresa cadastrada vinculada. */
  company: string;
  /** Dia da AT (AAAA-MM-DD). */
  atDate: string;
};

/** Erro do formulário (null = pode salvar): nome e data da AT são obrigatórios. A data pode ser futura (reunião agendada). */
export function manualAtError(input: ManualAtInput): string | null {
  if (!input.name.trim()) return "Informe o nome do contato.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.atDate)) return "Informe a data da AT.";
  return null;
}

/** Contatos já cadastrados com o mesmo nome (sem acento nem caixa), para avisar de duplicidade. */
export function sameNameContacts(contacts: readonly Contact[], name: string): Contact[] {
  const term = fold(name).trim();
  return term ? contacts.filter((c) => fold(c.name).trim() === term) : [];
}

/**
 * Linha para inserir um contato cuja AT foi marcada fora da cadência (e-mail): entra como
 * "respondeu", com a AT na data informada, registrada agora (conta no placar no dia do cadastro)
 * e com a origem "outro canal". Não gera envios nem entra nas filas.
 */
export function manualAtRow(input: ManualAtInput, now: string = new Date().toISOString()) {
  return {
    name: input.name.trim(),
    job_title: input.job_title.trim(),
    sector: input.sector,
    phone: input.phone.trim(),
    company_id: input.company_id,
    ...(input.company_id ? {} : { company: input.company.trim() }),
    status: "respondeu" as const,
    at_marcada_em: input.atDate,
    at_registrado_em: now,
    resposta_etapa: OUTRO_CANAL,
  };
}
