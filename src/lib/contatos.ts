// Regras da tela de contatos: busca, filtro, edição com situação coerente e exportação.
import {
  STATUS_LABEL,
  STEPS,
  computedStatus,
  formatBR,
  plannedDates,
  type Contact,
  type ContactStatus,
  type Holidays,
  type Offsets,
} from "./cadencia";

/** Situações na ordem em que aparecem nos filtros e seletores. */
export const CONTACT_STATUSES = Object.keys(STATUS_LABEL) as ContactStatus[];

export type StatusFilter = "todos" | ContactStatus;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtra por situação e por nome/empresa, sem diferenciar acentos e maiúsculas. */
export function filterContacts(
  contacts: Contact[],
  search: string,
  status: StatusFilter,
): Contact[] {
  const term = fold(search).trim();
  return contacts.filter((c) => {
    if (status !== "todos" && c.status !== status) return false;
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
