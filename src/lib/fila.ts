// Filas de envio do dia: quem recebe cada etapa da cadência numa data de referência.
import {
  STEPS,
  computedStatus,
  isActive,
  plannedDates,
  type Contact,
  type Holidays,
  type Offsets,
  type StepDef,
} from "./cadencia";
import type { SectorTemplates, TemplateText } from "./empresas";

export type QueueItem = { contact: Contact; planned: string | null; late: boolean };
export type Queues = Record<StepDef["n"], QueueItem[]>;

/**
 * Para cada etapa, os contatos ativos com a etapa pendente e prevista até `ref`.
 * LinkedIn 1 sem data definida entra na fila sem previsão. Atrasados primeiro,
 * depois pela data prevista.
 */
export function buildQueues(
  contacts: Contact[],
  offsets: Offsets,
  holidays: Holidays,
  ref: string,
): Queues {
  const result: Queues = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const c of contacts) {
    if (!isActive(c)) continue;
    const planned = plannedDates(c, offsets, holidays);
    for (const step of STEPS) {
      if (c[step.sentField]) continue;
      if (step.n === 1 && !c.step1_date) {
        result[1].push({ contact: c, planned: null, late: false });
        continue;
      }
      const p = planned[step.n];
      if (!p || p > ref) continue;
      result[step.n].push({ contact: c, planned: p, late: p < ref });
    }
  }
  for (const list of Object.values(result)) {
    list.sort((a, b) => {
      if (a.late !== b.late) return a.late ? -1 : 1;
      return (a.planned ?? "") < (b.planned ?? "") ? -1 : 1;
    });
  }
  return result;
}

/**
 * O que falta no lead para gerar a mensagem da etapa (null = pode gerar).
 * No LinkedIn 1 a área e o cargo são exigidos; com o texto do modelo (`body`),
 * só quando ele usa [DOR_DO_SETOR] ou [CARGO] (cadências de setor podem não usar).
 */
export function missingForMessage(
  contact: Contact,
  step: StepDef,
  body?: string,
): "empresa" | "setor_cargo" | null {
  if (!contact.company.trim()) return "empresa";
  if (step.n !== 1) return null;
  const needsArea = body === undefined || body.includes("[DOR_DO_SETOR]");
  const needsCargo = body === undefined || body.includes("[CARGO]");
  if ((needsArea && !contact.sector) || (needsCargo && !contact.job_title.trim()))
    return "setor_cargo";
  return null;
}

/** Alterações para registrar o envio da etapa na data `ref` (com a situação recalculada). */
export function markSentPatch(contact: Contact, step: StepDef, ref: string): Partial<Contact> {
  const patch: Partial<Contact> = { [step.sentField]: ref };
  if (step.n === 1 && !contact.step1_date) patch.step1_date = ref;
  patch.status = computedStatus({ ...contact, ...patch } as Contact);
  return patch;
}

/**
 * Modelo da etapa para o lead: a mensagem da cadência do setor da empresa, se existir;
 * senão o modelo padrão da equipe. `fromSector` diz qual dos dois foi usado.
 */
export function pickTemplate(
  step: StepDef,
  sectorId: string | null | undefined,
  sectorTemplates: SectorTemplates | undefined,
  defaults: Partial<Record<number, TemplateText>> | undefined,
): (TemplateText & { fromSector: boolean }) | null {
  const own = sectorId ? sectorTemplates?.[sectorId]?.[step.n] : undefined;
  if (own?.body.trim()) return { ...own, fromSector: true };
  const def = defaults?.[step.n];
  return def?.body.trim() ? { ...def, fromSector: false } : null;
}
