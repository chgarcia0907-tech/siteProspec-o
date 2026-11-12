import type { Tables } from "@/integrations/supabase/types";

export type Channel = "linkedin" | "whatsapp";

export type StepDef = {
  n: 1 | 2 | 3 | 4 | 5;
  label: string;
  channel: Channel;
  sentField: "sent1_at" | "sent2_at" | "sent3_at" | "sent4_at" | "sent5_at";
};

export const STEPS: StepDef[] = [
  { n: 1, label: "LinkedIn 1", channel: "linkedin", sentField: "sent1_at" },
  { n: 2, label: "WhatsApp 1", channel: "whatsapp", sentField: "sent2_at" },
  { n: 3, label: "LinkedIn 2", channel: "linkedin", sentField: "sent3_at" },
  { n: 4, label: "WhatsApp 2", channel: "whatsapp", sentField: "sent4_at" },
  { n: 5, label: "LinkedIn 3", channel: "linkedin", sentField: "sent5_at" },
];

/**
 * Linha de `contacts` vinda dos tipos gerados do Supabase (fonte única do esquema).
 * Só `status` e `company_gender` são estreitados para as uniões usadas no app
 * (no banco são texto com CHECK).
 */
export type Contact = Omit<Tables<"contacts">, "status" | "company_gender"> & {
  status: ContactStatus;
  company_gender: CompanyGender;
};

export type ContactStatus =
  | "aguardando"
  | "em_cadencia"
  | "respondeu"
  | "concluido"
  | "descartado";

export const STATUS_LABEL: Record<ContactStatus, string> = {
  aguardando: "Aguardando início",
  em_cadencia: "Em cadência",
  respondeu: "Respondeu",
  concluido: "Concluído",
  descartado: "Descartado",
};

export type Offsets = {
  offset1: number;
  offset2: number;
  offset3: number;
  offset4: number;
  offset5: number;
};

export const DEFAULT_OFFSETS: Offsets = {
  offset1: 0,
  offset2: 1,
  offset3: 2,
  offset4: 3,
  offset5: 4,
};

export const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Hoje em formato ISO (yyyy-mm-dd), no fuso local. */
export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function formatBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Dia da semana (0 = domingo) de uma data ISO, independente de fuso. */
function weekdayISO(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Conjunto de feriados em ISO (yyyy-mm-dd), carregado uma vez e repassado aos cálculos. */
export type Holidays = ReadonlySet<string>;
const NO_HOLIDAYS: Holidays = new Set();

export function isBusinessDay(iso: string, holidays: Holidays = NO_HOLIDAYS): boolean {
  const wd = weekdayISO(iso);
  return wd !== 0 && wd !== 6 && !holidays.has(iso.slice(0, 10));
}

/** Soma N dias úteis (seg–sex, fora feriados). Com N = 0, dia não útil avança para o próximo útil. */
export function addBusinessDaysISO(iso: string, days: number, holidays: Holidays = NO_HOLIDAYS): string {
  let cur = iso.slice(0, 10);
  if (days <= 0) {
    while (!isBusinessDay(cur, holidays)) cur = addDaysISO(cur, 1);
    return cur;
  }
  let left = days;
  while (left > 0) {
    cur = addDaysISO(cur, 1);
    if (isBusinessDay(cur, holidays)) left--;
  }
  return cur;
}

export type PlanInput = Pick<
  Contact,
  "step1_date" | "sent1_at" | "sent2_at" | "sent3_at" | "sent4_at" | "sent5_at"
>;

/**
 * Datas previstas em dias úteis (sem fins de semana e feriados). Cada etapa parte da anterior:
 * data real de envio se já enviada, senão a data prevista dela.
 */
export function plannedDates(
  c: PlanInput,
  offsets: Offsets,
  holidays: Holidays = NO_HOLIDAYS,
): Record<number, string | null> {
  const out: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null, 5: null };
  if (!c.step1_date) return out;
  const offs = [offsets.offset1, offsets.offset2, offsets.offset3, offsets.offset4, offsets.offset5];
  out[1] = addBusinessDaysISO(c.step1_date, 0, holidays);
  for (let i = 1; i < STEPS.length; i++) {
    const prev = STEPS[i - 1]!;
    const base = (c[prev.sentField] as string | null)?.slice(0, 10) || out[prev.n]!;
    out[STEPS[i]!.n] = addBusinessDaysISO(base, Math.max(0, offs[i]! - offs[i - 1]!), holidays);
  }
  return out;
}

export function computedStatus(c: Contact): ContactStatus {
  if (c.status === "respondeu" || c.status === "descartado") return c.status;
  const allSent = STEPS.every((s) => c[s.sentField]);
  if (allSent) return "concluido";
  if (c.step1_date || c.sent1_at) return "em_cadencia";
  return "aguardando";
}

export function isActive(c: Contact): boolean {
  if (c.at_marcada_em) return false; // AT marcada tira o contato das filas
  return c.status !== "respondeu" && c.status !== "descartado";
}

export function firstName(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").trim();
}

export type CompanyGender = "masculino" | "feminino" | "sem_artigo";

/** Empresa com artigo/preposição conforme a concordância escolhida pelo hunter. */
export function empresaCom(
  tipo: "na" | "a" | "da",
  company: string,
  gender: CompanyGender | null | undefined,
): string {
  const c = company.trim();
  const g = gender ?? "feminino";
  const art = {
    na: { masculino: "no", feminino: "na", sem_artigo: "em" },
    a: { masculino: "o", feminino: "a", sem_artigo: "" },
    da: { masculino: "do", feminino: "da", sem_artigo: "de" },
  }[tipo][g];
  return art ? `${art} ${c}` : c;
}

export type HunterCtx = { name: string; gender: "m" | "f" };
export type LeadCtx = {
  name: string;
  company: string;
  company_gender?: CompanyGender | null;
  job_title?: string;
  sector?: string;
};

export function renderTemplate(
  body: string,
  lead: LeadCtx,
  hunter: HunterCtx,
  opts: { now?: Date } = {},
): string {
  // Modelos antigos no banco: converte trechos fixos para as tags com concordância.
  const text = body
    .replace(/\bcom a \[EMPRESA\]/g, "com [A_EMPRESA]")
    .replace(/\bentre a \[EMPRESA\]/g, "entre [A_EMPRESA]")
    .replace(/\bna \[EMPRESA\]/g, "[NA_EMPRESA]")
    .replace(/\bda \[EMPRESA\]/g, "[DA_EMPRESA]")
    .replace(/Entrei em contato/g, "Entramos em contato")
    .replace(/Podemos agendar uma conversa rápida na \[DIA_SUGERIDO\]\?/g, "Podemos agendar uma conversa rápida [JANELA]?")
    .replace(/Que tal marcarmos na \[DIA_SUGERIDO\]\?/g, "Que tal marcarmos uma conversa [JANELA]?")
    .replace(/nesta ou na próxima semana/g, "[JANELA]")
    .replace(/(?:\bna )?\[DIA_SUGERIDO\]/g, "[JANELA]");
  const fem = hunter.gender === "f";
  return text
    .replaceAll("[NOME + SOBRENOME]", hunter.name.trim())
    .replaceAll("[NOME]", hunter.name.trim())
    .replaceAll("[FIRST NAME]", normalizarNome(firstName(lead.name)))
    .replaceAll("[NA_EMPRESA]", empresaCom("na", lead.company, lead.company_gender))
    .replaceAll("[A_EMPRESA]", empresaCom("a", lead.company, lead.company_gender))
    .replaceAll("[DA_EMPRESA]", empresaCom("da", lead.company, lead.company_gender))
    .replaceAll("[EMPRESA]", lead.company.trim())
    .replaceAll("[CARGO]", cargoSemEmpresa(lead.job_title ?? "", lead.company))
    .replaceAll("[DOR_DO_SETOR]", SECTOR_PAIN[lead.sector ?? ""] ?? "")
    .replaceAll("[CONSULTOR]", fem ? "consultora" : "consultor")
    .replaceAll("[OBRIGADO]", fem ? "obrigada" : "obrigado")
    .replaceAll("[SAUDACAO]", greetingSP(opts.now))
    .replaceAll("[JANELA]", janelaDeTempo(opts.now));
}

export const SECTORS = [
  "Tecnologia / TI",
  "Operações",
  "Marketing",
  "RH",
  "Produto / Inovação",
  "Comercial / Vendas",
] as const;

export const SECTOR_PAIN: Record<string, string> = {
  "Tecnologia / TI":
    "superalocação de equipes de desenvolvedores, impedindo que alguns projetos internos venham a ser priorizados",
  "Operações":
    "sistemas segregados que diminuem produtividade e aumentam retrabalho, dificultando um proveito de 100% do tempo da equipe",
  "Marketing":
    "estruturar plataformas digitais e integrações que suportem iniciativas de marketing, ajudando na geração de mais leads e agregando mais valor à empresa",
  "RH": "organizar fluxos internos, folhas de pagamento, comunicação e gestão de informações entre equipes",
  "Produto / Inovação": "tirar novas iniciativas digitais do papel e estruturar plataformas escaláveis",
  "Comercial / Vendas":
    "organizar informações comerciais e conseguir insights com base nos dados de venda, garantindo visibilidade e eficiência na condução de leads no funil",
};

const SP = "America/Sao_Paulo";

/** Data/hora atual no fuso de São Paulo. */
export function spParts(now = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { iso: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

export function greetingSP(now = new Date()): string {
  const h = spParts(now).hour;
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Janela da reunião pelo dia em que a mensagem é exibida/copiada (fuso SP). */
export function janelaDeTempo(now = new Date()): string {
  const [y, m, d] = spParts(now).iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return wd >= 1 && wd <= 3 ? "nos próximos dias" : "nas próximas semanas";
}

/** Cargo pré-preenchido: texto do headline antes do primeiro "|" ou " @ ". */
export function jobTitleFromHeadline(headline: string): string {
  const m = headline.match(/\s*\|\s*| @ | at | - | – | na | no /i);
  const cut = m && m.index !== undefined ? headline.slice(0, m.index).trim() : headline.trim();
  return cut || headline.trim();
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Remove do fim do cargo " na/no/em/@/at/| <empresa>" para não repetir a empresa na mensagem. */
export function cargoSemEmpresa(cargo: string, empresa: string): string {
  const c = cargo.trim();
  const e = semAcento(empresa);
  if (!e) return c;
  // Testa todos os separadores possíveis, do mais à direita para o mais à esquerda.
  const re = /(?: na | no | em | @ | at |\s*\|\s*)/gi;
  let hit: RegExpExecArray | null;
  let best = -1;
  while ((hit = re.exec(c))) {
    if (semAcento(c.slice(hit.index + hit[0].length)) === e) best = hit.index;
  }
  return best > 0 ? c.slice(0, best).trim() : c;
}

/* --------------------------------- Funil --------------------------------- */

export type FunnelField = "at_marcada_em" | "lead_em" | "proposta_em" | "aprovacao_em" | "vendido_em";
export const FUNNEL: { field: FunnelField; label: string; short: string; points: number }[] = [
  { field: "at_marcada_em", label: "AT marcada", short: "AT", points: 3 },
  { field: "lead_em", label: "Lead", short: "Lead", points: 5 },
  { field: "proposta_em", label: "Proposta marcada", short: "Proposta", points: 10 },
  { field: "aprovacao_em", label: "Aprovação verbal", short: "Aprovação", points: 25 },
  { field: "vendido_em", label: "Projeto vendido", short: "Vendido", points: 50 },
];

/** Índice da última etapa marcada (-1 se nenhuma). */
export function funnelIndex(c: Partial<Record<FunnelField, string | null>>): number {
  let idx = -1;
  FUNNEL.forEach((f, i) => { if (c[f.field]) idx = i; });
  return idx;
}

export function onlyDigits(v: string): string {
  return v.replace(/\D+/g, "");
}

export function whatsappLink(phone: string, message: string): string | null {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/* ---------------------------- Parser do LinkedIn --------------------------- */

export type ParsedContact = {
  name: string;
  headline: string;
  connected_at: string | null;
};

/** Hoje (yyyy-mm-dd) no fuso de São Paulo. */
function todaySP(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftISO(iso: string, days: number, months = 0): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1 + months, d! - days));
  return dt.toISOString().slice(0, 10);
}

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(raw: string): number {
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .slice(0, 3);
  const pt = MONTHS_PT.map((m) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3));
  let i = pt.indexOf(s);
  if (i < 0) i = MONTHS_EN.indexOf(s);
  return i;
}

function iso(y: number, mIdx: number, d: number): string | null {
  if (mIdx < 0 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Linha de data de conexão (pt-BR ou inglês). */
export function isConnectionDateLine(line: string): boolean {
  return /^(conex(ã|a)o feita|connected\b)/i.test(line.trim());
}

/**
 * Converte a linha de data do LinkedIn em yyyy-mm-dd. Aceita:
 * "Conexão feita em 28 de setembro de 2026", "... 28 de set. de 2026",
 * "Conexão feita há 2 dias / 1 semana / 3 horas / 1 mês", "Conexão feita hoje/ontem",
 * "Connected on September 28, 2026", "Connected 2 days ago".
 */
export function parseConnectionDate(line: string, now: Date = new Date()): string | null {
  const l = line.toLowerCase();
  // Absoluta pt-BR: 28 de setembro de 2026 / 28 de set. de 2026
  let m = l.match(/(\d{1,2})\s+de\s+([a-zà-ú]+)\.?\s+de\s+(\d{4})/i);
  if (m) return iso(Number(m[3]), monthIndex(m[2]!), Number(m[1]));
  // Absoluta inglês: September 28, 2026 / Sep 28, 2026
  m = l.match(/([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m && monthIndex(m[1]!) >= 0) return iso(Number(m[3]), monthIndex(m[1]!), Number(m[2]));
  // Absoluta numérica: 28/09/2026
  m = l.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return iso(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const today = todaySP(now);
  if (/\b(hoje|today|agora|now)\b/.test(l)) return today;
  if (/\b(ontem|yesterday)\b/.test(l)) return shiftISO(today, 1);
  // Relativa: há 2 dias / 2 days ago / há uma semana
  m = l.match(/(\d+|um|uma|a|an)\s+(minuto|minute|hora|hour|dia|day|semana|week|m[eê]s|meses|month|ano|year)/);
  if (m) {
    const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : 1;
    const unit = m[2]!;
    if (/^(minuto|minute|hora|hour)/.test(unit)) return today;
    if (/^(dia|day)/.test(unit)) return shiftISO(today, n);
    if (/^(semana|week)/.test(unit)) return shiftISO(today, n * 7);
    if (/^(m[eê]s|meses|month)/.test(unit)) return shiftISO(today, 0, -n);
    if (/^(ano|year)/.test(unit)) return shiftISO(today, 0, -12 * n);
  }
  return null;
}

export function cleanName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  const comma = name.indexOf(",");
  if (comma > 0) name = name.slice(0, comma);
  const suffix = name.search(/ [-|] /);
  if (suffix > 0) name = name.slice(0, suffix);
  name = name.replace(/\s*\([^()]*\)?\s*$/, "");
  return normalizarNome(name.trim());
}

const PARTICULAS = new Set([
  "de", "da", "do", "das", "dos", "e",
  "van", "von", "der", "den", "du", "del", "della", "y",
]);

const lowerBR = (s: string) => s.toLocaleLowerCase("pt-BR");
const upperBR = (s: string) => s.toLocaleUpperCase("pt-BR");

/** Maiúscula na primeira LETRA (ignora pontuação inicial, ex.: "(PMP" → "(Pmp"). */
function capitalizar(s: string): string {
  const lower = lowerBR(s);
  const i = lower.search(/\p{L}/u);
  if (i < 0) return lower;
  return lower.slice(0, i) + upperBR(lower.charAt(i)) + lower.slice(i + 1);
}

function normalizarParte(p: string): string {
  if (p !== lowerBR(p) && p !== upperBR(p)) return p; // caixa mista (McDonald)
  const segs = p.split(/(['’])/);
  let out = capitalizar(segs[0]!);
  for (let i = 1; i < segs.length; i += 2) {
    const before = (segs[i - 1] ?? "").replace(/[^\p{L}]/gu, "");
    const next = segs[i + 1] ?? "";
    out += segs[i]! + (before.length >= 1 && before.length <= 2 ? capitalizar(next) : lowerBR(next));
  }
  return out;
}

/** Normaliza a caixa de um nome de pessoa (não usar em empresa). */
export function normalizarNome(nome: string): string {
  const trimmed = nome.trim();
  const nomeTodoMaiusculo = trimmed === upperBR(trimmed);
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      if (i > 0 && PARTICULAS.has(lowerBR(w))) return lowerBR(w);
      const letras = w.replace(/[^\p{L}]/gu, "");
      if (!nomeTodoMaiusculo && letras.length >= 2 && letras.length <= 4 && letras === upperBR(letras) && letras !== lowerBR(letras))
        return w; // sigla (MBA, PCD)
      return w
        .split(/(-)/)
        .map((part) => (part === "-" ? part : normalizarParte(part)))
        .join("");
    })
    .join(" ");
}

const PHOTO_RE = /^(foto do perfil de|foto de perfil de|profile picture of|profile photo of|foto de)\s+/i;
const PHOTO_SUFFIX_RE = /['’]s? profile (picture|photo)$/i;

/** Extrai X de "Foto de perfil de X", "Profile picture of X" ou "X's profile picture". */
function photoNameOf(line: string): string | null {
  const pre = line.match(PHOTO_RE);
  if (pre) return line.slice(pre[0].length).trim();
  const suf = line.match(PHOTO_SUFFIX_RE);
  if (suf) return line.slice(0, suf.index).trim();
  const acc = line.match(/^acessar perfil de\s+/i);
  if (acc) return line.slice(acc[0].length).replace(/\s*a [úu]ltima atividade.*$/i, "").trim();
  return null;
}

/** Nome que claramente não é contato (lixo de interface do LinkedIn). */
export function isJunkName(name: string): boolean {
  return /foto d[eo] perfil|profile picture|^classificar por|^por:$/i.test(name.trim());
}

/** Botões e textos de interface do LinkedIn que nunca são dados do contato. */
const NOISE_RE = new RegExp(
  [
    "^(enviar )?mensagem$",
    "^enviar mensagem\\b",
    "^message$",
    "^send message\\b",
    "^enviar inmail$",
    "^mais( ações| opções)?$",
    "^more( actions)?$",
    "^remover conex(ã|a)o$",
    "^remove connection$",
    "^classificar por",
    "^por:$",
    "^salvar no sales navigator",
    "^sort by",
    "^adicionados recentemente",
    "^recently added",
    "^(pesquisar|search)( |$)",
    "^pular para",
    "^skip to",
    "^(início|minha rede|vagas|notificações|eu|para negócios|home|my network|jobs|messaging|notifications)$",
    "^gerenciar (minha rede|contatos)",
    "^[\\d.,]+\\s+(conex(õ|o)es|connections)$",
    "^status (está|is) ",
    "^\\d+\\s+notifica",
    "^--$",
  ].join("|"),
  "i",
);

function isNoise(line: string): boolean {
  return NOISE_RE.test(line);
}

/**
 * Lê o texto copiado da página de conexões do LinkedIn (com ou sem Ctrl+A).
 * Cada contato termina na linha "Conexão feita ..."; o nome vem da linha
 * "Foto do perfil de X" (quando existe) ou das duas linhas antes da data.
 * Se o texto não tiver linhas de data, separa pelos botões/fotos de perfil.
 */
export function parseLinkedInConnections(text: string, now: Date = new Date()): ParsedContact[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  const out: ParsedContact[] = [];
  const hasDates = lines.some(isConnectionDateLine);

  // Cada bloco: linhas de informação (sem ruído) + nome da foto, se houver.
  let info: string[] = [];
  let photoName: string | null = null;

  const build = (dateLine: string | null): void => {
    let name = "";
    let headline = "";
    if (photoName) {
      name = cleanName(photoName);
      const target = normalizeKey(name, "");
      const idx = info.findIndex((l) => normalizeKey(cleanName(l), "") === target);
      const after = idx >= 0 ? info.slice(idx + 1) : info;
      headline = after[0] ?? "";
    } else if (hasDates) {
      // Sem foto: as duas últimas linhas antes da data (ignora cabeçalho da página).
      if (info.length >= 2) {
        name = cleanName(info[info.length - 2]!);
        headline = info[info.length - 1]!;
      } else {
        name = cleanName(info[0] ?? "");
      }
    } else {
      name = cleanName(info[0] ?? "");
      headline = info[1] ?? "";
    }
    info = [];
    photoName = null;
    if (!name || isNoise(name) || isJunkName(name)) return;
    out.push({
      name,
      headline: headline.trim(),
      connected_at: dateLine ? parseConnectionDate(dateLine, now) : null,
    });
  };

  for (const line of lines) {
    const photo = photoNameOf(line);
    if (photo !== null) {
      // "Acessar perfil de X" logo após a foto do mesmo contato: só ignora.
      if (/^acessar perfil de/i.test(line) && photoName) continue;
      // Nova foto antes de fechar o bloco anterior: contato sem data.
      if (photoName) build(null);
      else info = []; // descarta cabeçalho/sobras antes do contato
      photoName = photo;
      continue;
    }
    if (isConnectionDateLine(line)) {
      build(line);
      continue;
    }
    if (isNoise(line)) {
      // Sem datas no texto, o botão de mensagem fecha o contato.
      if (!hasDates && /mensagem|message/i.test(line) && (info.length || photoName)) build(null);
      continue;
    }
    info.push(line);
  }
  if (!hasDates && (info.length || photoName)) build(null);
  else if (photoName) build(null);
  return out;
}

export function normalizeKey(name: string, headline: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return `${norm(name)}|${norm(headline)}`;
}

export function toCSV(rows: string[][]): string {
  return rows
    .map((r) =>
      r.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(";"),
    )
    .join("\n");
}
