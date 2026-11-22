// Filas de envio do dia: quem recebe cada etapa da cadência numa data de referência.
import {
  STEPS,
  computedStatus,
  isActive,
  plannedDates,
  stepApplies,
  type Contact,
  type Holidays,
  type Offsets,
  type StepDef,
} from "./cadencia";
import {
  sectorPath,
  type SectorCadences,
  type SectorNode,
  type SectorTemplates,
  type TemplateText,
} from "./empresas";
import { PERSONA_LABEL, type Persona } from "./personas";

/** Período como a regra do Hackathon precisa enxergar (subconjunto de `periods`). */
export type PeriodInfo = { id: string; status: string; kind: string; closed_at?: string | null };

/** Período do Hackathon encerrado → quando encerrou. */
export type HackathonPeriods = Map<string, string>;

/**
 * Períodos do Hackathon já encerrados (`kind = 'competicao'` e `status = 'closed'`), com a data de
 * encerramento. Um Hackathon ainda ativo não entra, para não esconder o trabalho em andamento.
 */
export function hackathonPeriods(periods: readonly PeriodInfo[] | undefined): HackathonPeriods {
  const out: HackathonPeriods = new Map();
  for (const p of periods ?? [])
    if (p.kind === "competicao" && p.status === "closed" && p.closed_at) out.set(p.id, p.closed_at);
  return out;
}

/**
 * O contato é do Hackathon: carimbado num período de competição encerrado **e** criado até o
 * encerramento. Quem foi importado depois (sem período ativo, o carimbo cai no último período)
 * é contato novo e segue contando.
 */
export function isHackathonContact(
  c: { period_id: string | null; created_at: string },
  hackathon: HackathonPeriods,
): boolean {
  const closed = c.period_id ? hackathon.get(c.period_id) : undefined;
  return !!closed && Date.parse(c.created_at) <= Date.parse(closed);
}

/** Separa os contatos do Hackathon (arquivados) dos demais. */
export function splitHackathon<T extends { period_id: string | null; created_at: string }>(
  contacts: readonly T[],
  hackathon: HackathonPeriods,
): { current: T[]; hackathon: T[] } {
  const current: T[] = [];
  const archived: T[] = [];
  for (const c of contacts) (isHackathonContact(c, hackathon) ? archived : current).push(c);
  return { current, hackathon: archived };
}

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
      if (c[step.sentField] || !stepApplies(c, step)) continue;
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

export type DayProgress = {
  /** Etapas enviadas no dia `ref` (um contato pode contar mais de uma vez). */
  done: number;
  /** Leads com envio pendente nas filas do dia (cada lead conta uma vez). */
  pending: number;
  /** Dos leads pendentes, os que têm algum envio atrasado. */
  late: number;
  total: number;
};

/**
 * Progresso do dia `ref`: o que já foi enviado nesse dia e quantos leads ainda esperam envio.
 * Um lead atrasado pode estar em mais de uma fila (as etapas seguintes vencem em cadeia), mas
 * conta uma vez: ao enviar a etapa mais cedo, as outras saem da fila e o total não encolhe.
 */
export function dayProgress(contacts: Contact[], queues: Queues, ref: string): DayProgress {
  let done = 0;
  for (const c of contacts)
    for (const s of STEPS) if ((c[s.sentField] as string | null)?.slice(0, 10) === ref) done++;
  const pending = new Set<string>();
  const late = new Set<string>();
  for (const item of Object.values(queues).flat()) {
    pending.add(item.contact.id);
    if (item.late) late.add(item.contact.id);
  }
  return { done, pending: pending.size, late: late.size, total: done + pending.size };
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

/** De onde veio a mensagem, da mais específica para a mais geral. */
export type TemplateLevel = "subsetor_persona" | "subsetor" | "setor_persona" | "setor" | "padrao";

export type ResolvedTemplate = TemplateText & {
  level: TemplateLevel;
  /** Setor ou subsetor dono da mensagem (`null` no modelo padrão). */
  sourceSectorId: string | null;
  /** Persona da mensagem escolhida (`null` quando vale para qualquer persona). */
  persona: Persona | null;
};

/**
 * Mensagem da etapa para o lead: a primeira não vazia na ordem subsetor+persona, subsetor,
 * setor+persona, setor, modelo padrão da equipe. Sem subsetor começa no setor+persona; sem setor
 * vai direto ao padrão. Par SQL: `stamp_resposta_origem` (mesma ordem; ao mudar uma, revise a outra).
 *
 * Para um contato, passe `contactPersona(c).persona` (a persona efetiva): o trigger SQL sempre usa
 * `COALESCE(persona, suggest_persona(cargo, headline))`, então a fila e o `resposta_modelo`
 * carimbado só concordam se o chamador também usar a efetiva.
 */
export function resolveTemplate(args: {
  step: StepDef;
  sectorId: string | null | undefined;
  subsectorId?: string | null;
  persona?: Persona | null;
  cadences: SectorCadences | undefined;
  defaults: Partial<Record<number, TemplateText>> | undefined;
}): ResolvedTemplate | null {
  const { step, sectorId, subsectorId, persona, cadences, defaults } = args;
  const tries: { level: TemplateLevel; id: string | null | undefined; persona: Persona | null }[] =
    [
      { level: "subsetor_persona", id: subsectorId, persona: persona ?? null },
      { level: "subsetor", id: subsectorId, persona: null },
      { level: "setor_persona", id: sectorId, persona: persona ?? null },
      { level: "setor", id: sectorId, persona: null },
    ];
  for (const t of tries) {
    if (!t.id) continue;
    // Os dois níveis de persona só valem com persona informada; o resto é "qualquer persona".
    if (t.level.endsWith("_persona") && !t.persona) continue;
    const own = cadences?.[t.id]?.[t.persona ?? ""]?.[step.n];
    if (own?.body.trim())
      return {
        code: own.code,
        body: own.body,
        level: t.level,
        sourceSectorId: t.id,
        persona: t.persona,
      };
  }
  const def = defaults?.[step.n];
  return def?.body.trim()
    ? { code: def.code, body: def.body, level: "padrao", sourceSectorId: null, persona: null }
    : null;
}

/**
 * Texto de onde veio a mensagem: "Indústria › Metalurgia · Owner da Operação",
 * "Indústria · qualquer persona" ou "Modelo padrão da equipe".
 */
export function templateOriginLabel(
  t: Pick<ResolvedTemplate, "level" | "sourceSectorId" | "persona">,
  sectors: readonly SectorNode[],
): string {
  if (t.level === "padrao" || !t.sourceSectorId) return "Modelo padrão da equipe";
  const node = sectors.find((s) => s.id === t.sourceSectorId);
  const path =
    (node?.parent_id
      ? sectorPath(sectors, node.parent_id, node.id)
      : sectorPath(sectors, t.sourceSectorId)) || "Setor";
  return `${path} · ${t.persona ? PERSONA_LABEL[t.persona] : "qualquer persona"}`;
}

/**
 * Modelo da etapa para o lead: a mensagem da cadência do setor da empresa (qualquer persona), se
 * existir; senão o modelo padrão da equipe. `fromSector` diz qual dos dois foi usado. Forma
 * compatível de `resolveTemplate` para quem ainda não conhece subsetor nem persona.
 */
export function pickTemplate(
  step: StepDef,
  sectorId: string | null | undefined,
  sectorTemplates: SectorTemplates | undefined,
  defaults: Partial<Record<number, TemplateText>> | undefined,
): (TemplateText & { fromSector: boolean }) | null {
  const own = sectorId ? sectorTemplates?.[sectorId] : undefined;
  const found = resolveTemplate({
    step,
    sectorId,
    cadences: sectorId && own ? { [sectorId]: { "": own } } : undefined,
    defaults,
  });
  return found
    ? { code: found.code, body: found.body, fromSector: found.level !== "padrao" }
    : null;
}
