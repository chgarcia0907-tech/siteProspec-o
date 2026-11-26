// Indicadores do painel do administrador: cálculo puro sobre contatos, empresas e setores.
// Roda só no servidor (painelDashboard); o cliente recebe os números prontos.
// Reaproveita as regras da cadência (plannedDates, isActive, computedStatus) e do placar
// (atScoreDate, stageScoreDate), então os números batem com Envios de hoje e com o ranking.
import {
  DEFAULT_OFFSETS,
  ENTRY_CHANNEL_LABEL,
  FUNNEL,
  STEPS,
  stepApplies,
  addDaysISO,
  computedStatus,
  entryChannel,
  isActive,
  isBusinessDay,
  onlyDigits,
  originalDates,
  plannedDates,
  type Channel,
  type Contact,
  type EntryChannel,
  type FunnelField,
  type FunnelRegisteredField,
  type Holidays,
  type Offsets,
  type StepDef,
} from "./cadencia";
import { atScoreDate, mondayOf, stageScoreDate } from "./competition";

/* --------------------------------- Entrada -------------------------------- */

export type DashContact = Pick<
  Contact,
  | "id"
  | "user_id"
  | "name"
  | "company"
  | "company_id"
  | "phone"
  | "sector"
  | "status"
  | "created_at"
  | "period_id"
  | "step1_date"
  | "respondeu_em"
  | "resposta_etapa"
  | "resposta_modelo"
  | "sem_whatsapp"
  | StepDef["sentField"]
  | FunnelField
  | FunnelRegisteredField
>;

/** Colunas de `contacts` que o painel lê (envios vêm de STEPS e o funil de FUNNEL). */
export const DASH_CONTACT_COLUMNS = [
  "id",
  "user_id",
  "name",
  "company",
  "company_id",
  "phone",
  "sem_whatsapp",
  "sector",
  "status",
  "created_at",
  "period_id",
  "step1_date",
  "respondeu_em",
  "resposta_etapa",
  "resposta_modelo",
  ...STEPS.map((s) => s.sentField),
  ...FUNNEL.flatMap((f) => [f.field, f.registeredField]),
].join(", ");

export type DashCompany = {
  id: string;
  user_id: string;
  name: string;
  sector_id: string;
  week_start: string;
};
export type DashSector = { id: string; name: string; active: boolean };
export type DashHunter = {
  id: string;
  name: string;
  grupo: string;
  subgrupo: string;
  /** Grupo no período escolhido, para herdar a meta do grupo. */
  groupId?: string | null;
};
/** Linha de `goals`: sem user_id e group_id é o padrão da equipe. */
export type DashGoal = {
  user_id: string | null;
  group_id: string | null;
  envios_dia: number | null;
  l1_semana: number | null;
  ats_semana: number | null;
  no_prazo_pct: number | null;
};
export type ChannelFilter = "todos" | Channel;

/**
 * Códigos dos modelos de mensagem por etapa: o padrão (`message_templates`) e os dos setores
 * que têm mensagem própria naquela etapa (`sector_templates` com texto). Mesma escolha da fila
 * de envios (`pickTemplate`) e do trigger que carimba `contacts.resposta_modelo`.
 *
 * Limite: o código deduzido aqui considera só o setor (qualquer persona); não olha subsetor nem
 * persona. O `resposta_modelo` carimbado pelo trigger é exato (usa subsetor e persona).
 */
export type TemplateCodes = {
  defaults: Partial<Record<number, string>>;
  sectors: Record<string, Partial<Record<number, string>>>;
};

export type DashInput = {
  contacts: readonly DashContact[];
  companies: readonly DashCompany[];
  sectors: readonly DashSector[];
  /** Etapas com mensagem própria em cada setor (sector_templates com texto). */
  sectorSteps: Readonly<Record<string, readonly number[]>>;
  /** Hunters no recorte (já filtrados por grupo/hunter); contatos de outros são ignorados. */
  hunters: readonly DashHunter[];
  offsets: Readonly<Record<string, Offsets>>;
  holidays: Holidays;
  from: string;
  to: string;
  today: string;
  channel?: ChannelFilter;
  /** Só contatos e empresas de empresas deste setor. */
  sectorId?: string | null;
  goals?: readonly DashGoal[];
  templateCodes?: TemplateCodes;
  /**
   * Início do ciclo: etapa pendente prevista antes dele não conta como atrasada (é pendência de
   * antes do ciclo). O contato continua na base e volta a contar se andar na cadência.
   */
  lateSince?: string | null;
};

/* --------------------------------- Saída --------------------------------- */

export type Kpi = { value: number; prev: number | null };
export type LateItem = {
  id: string;
  name: string;
  company: string;
  step: string;
  planned: string;
  /** Dias úteis de atraso. */
  days: number;
};
export type HunterRow = {
  hunter_id: string;
  hunter: string;
  grupo: string;
  subgrupo: string;
  /** Envios no intervalo por etapa, na ordem de STEPS. */
  sent: number[];
  total: number;
  /** Etapas previstas no intervalo (até hoje) e quantas saíram até a data prevista. */
  due: number;
  onTime: number;
  late: number;
  /** Atrasados por faixa de dias úteis: 1–2, 3–5 e mais de 5. */
  lateBands: [number, number, number];
  lateList: LateItem[];
  lastSend: string | null;
  /** Dias úteis desde o último envio (null = nunca enviou). */
  idleDays: number | null;
  /** Conexões do intervalo: contatos importados do hunter (data de criação, fuso de SP). */
  importados: number;
  started: number;
  finished: number;
  inProgress: number;
  waiting: number;
  noPhone: number;
  l1: number;
  ats: number;
  /** Respostas no intervalo (data da resposta; sem ela, o registro da AT). */
  responses: number;
  discarded: number;
  heat: number[];
  goals: GoalSet;
};
export type GoalMetric = "envios" | "l1" | "ats" | "noPrazo";
/** ok = meta batida; atencao = 70% da meta ou mais (no prazo: até 10 pontos abaixo); abaixo = menos. */
export type GoalStatus = "ok" | "atencao" | "abaixo";
export type GoalProgress = { real: number; target: number; pct: number; status: GoalStatus };
export type GoalSet = Record<GoalMetric, GoalProgress | null>;
export type Breakdown = { name: string; l1: number; ats: number };
export type WeekPoint = {
  inicio: string;
  envios: number;
  l1: number;
  ats: number;
  respostas: number;
  importados: number;
};
export type Cohort = {
  inicio: string;
  l1: number;
  at14: number;
  at28: number;
  /** Respostas em até 14 dias do LinkedIn 1. */
  resp14: number;
  /** Já passaram 14/28 dias do fim da semana (taxa definitiva). */
  mature14: boolean;
  mature28: boolean;
};
export type Alert = { level: "alta" | "media"; text: string; hunter?: string | undefined };

export type Dashboard = {
  range: { from: string; to: string; prevFrom: string; prevTo: string };
  kpis: {
    ats: Kpi;
    respostas: Kpi;
    envios: Kpi;
    linkedin: Kpi;
    whatsapp: Kpi;
    l1: Kpi;
    importados: Kpi;
    empresas: Kpi;
    atrasados: number;
    parados: number;
  };
  /** Etapas mostradas (respeita o filtro de canal). */
  steps: { n: number; label: string; channel: Channel }[];
  hunters: HunterRow[];
  heat: { kind: "dia" | "semana"; buckets: string[] };
  pace: { from: string; to: string; real: number | null; planned: number | null; n: number }[];
  supply: {
    waiting: number;
    companies: number;
    companiesWithContacts: number;
    contactsPerCompany: number | null;
    noPhone: number;
    noCompany: number;
    noArea: number;
  };
  funnel: { label: string; count: number }[];
  atOrigin: { label: string; count: number }[];
  respOrigin: { label: string; count: number }[];
  /** Respostas e ATs do intervalo cuja mensagem de origem o hunter informou. */
  declaredOrigin: { responses: number; ats: number };
  /** Canal de entrada das respostas e ATs do intervalo (LinkedIn, WhatsApp, outro canal). */
  entryChannels: { channel: EntryChannel; label: string; responses: number; ats: number }[];
  /** Mensagens enviadas no intervalo e quantas geraram resposta e AT (em qualquer data). */
  messages: MessageRow[];
  /** Dias úteis médios entre o LinkedIn 1 e a resposta, para respostas no intervalo. */
  responseTime: { avg: number | null; n: number };
  /** Contatos marcados como "respondeu" antes de existir a data da resposta. */
  undatedResponses: number;
  goals: {
    team: GoalSet;
    /** Dias úteis do intervalo até hoje: base para converter metas diárias e semanais. */
    elapsedDays: number;
    /** O intervalo ainda não terminou (as metas são proporcionais aos dias já passados). */
    partial: boolean;
    /** Hunters com meta definida e quantos a batem, por indicador. */
    onTarget: Record<GoalMetric, { ok: number; total: number }>;
  };
  bySector: Breakdown[];
  byArea: Breakdown[];
  trend: WeekPoint[];
  cohorts: Cohort[];
  alerts: Alert[];
};

export type MessageRow = {
  step: string;
  /** Código do modelo (ou "Setor <nome>" / "Padrão" quando o modelo não tem código). */
  code: string;
  sent: number;
  responses: number;
  ats: number;
};

/* -------------------------------- Auxiliares ------------------------------ */

/**
 * Código do modelo em uso na etapa para um setor: o do setor, senão o padrão. Ignora subsetor e
 * persona (o `resposta_modelo` carimbado é exato).
 */
export function templateCode(
  codes: TemplateCodes | undefined,
  step: number,
  sector: { id: string; name: string } | null,
): string {
  const own = sector ? codes?.sectors[sector.id]?.[step] : undefined;
  if (own !== undefined) return own.trim() || `Setor ${sector!.name}`;
  return codes?.defaults[step]?.trim() || "Padrão";
}

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);
const spDay = (ts: string) =>
  new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const inR = (d: string | null | undefined, from: string, to: string) => !!d && d >= from && d <= to;

/** Dias úteis em (a, b]: 0 quando b não passa de a. */
export function businessDaysBetween(a: string, b: string, holidays: Holidays): number {
  let n = 0;
  for (let d = addDaysISO(a, 1); d <= b; d = addDaysISO(d, 1)) if (isBusinessDay(d, holidays)) n++;
  return n;
}

/** Dias úteis de `from` a `to`, inclusive. */
export function businessDaysIn(from: string, to: string, holidays: Holidays): number {
  let n = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) if (isBusinessDay(d, holidays)) n++;
  return n;
}

/** Dia (SP) da resposta: data marcada em "respondeu"; sem ela, o registro da AT. */
export function responseDate(
  c: Pick<DashContact, "respondeu_em" | "at_marcada_em" | "at_registrado_em">,
): string | null {
  return c.respondeu_em ? spDay(c.respondeu_em) : atScoreDate(c);
}

type GoalValues = Omit<DashGoal, "user_id" | "group_id">;
const GOAL_FIELDS = ["envios_dia", "l1_semana", "ats_semana", "no_prazo_pct"] as const;

/** Meta efetiva do hunter, campo a campo: a dele, senão a do grupo, senão o padrão da equipe. */
export function resolveGoal(
  goals: readonly DashGoal[],
  hunterId: string,
  groupId: string | null | undefined,
): GoalValues {
  const own = goals.find((g) => g.user_id === hunterId);
  const group = groupId ? goals.find((g) => !g.user_id && g.group_id === groupId) : undefined;
  const team = goals.find((g) => !g.user_id && !g.group_id);
  const out = {} as GoalValues;
  for (const f of GOAL_FIELDS) out[f] = own?.[f] ?? group?.[f] ?? team?.[f] ?? null;
  return out;
}

/** Progresso de uma meta de volume (real ÷ meta proporcional ao intervalo). */
export function volumeProgress(real: number, target: number): GoalProgress {
  const ratio = target > 0 ? real / target : 1;
  return {
    real,
    target: Math.round(target * 10) / 10,
    pct: Math.round(ratio * 100),
    status: ratio >= 1 ? "ok" : ratio >= 0.7 ? "atencao" : "abaixo",
  };
}

/** Progresso da meta de pontualidade (percentual no prazo contra o mínimo). */
export function onTimeProgress(onTime: number, due: number, targetPct: number): GoalProgress {
  const real = Math.round((onTime / due) * 1000) / 10;
  return {
    real,
    target: targetPct,
    pct: targetPct > 0 ? Math.round((real / targetPct) * 100) : 100,
    status: real >= targetPct ? "ok" : real >= targetPct - 10 ? "atencao" : "abaixo",
  };
}

const NO_GOALS: GoalSet = { envios: null, l1: null, ats: null, noPrazo: null };

/** Última etapa enviada até `date` (0 = nenhuma, ou seja, antes do LinkedIn 1). */
function originOf(sent: readonly (string | null)[], date: string): number {
  let origin = 0;
  sent.forEach((d, i) => {
    if (d && d <= date) origin = i + 1;
  });
  return origin;
}

/** Intervalo anterior com o mesmo número de dias, terminando na véspera de `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  let len = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) len++;
  const prevTo = addDaysISO(from, -1);
  return { from: addDaysISO(prevTo, -(len - 1)), to: prevTo };
}

/**
 * Primeira etapa pendente, se já está na fila de envio (data encadeada até hoje) e atrasada em
 * relação ao cronograma original (`original`), como em Envios de hoje; senão null.
 * Com `since`, a pendência prevista antes dessa data fica de fora (anterior ao ciclo).
 */
function lateStep(
  c: DashContact,
  planned: Record<number, string | null>,
  original: Record<number, string | null>,
  steps: readonly StepDef[],
  today: string,
  since?: string | null,
) {
  if (!isActive(c)) return null;
  for (const s of STEPS) {
    if (c[s.sentField] || !stepApplies(c, s)) continue;
    const p = planned[s.n];
    if (s.n === 1 && !c.step1_date) return null; // aguardando início, não atrasado
    if (!p || p > today) return null;
    const orig = original[s.n];
    const due = orig && orig < p ? orig : p; // mesma regra de `buildQueues`
    if (due >= today) return null;
    if (since && due < since) return null;
    return steps.includes(s) ? { step: s, planned: due } : null;
  }
  return null;
}

/* --------------------------------- Cálculo -------------------------------- */

const HEAT_MAX_DAYS = 31;
const TREND_WEEKS = 12;
const LATE_LIST_MAX = 100;

export function computeDashboard(input: DashInput): Dashboard {
  const { holidays, from, to, today } = input;
  const channel = input.channel ?? "todos";
  const steps = STEPS.filter((s) => channel === "todos" || s.channel === channel);
  const prev = previousRange(from, to);
  const hunterIds = new Set(input.hunters.map((h) => h.id));
  const companies = input.companies.filter(
    (co) => hunterIds.has(co.user_id) && (!input.sectorId || co.sector_id === input.sectorId),
  );
  const companyById = new Map(input.companies.map((co) => [co.id, co]));
  const sectorName = new Map(input.sectors.map((s) => [s.id, s.name]));
  const contacts = input.contacts.filter(
    (c) =>
      hunterIds.has(c.user_id) &&
      (!input.sectorId ||
        (!!c.company_id && companyById.get(c.company_id)?.sector_id === input.sectorId)),
  );
  const offsetsOf = (uid: string) => input.offsets[uid] ?? DEFAULT_OFFSETS;

  // Baldes do mapa de calor: dias (até 31) ou semanas.
  let span = 0;
  for (let d = from; d <= to && span <= HEAT_MAX_DAYS; d = addDaysISO(d, 1)) span++;
  const heatKind = span <= HEAT_MAX_DAYS ? "dia" : "semana";
  const buckets: string[] = [];
  if (heatKind === "dia") for (let d = from; d <= to; d = addDaysISO(d, 1)) buckets.push(d);
  else for (let w = mondayOf(from); w <= to; w = addDaysISO(w, 7)) buckets.push(w);
  const bucketIdx = new Map(buckets.map((b, i) => [b, i]));
  const bucketOf = (d: string) => bucketIdx.get(heatKind === "dia" ? d : mondayOf(d));

  const rows = new Map<string, HunterRow>(
    input.hunters.map((h) => [
      h.id,
      {
        hunter_id: h.id,
        hunter: h.name,
        grupo: h.grupo,
        subgrupo: h.subgrupo,
        sent: STEPS.map(() => 0),
        total: 0,
        due: 0,
        onTime: 0,
        late: 0,
        lateBands: [0, 0, 0],
        lateList: [],
        lastSend: null,
        idleDays: null,
        importados: 0,
        started: 0,
        finished: 0,
        inProgress: 0,
        waiting: 0,
        noPhone: 0,
        l1: 0,
        ats: 0,
        responses: 0,
        discarded: 0,
        heat: buckets.map(() => 0),
        goals: NO_GOALS,
      },
    ]),
  );

  const kp = {
    cur: { ats: 0, respostas: 0, envios: 0, linkedin: 0, whatsapp: 0, l1: 0, importados: 0 },
    prev: { ats: 0, respostas: 0, envios: 0, linkedin: 0, whatsapp: 0, l1: 0, importados: 0 },
  };
  const supply = { waiting: 0, noPhone: 0, noCompany: 0, noArea: 0 };
  const funnel = FUNNEL.map(() => 0);
  const atOrigin = [0, ...STEPS.map(() => 0)]; // 0 = antes do LinkedIn 1
  const respOrigin = [0, ...STEPS.map(() => 0)];
  const respTime = { sum: 0, n: 0 };
  const declaredOrigin = { responses: 0, ats: 0 };
  const channelAgg = new Map<EntryChannel, { responses: number; ats: number }>(
    (["linkedin", "whatsapp", "outro"] as const).map((ch) => [ch, { responses: 0, ats: 0 }]),
  );
  const messageAgg = new Map<string, MessageRow>();
  let undatedResponses = 0;
  const pace = STEPS.slice(1).map(() => ({ real: 0, planned: 0, n: 0 }));
  const sectorAgg = new Map<string, Breakdown>();
  const areaAgg = new Map<string, Breakdown>();
  const trendStart = addDaysISO(mondayOf(to), -7 * (TREND_WEEKS - 1));
  const weeks: string[] = Array.from({ length: TREND_WEEKS }, (_, i) =>
    addDaysISO(trendStart, 7 * i),
  );
  const trend = new Map<string, WeekPoint>(
    weeks.map((w) => [w, { inicio: w, envios: 0, l1: 0, ats: 0, respostas: 0, importados: 0 }]),
  );
  const cohorts = new Map<string, Cohort>(
    weeks.map((w) => [
      w,
      {
        inicio: w,
        l1: 0,
        at14: 0,
        at28: 0,
        resp14: 0,
        mature14: addDaysISO(w, 6 + 14) <= today,
        mature28: addDaysISO(w, 6 + 28) <= today,
      },
    ]),
  );
  const contactsPerCompany = new Map<string, number>();
  const breakdown = (map: Map<string, Breakdown>, name: string) => {
    const b = map.get(name) ?? { name, l1: 0, ats: 0 };
    map.set(name, b);
    return b;
  };

  for (const c of contacts) {
    const r = rows.get(c.user_id)!;
    const off = offsetsOf(c.user_id);
    const planned = plannedDates(c, off, holidays);
    const active = isActive(c);
    const status = computedStatus(c);
    const sent = STEPS.map((s) => day(c[s.sentField]));
    const at = atScoreDate(c);
    const l1 = sent[0]!;
    const imported = spDay(c.created_at);

    if (c.company_id)
      contactsPerCompany.set(c.company_id, (contactsPerCompany.get(c.company_id) ?? 0) + 1);

    // Envios: intervalo atual e anterior, mapa de calor, tendência e último envio.
    STEPS.forEach((s, i) => {
      const d = sent[i];
      if (!d) return;
      if (!r.lastSend || d > r.lastSend) r.lastSend = d;
      const counted = steps.includes(s);
      if (inR(d, from, to)) {
        r.sent[i]!++;
        if (counted) {
          r.total++;
          kp.cur.envios++;
          kp.cur[s.channel]++;
          const b = bucketOf(d);
          if (b !== undefined) r.heat[b]!++;
        }
      }
      if (counted && inR(d, prev.from, prev.to)) {
        kp.prev.envios++;
        kp.prev[s.channel]++;
      }
      if (counted) {
        const t = trend.get(mondayOf(d));
        if (t) t.envios++;
      }
    });

    // Cumprimento: etapas previstas no intervalo (até hoje) e se saíram até a data prevista.
    const dueEnd = to < today ? to : addDaysISO(today, -1);
    for (const s of steps) {
      const p = planned[s.n];
      if (!inR(p, from, dueEnd)) continue;
      // Etapa só é devida depois que a anterior saiu: um atraso não conta de novo nas seguintes.
      if (!stepApplies(c, s)) continue;
      // (a etapa dispensada não segura as seguintes: vale a anterior que faz parte da cadência)
      const before = STEPS.slice(0, s.n - 1).filter((x) => stepApplies(c, x));
      if (before.length && !c[before[before.length - 1]!.sentField]) continue;
      const d = day(c[s.sentField]);
      if (!d && !active) continue; // contato saiu da cadência: a etapa não era mais devida
      r.due++;
      if (d && d <= p!) r.onTime++;
    }

    // Atrasados agora.
    const late = lateStep(
      c,
      planned,
      originalDates(c, off, holidays),
      steps,
      today,
      input.lateSince,
    );
    if (late) {
      const days = Math.max(1, businessDaysBetween(late.planned, today, holidays));
      r.late++;
      r.lateBands[days <= 2 ? 0 : days <= 5 ? 1 : 2]++;
      r.lateList.push({
        id: c.id,
        name: c.name,
        company: c.company,
        step: late.step.label,
        planned: late.planned,
        days,
      });
    }

    // Situação atual e qualidade dos dados (só contatos ativos).
    if (active) {
      if (status === "em_cadencia") r.inProgress++;
      if (status === "aguardando") {
        r.waiting++;
        supply.waiting++;
      }
      const whatsappPending = STEPS.some(
        (s) =>
          s.channel === "whatsapp" &&
          stepApplies(c, s) &&
          !c[s.sentField] &&
          !!planned[s.n] &&
          planned[s.n]! <= today,
      );
      if (status === "em_cadencia" && whatsappPending && onlyDigits(c.phone).length < 10) {
        r.noPhone++;
        supply.noPhone++;
      }
      if (!c.company_id && !c.company.trim()) supply.noCompany++;
      if (!c.sector.trim()) supply.noArea++;
    }

    // Início e fim de cadência, conversão e descarte.
    if (inR(l1, from, to)) {
      r.started++;
      r.l1++;
      kp.cur.l1++;
      if (c.status === "descartado") r.discarded++;
    }
    if (inR(l1, prev.from, prev.to)) kp.prev.l1++;
    if (inR(sent[STEPS.length - 1]!, from, to)) r.finished++;
    // Mensagem que gerou a resposta/AT: a informada pelo hunter; sem ela, a última mensagem
    // enviada até a data (0 = nenhuma mensagem da cadência: outro canal).
    const resp = responseDate(c);
    const declared = c.resposta_etapa;
    const atFrom = at ? (declared ?? originOf(sent, at)) : null;
    const respFrom = resp ? (declared ?? originOf(sent, resp)) : null;
    if (inR(at, from, to)) {
      r.ats++;
      kp.cur.ats++;
      atOrigin[atFrom!]!++;
      channelAgg.get(entryChannel(atFrom!))!.ats++;
      if (declared != null) declaredOrigin.ats++;
    }
    if (inR(at, prev.from, prev.to)) kp.prev.ats++;

    // Respostas: quando, depois de qual mensagem e quanto tempo depois do LinkedIn 1.
    if (inR(resp, from, to)) {
      r.responses++;
      kp.cur.respostas++;
      respOrigin[respFrom!]!++;
      channelAgg.get(entryChannel(respFrom!))!.responses++;
      if (declared != null) declaredOrigin.responses++;
      if (l1 && resp! >= l1) {
        respTime.sum += businessDaysBetween(l1, resp!, holidays);
        respTime.n++;
      }
    }
    if (inR(resp, prev.from, prev.to)) kp.prev.respostas++;
    if (c.status === "respondeu" && !c.respondeu_em && !at) undatedResponses++;
    if (inR(imported, from, to)) {
      kp.cur.importados++;
      r.importados++;
    }
    if (inR(imported, prev.from, prev.to)) kp.prev.importados++;

    // Funil do intervalo, pela data de registro de cada etapa (mesmo critério do placar).
    FUNNEL.forEach((f, i) => {
      const d = f.field === "at_marcada_em" ? at : stageScoreDate(c, f.field);
      if (inR(d, from, to)) funnel[i]!++;
    });

    // Conversão por setor da empresa e por área do contato.
    const co = c.company_id ? companyById.get(c.company_id) : undefined;

    // Mensagens enviadas no intervalo e quantas geraram resposta/AT (em qualquer data).
    for (const s of steps) {
      if (!inR(sent[s.n - 1], from, to)) continue;
      const code =
        declared === s.n && c.resposta_modelo
          ? c.resposta_modelo
          : templateCode(
              input.templateCodes,
              s.n,
              co ? { id: co.sector_id, name: sectorName.get(co.sector_id) ?? "" } : null,
            );
      const key = `${s.n}|${code}`;
      const m = messageAgg.get(key) ?? { step: s.label, code, sent: 0, responses: 0, ats: 0 };
      messageAgg.set(key, m);
      m.sent++;
      if (respFrom === s.n) m.responses++;
      if (atFrom === s.n) m.ats++;
    }
    const sectorKey = co
      ? (sectorName.get(co.sector_id) ?? "Setor removido")
      : "Sem empresa cadastrada";
    const areaKey = c.sector.trim() || "Sem área";
    for (const b of [breakdown(sectorAgg, sectorKey), breakdown(areaAgg, areaKey)]) {
      if (inR(l1, from, to)) b.l1++;
      if (inR(at, from, to)) b.ats++;
    }

    // Ritmo real entre etapas (envios no intervalo) comparado ao configurado.
    for (let i = 1; i < STEPS.length; i++) {
      const a = sent[i - 1];
      const b = sent[i];
      if (!a || !b || !inR(b, from, to)) continue;
      const offs = [off.offset1, off.offset2, off.offset3, off.offset4, off.offset5];
      pace[i - 1]!.real += businessDaysBetween(a, b, holidays);
      pace[i - 1]!.planned += Math.max(0, offs[i]! - offs[i - 1]!);
      pace[i - 1]!.n++;
    }

    // Tendência semanal e coortes (LinkedIn 1 da semana → AT em até 14/28 dias).
    const tw = (d: string | null) => (d ? trend.get(mondayOf(d)) : undefined);
    if (l1) {
      const t = tw(l1);
      if (t) t.l1++;
      const ch = cohorts.get(mondayOf(l1));
      if (ch) {
        ch.l1++;
        if (at && at >= l1 && at <= addDaysISO(l1, 14)) ch.at14++;
        if (at && at >= l1 && at <= addDaysISO(l1, 28)) ch.at28++;
        if (resp && resp >= l1 && resp <= addDaysISO(l1, 14)) ch.resp14++;
      }
    }
    if (tw(at)) tw(at)!.ats++;
    if (tw(resp)) tw(resp)!.respostas++;
    if (tw(imported)) tw(imported)!.importados++;
  }

  // Fechamento por hunter: dias parado e lista de atrasados (os mais antigos primeiro).
  for (const r of rows.values()) {
    r.idleDays = r.lastSend ? businessDaysBetween(r.lastSend, today, holidays) : null;
    r.lateList.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "pt-BR"));
    r.lateList = r.lateList.slice(0, LATE_LIST_MAX);
  }
  const hunters = [...rows.values()].sort(
    (a, b) => b.total - a.total || a.hunter.localeCompare(b.hunter, "pt-BR"),
  );
  // Metas: diárias e semanais viram metas do intervalo pelos dias úteis já passados.
  const elapsedDays = businessDaysIn(from, to < today ? to : today, holidays);
  const goals = input.goals ?? [];
  const groupOf = new Map(input.hunters.map((h) => [h.id, h.groupId ?? null]));
  const teamAcc = {
    envios: { real: 0, target: 0, n: 0 },
    l1: { real: 0, target: 0, n: 0 },
    ats: { real: 0, target: 0, n: 0 },
    noPrazo: { onTime: 0, due: 0, weighted: 0 },
  };
  const onTarget = {
    envios: { ok: 0, total: 0 },
    l1: { ok: 0, total: 0 },
    ats: { ok: 0, total: 0 },
    noPrazo: { ok: 0, total: 0 },
  };
  if (goals.length && elapsedDays > 0) {
    for (const r of hunters) {
      const g = resolveGoal(goals, r.hunter_id, groupOf.get(r.hunter_id));
      const vol = (
        key: "envios" | "l1" | "ats",
        real: number,
        perDay: number | null,
      ): GoalProgress | null => {
        if (perDay === null) return null;
        const p = volumeProgress(real, perDay * elapsedDays);
        teamAcc[key].real += real;
        teamAcc[key].target += perDay * elapsedDays;
        teamAcc[key].n++;
        onTarget[key].total++;
        if (p.status === "ok") onTarget[key].ok++;
        return p;
      };
      let noPrazo: GoalProgress | null = null;
      if (g.no_prazo_pct !== null && r.due > 0) {
        noPrazo = onTimeProgress(r.onTime, r.due, g.no_prazo_pct);
        teamAcc.noPrazo.onTime += r.onTime;
        teamAcc.noPrazo.due += r.due;
        teamAcc.noPrazo.weighted += g.no_prazo_pct * r.due;
        onTarget.noPrazo.total++;
        if (noPrazo.status === "ok") onTarget.noPrazo.ok++;
      }
      r.goals = {
        // Meta de envios vale para todas as etapas: com filtro de canal não se aplica.
        envios: channel === "todos" ? vol("envios", r.total, g.envios_dia) : null,
        l1: vol("l1", r.l1, g.l1_semana === null ? null : g.l1_semana / 5),
        ats: vol("ats", r.ats, g.ats_semana === null ? null : g.ats_semana / 5),
        noPrazo,
      };
    }
  }
  const teamVol = (key: "envios" | "l1" | "ats") =>
    teamAcc[key].n ? volumeProgress(teamAcc[key].real, teamAcc[key].target) : null;
  const teamGoals: GoalSet = {
    envios: teamVol("envios"),
    l1: teamVol("l1"),
    ats: teamVol("ats"),
    noPrazo: teamAcc.noPrazo.due
      ? onTimeProgress(
          teamAcc.noPrazo.onTime,
          teamAcc.noPrazo.due,
          Math.round(teamAcc.noPrazo.weighted / teamAcc.noPrazo.due),
        )
      : null,
  };

  const isIdle = (r: HunterRow) =>
    r.inProgress + r.waiting > 0 && (r.idleDays === null || r.idleDays >= 2);

  // Empresas da semana: cadastradas no intervalo (semanas que tocam o intervalo).
  const inWeeks = (co: DashCompany, a: string, b: string) =>
    co.week_start >= mondayOf(a) && co.week_start <= b;
  const curCompanies = companies.filter((co) => inWeeks(co, from, to));
  const withContacts = curCompanies.filter((co) => contactsPerCompany.has(co.id));

  // Alertas: o que precisa de ação hoje.
  const alerts: Alert[] = [];
  for (const r of hunters) {
    if (isIdle(r))
      alerts.push({
        level: r.idleDays === null || r.idleDays >= 5 ? "alta" : "media",
        hunter: r.hunter,
        text:
          r.idleDays === null
            ? "nunca registrou um envio"
            : `sem envio há ${r.idleDays} dias úteis`,
      });
    if (r.lateBands[2])
      alerts.push({
        level: "alta",
        hunter: r.hunter,
        text: `${r.lateBands[2]} contatos atrasados há mais de 5 dias úteis`,
      });
    if (r.noPhone)
      alerts.push({
        level: "media",
        hunter: r.hunter,
        text: `${r.noPhone} WhatsApps previstos sem telefone cadastrado`,
      });
    // Meta abaixo só vira alerta com pelo menos 3 dias úteis de intervalo (evita ruído na segunda).
    if (elapsedDays >= 3)
      for (const [key, label] of [
        ["envios", "mensagens"],
        ["ats", "ATs"],
      ] as const) {
        const p = r.goals[key];
        if (p?.status === "abaixo")
          alerts.push({
            level: "media",
            hunter: r.hunter,
            text: `abaixo da meta de ${label}: ${p.real} de ${p.target} (${p.pct}%)`,
          });
      }
  }
  const hunterName = new Map(input.hunters.map((h) => [h.id, h.name]));
  for (const co of curCompanies.filter((x) => !contactsPerCompany.has(x.id)))
    alerts.push({
      level: "media",
      hunter: hunterName.get(co.user_id),
      text: `empresa ${co.name} (semana de ${co.week_start.split("-").reverse().join("/")}) sem nenhum contato`,
    });
  const usedSectors = new Set(companies.map((co) => co.sector_id));
  for (const s of input.sectors) {
    if (!s.active || !usedSectors.has(s.id)) continue;
    const has = new Set(input.sectorSteps[s.id] ?? []);
    const missing = STEPS.filter((st) => !has.has(st.n));
    if (missing.length)
      alerts.push({
        level: "media",
        text: `setor ${s.name}: cadência sem mensagem própria para ${missing.map((m) => m.label).join(", ")} (usa o modelo padrão)`,
      });
  }
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "alta" ? -1 : 1));

  const prevCompanies = companies.filter((co) => inWeeks(co, prev.from, prev.to)).length;
  const sortBreakdown = (m: Map<string, Breakdown>) =>
    [...m.values()]
      .filter((b) => b.l1 || b.ats)
      .sort((a, b) => b.ats - a.ats || b.l1 - a.l1 || a.name.localeCompare(b.name, "pt-BR"));
  const k = (key: keyof typeof kp.cur): Kpi => ({ value: kp.cur[key], prev: kp.prev[key] });

  return {
    range: { from, to, prevFrom: prev.from, prevTo: prev.to },
    kpis: {
      ats: k("ats"),
      respostas: k("respostas"),
      envios: k("envios"),
      linkedin: k("linkedin"),
      whatsapp: k("whatsapp"),
      l1: k("l1"),
      importados: k("importados"),
      empresas: { value: curCompanies.length, prev: prevCompanies },
      atrasados: hunters.reduce((n, r) => n + r.late, 0),
      parados: hunters.filter(isIdle).length,
    },
    steps: steps.map((s) => ({ n: s.n, label: s.label, channel: s.channel })),
    hunters,
    heat: { kind: heatKind, buckets },
    pace: pace.map((p, i) => ({
      from: STEPS[i]!.label,
      to: STEPS[i + 1]!.label,
      real: p.n ? Math.round((p.real / p.n) * 10) / 10 : null,
      planned: p.n ? Math.round((p.planned / p.n) * 10) / 10 : null,
      n: p.n,
    })),
    supply: {
      ...supply,
      companies: curCompanies.length,
      companiesWithContacts: withContacts.length,
      contactsPerCompany: withContacts.length
        ? Math.round(
            (withContacts.reduce((n, co) => n + contactsPerCompany.get(co.id)!, 0) /
              withContacts.length) *
              10,
          ) / 10
        : null,
    },
    funnel: FUNNEL.map((f, i) => ({ label: f.label, count: funnel[i]! })),
    atOrigin: [
      { label: ENTRY_CHANNEL_LABEL.outro, count: atOrigin[0]! },
      ...STEPS.map((s, i) => ({ label: s.label, count: atOrigin[i + 1]! })),
    ],
    respOrigin: [
      { label: ENTRY_CHANNEL_LABEL.outro, count: respOrigin[0]! },
      ...STEPS.map((s, i) => ({ label: s.label, count: respOrigin[i + 1]! })),
    ],
    declaredOrigin,
    entryChannels: [...channelAgg].map(([channel, v]) => ({
      channel,
      label: ENTRY_CHANNEL_LABEL[channel],
      ...v,
    })),
    messages: [...messageAgg.values()].sort(
      (a, b) =>
        b.ats / b.sent - a.ats / a.sent ||
        b.responses / b.sent - a.responses / a.sent ||
        b.sent - a.sent,
    ),
    responseTime: {
      avg: respTime.n ? Math.round((respTime.sum / respTime.n) * 10) / 10 : null,
      n: respTime.n,
    },
    undatedResponses,
    goals: { team: teamGoals, elapsedDays, partial: to >= today, onTarget },
    bySector: sortBreakdown(sectorAgg),
    byArea: sortBreakdown(areaAgg),
    trend: [...trend.values()],
    cohorts: [...cohorts.values()],
    alerts,
  };
}

/** Variação percentual (null quando não há base de comparação). */
export function deltaPct(k: Kpi): number | null {
  if (k.prev === null || k.prev === 0) return null;
  return Math.round(((k.value - k.prev) / k.prev) * 100);
}

/** Percentual arredondado (null quando a base é zero). */
export function pct(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 1000) / 10 : null;
}

/* ------------------------------ Intervalos (tela) ------------------------------ */

export type RangePreset = "hoje" | "ontem" | "semana" | "semana_passada" | "30dias" | "mes";

export const RANGE_LABEL: Record<RangePreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  semana_passada: "Semana passada",
  "30dias": "Últimos 30 dias",
  mes: "Este mês",
};

/** Datas de um atalho de intervalo; semanas vão de segunda a domingo. */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const mon = mondayOf(today);
  switch (preset) {
    case "hoje":
      return { from: today, to: today };
    case "ontem": {
      const d = addDaysISO(today, -1);
      return { from: d, to: d };
    }
    case "semana":
      return { from: mon, to: addDaysISO(mon, 6) };
    case "semana_passada":
      return { from: addDaysISO(mon, -7), to: addDaysISO(mon, -1) };
    case "30dias":
      return { from: addDaysISO(today, -29), to: today };
    case "mes": {
      const first = `${today.slice(0, 8)}01`;
      const next = addDaysISO(`${today.slice(0, 8)}28`, 4);
      return { from: first, to: addDaysISO(`${next.slice(0, 8)}01`, -1) };
    }
  }
}

/** Campo de meta digitado: vazio = herdar (null); aceita vírgula decimal; inválido = undefined. */
export function parseGoalNumber(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

/**
 * Intervalo dos indicadores dentro de um ciclo: não começa antes do início nem passa do fim.
 * Devolve null quando o intervalo escolhido fica todo fora do ciclo (nada a mostrar).
 */
export function clampToCycle(
  range: { from: string; to: string },
  cycle: { start: string; end: string | null },
): { from: string; to: string } | null {
  const from = range.from < cycle.start ? cycle.start : range.from;
  const to = cycle.end && range.to > cycle.end ? cycle.end : range.to;
  return from <= to ? { from, to } : null;
}
