// Preenchimento automático de empresa e área do contato a partir do headline do LinkedIn.
// Regras conservadoras: na dúvida, deixa o campo vazio para o hunter preencher.
import { SECTORS, type CompanyGender, type Contact } from "./cadencia";
import { matchCompany, normalizeCompany, type Company } from "./empresas";

export type Area = (typeof SECTORS)[number];
export type CompanyGuess = { name: string; gender: CompanyGender };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/* -------------------------------- Empresa -------------------------------- */

/** Conector antes do nome da empresa e a concordância que ele revela. */
const CONNECTORS: { re: RegExp; gender: CompanyGender }[] = [
  { re: /\s@\s*|^@\s*|(?<=\S)@(?=\S)/g, gender: "feminino" },
  { re: /\s+at\s+/gi, gender: "feminino" },
  { re: /\s+na\s+/gi, gender: "feminino" },
  { re: /\s+no\s+/gi, gender: "masculino" },
  { re: /\s+da\s+/gi, gender: "feminino" },
  { re: /\s+do\s+/gi, gender: "masculino" },
];

/** Palavras que, logo após o conector, indicam que não vem um nome de empresa. */
const NOT_COMPANY = new Set(
  [
    "area",
    "areas",
    "setor",
    "time",
    "equipe",
    "empresa",
    "empresas",
    "departamento",
    "diretoria",
    "gerencia",
    "coordenacao",
    "divisao",
    "nucleo",
    "unidade",
    "mercado",
    "industria",
    "segmento",
    "ramo",
    "regiao",
    "brasil",
    "america",
    "latam",
    "linkedin",
    "momento",
    "busca",
    "procura",
    "transicao",
    "aberto",
    "aberta",
    "projeto",
    "projetos",
    "cliente",
    "clientes",
    "startup",
    "startups",
    "universidade",
    "faculdade",
    "escola",
    "graduacao",
    "pos",
    "mestrado",
    "doutorado",
    "my",
    "the",
    "a",
    "o",
    "os",
    "as",
    "um",
    "uma",
    "minha",
    "meu",
    "nossa",
    "nosso",
    "sua",
    "seu",
  ].map(fold),
);

/** Trecho que nunca traz o empregador atual (ex.: "Ex-Ambev", "Aberto a oportunidades"). */
const SKIP_SEGMENT =
  /^(ex[\s-]|former\b|aberto|aberta|open to|em busca|buscando|procurando|freelancer|freela\b|autonom|estudante|student)/i;

/** Corta o nome da empresa no próximo separador, vírgula, parêntese, " e " ou outro conector. */
const NAME_END = /\s+[-–—]\s+|[,;()/]|\s+e\s+|\s+(?:na|no|em|at|@)\s+/i;

const MAX_WORDS = 5;
const MAX_LEN = 40;

function cleanCompanyName(raw: string): string | null {
  const cut = raw.split(NAME_END)[0] ?? "";
  const name = cut
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/[.:!?\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > MAX_LEN) return null;
  const words = name.split(" ");
  if (words.length > MAX_WORDS) return null;
  if (NOT_COMPANY.has(fold(words[0]!))) return null;
  // Nome próprio: tem maiúscula ou número (aceita "iFood", "99"; recusa "vendas e marketing").
  if (!/[\p{Lu}\d]/u.test(name)) return null;
  return name;
}

/**
 * Empresa citada no headline: o nome depois de "@", "at", "na", "no", "da" ou "do"
 * (ex.: "Gerente Comercial na Ambev | Ex-Coca-Cola" → Ambev, feminino).
 * Ignora trechos de empregador antigo e retorna null quando não há nome claro.
 */
export function companyFromHeadline(headline: string): CompanyGuess | null {
  const segments = headline.split(/\s*[|•·;]\s*/);
  for (const seg of segments) {
    const s = seg.trim();
    if (!s || SKIP_SEGMENT.test(s)) continue;
    let best: { index: number; guess: CompanyGuess } | null = null;
    for (const { re, gender } of CONNECTORS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        if (best && m.index >= best.index) break;
        const name = cleanCompanyName(s.slice(m.index + m[0].length));
        if (name) {
          best = { index: m.index, guess: { name, gender } };
          break;
        }
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    if (best) return best.guess;
  }
  return null;
}

/* ---------------------------------- Área --------------------------------- */

/** Palavras-chave de cada área (sem acento, minúsculas, comparadas como palavras inteiras). */
const AREA_KEYWORDS: Record<Area, string[]> = {
  RH: [
    "rh",
    "recursos humanos",
    "human resources",
    "hr",
    "hrbp",
    "chro",
    "people",
    "gente e gestao",
    "gente & gestao",
    "talentos",
    "talent",
    "talent acquisition",
    "recrutamento",
    "recrutador",
    "recrutadora",
    "recruiter",
    "tech recruiter",
    "recruitment",
    "headhunter",
    "departamento pessoal",
    "folha de pagamento",
    "treinamento e desenvolvimento",
    "remuneracao",
    "beneficios",
  ],
  Marketing: [
    "marketing",
    "mkt",
    "product marketing",
    "trade marketing",
    "growth",
    "branding",
    "brand",
    "marca",
    "comunicacao",
    "social media",
    "midias sociais",
    "redes sociais",
    "conteudo",
    "content",
    "seo",
    "cmo",
    "publicidade",
    "relacoes publicas",
    "inbound",
  ],
  "Comercial / Vendas": [
    "comercial",
    "vendas",
    "vendedor",
    "vendedora",
    "sales",
    "inside sales",
    "pre-vendas",
    "pre vendas",
    "sdr",
    "bdr",
    "closer",
    "account executive",
    "account manager",
    "key account",
    "executivo de contas",
    "executiva de contas",
    "novos negocios",
    "new business",
    "business development",
    "desenvolvimento de negocios",
    "customer success",
    "sucesso do cliente",
    "cro",
    "representante comercial",
    "parcerias",
    "partnerships",
    "revenue",
  ],
  "Tecnologia / TI": [
    "ti",
    "t.i",
    "tecnologia",
    "technology",
    "it",
    "cto",
    "cio",
    "ciso",
    "software",
    "engenheiro de software",
    "engenheira de software",
    "software engineer",
    "desenvolvedor",
    "desenvolvedora",
    "developer",
    "dev",
    "programador",
    "programadora",
    "fullstack",
    "full stack",
    "full-stack",
    "front-end",
    "frontend",
    "back-end",
    "backend",
    "mobile",
    "devops",
    "sre",
    "cloud",
    "infraestrutura",
    "infra",
    "sistemas",
    "dados",
    "data",
    "data science",
    "cientista de dados",
    "engenheiro de dados",
    "engenheira de dados",
    "bi",
    "business intelligence",
    "analytics",
    "machine learning",
    "inteligencia artificial",
    "ia",
    "seguranca da informacao",
    "ciberseguranca",
    "cybersecurity",
    "arquiteto de solucoes",
    "arquiteta de solucoes",
    "arquiteto de software",
    "arquiteta de software",
    "qa",
    "quality assurance",
    "tech lead",
    "scrum master",
    "erp",
    "sap",
    "suporte tecnico",
    "help desk",
    "transformacao digital",
    "digital transformation",
  ],
  "Produto / Inovação": [
    "produto",
    "produtos",
    "product",
    "product owner",
    "product manager",
    "po",
    "cpo",
    "inovacao",
    "innovation",
    "ux",
    "ui",
    "ux/ui",
    "designer",
    "product design",
    "pesquisa e desenvolvimento",
    "p&d",
    "r&d",
    "novos produtos",
  ],
  Operações: [
    "operacoes",
    "operacional",
    "operations",
    "coo",
    "logistica",
    "logistics",
    "supply chain",
    "suprimentos",
    "compras",
    "procurement",
    "producao",
    "manufatura",
    "industrial",
    "qualidade",
    "manutencao",
    "processos",
    "melhoria continua",
    "lean",
    "six sigma",
    "facilities",
    "pcp",
    "engenharia de producao",
    "engenheiro de producao",
    "engenheira de producao",
    "fabrica",
    "planta",
    "expedicao",
    "estoque",
    "almoxarifado",
    "backoffice",
    "back office",
  ],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AREA_RULES = (Object.entries(AREA_KEYWORDS) as [Area, string[]][]).flatMap(([area, kws]) =>
  kws.map((kw) => ({
    area,
    kw,
    re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(kw)}(?![\\p{L}\\p{N}])`, "u"),
  })),
);

function areaOf(text: string): Area | null {
  const t = fold(text);
  if (!t.trim()) return null;
  let best: { index: number; len: number; area: Area } | null = null;
  for (const { area, kw, re } of AREA_RULES) {
    const m = re.exec(t);
    if (!m) continue;
    // A palavra-chave que aparece primeiro decide; empate fica com a mais longa (mais específica).
    if (!best || m.index < best.index || (m.index === best.index && kw.length > best.len))
      best = { index: m.index, len: kw.length, area };
  }
  return best?.area ?? null;
}

/**
 * Área do contato (TI, RH...) pelo cargo e, se o cargo não disser, pelo headline.
 * Cargos sem área (CEO, sócio, fundador, financeiro) ficam sem sugestão.
 */
export function areaFromTitle(jobTitle: string, headline = ""): Area | null {
  return areaOf(jobTitle) ?? areaOf(headline);
}

/* --------------------------------- Nível --------------------------------- */

/** Senioridade do contato, do topo para a base (dimensão da aba Segmentos da Dashboard). */
export const NIVEIS = [
  { key: "c_level", label: "C-level e sócios" },
  { key: "diretoria", label: "Diretoria" },
  { key: "gerencia", label: "Gerência" },
  { key: "coordenacao", label: "Coordenação" },
  { key: "analista", label: "Analista e especialista" },
  { key: "estagio", label: "Estágio" },
] as const;
export type Nivel = (typeof NIVEIS)[number]["key"];
export const NIVEL_LABEL = Object.fromEntries(NIVEIS.map((n) => [n.key, n.label])) as Record<
  Nivel,
  string
>;

/**
 * Palavras de cada nível, em ordem de prioridade (o nível mais alto citado vence: "Sócio-diretor"
 * é C-level). Trechos de regex sobre o texto sem acento e em minúsculas, casados como palavra
 * inteira, como nas personas.
 */
const NIVEL_RULES: { nivel: Nivel; words: string[] }[] = [
  {
    nivel: "c_level",
    words: [
      "c(e|o|f|t|i|m|h|r|d)o",
      "chief",
      "presidente(s)?",
      "president",
      "vice-presidente(s)?",
      "vp",
      "soci(o|a|os|as)",
      "partner",
      "fundador(a|es|as)?",
      "cofundador(a|es|as)?",
      "co-fundador(a|es|as)?",
      "founder",
      "co-founder",
      "owner",
      "dono(a)?",
      "proprietari(o|a)",
    ],
  },
  { nivel: "diretoria", words: ["diretor(a|es|as)?", "director", "superintendente"] },
  {
    nivel: "gerencia",
    words: ["gerente(s)?", "manager", "head(s)?", "gestor(a|es|as)?"],
  },
  {
    nivel: "coordenacao",
    words: [
      "coordenador(a|es|as)?",
      "coordinator",
      "supervisor(a|es|as)?",
      "lider(es)?",
      "lead",
      "encarregad(o|a|os|as)",
    ],
  },
  { nivel: "estagio", words: ["estagiari(o|a|os|as)", "estagio", "intern", "trainee", "aprendiz"] },
  {
    nivel: "analista",
    words: [
      "analista(s)?",
      "analyst",
      "especialista(s)?",
      "specialist",
      "assistente(s)?",
      "auxiliar(es)?",
      "consultor(a|es|as)?",
      "engenheir(o|a|os|as)",
      "engineer",
      "comprador(a|es|as)?",
      "tecnic(o|a|os|as)",
      "desenvolvedor(a|es|as)?",
      "developer",
      "executiv(o|a) de contas",
    ],
  },
];
// Cargos com "owner"/"lead" que não dizem o nível do dono ("product owner", "tech lead").
const NIVEL_STRIP = /(product owner|process owner|tech lead|lead generation)/g;
const NIVEL_COMPILED = NIVEL_RULES.map((r) => ({
  nivel: r.nivel,
  re: new RegExp(`(?<![a-z0-9])(${r.words.join("|")})(?![a-z0-9])`),
}));

function nivelDe(texto: string): Nivel | null {
  const t = fold(texto ?? "").replace(NIVEL_STRIP, " ");
  if (!t.trim()) return null;
  return NIVEL_COMPILED.find((r) => r.re.test(t))?.nivel ?? null;
}

/**
 * Nível de senioridade pelo cargo e, se o cargo não disser, pelo headline. Na dúvida, null
 * (o contato fica fora da quebra por nível). Calculado na hora, nunca gravado.
 */
export function nivelDoCargo(cargo: string, headline = ""): Nivel | null {
  return nivelDe(cargo) ?? nivelDe(headline);
}

/* ----------------------------- Preenchimento ----------------------------- */

type FillInput = Pick<
  Contact,
  "headline" | "job_title" | "company" | "company_id" | "company_gender" | "sector"
>;

/** Empresa sugerida: empresa cadastrada citada no headline; senão o nome tirado do headline. */
export function suggestCompany(
  headline: string,
  companies: readonly Pick<Company, "id" | "name">[],
): { company_id: string } | { company: string; company_gender: CompanyGender } | null {
  const registered = matchCompany(headline, companies);
  if (registered) return { company_id: registered.id };
  const guess = companyFromHeadline(headline);
  if (!guess) return null;
  // O nome tirado do headline pode ser exatamente uma empresa cadastrada (ex.: só a sigla).
  const same = companies.find((c) => normalizeCompany(c.name) === normalizeCompany(guess.name));
  return same ? { company_id: same.id } : { company: guess.name, company_gender: guess.gender };
}

/**
 * Alterações que completam empresa e área de um contato. Só preenche campo vazio: o que o
 * hunter já escreveu nunca muda. Empresa escrita à mão igual a uma cadastrada vira vínculo.
 */
export function autoFillPatch(
  c: FillInput,
  companies: readonly Pick<Company, "id" | "name">[],
): Partial<Contact> | null {
  const patch: Partial<Contact> = {};
  if (!c.company_id) {
    if (!c.company.trim()) {
      Object.assign(patch, suggestCompany(c.headline, companies) ?? {});
    } else {
      const key = normalizeCompany(c.company);
      const same = companies.find((co) => normalizeCompany(co.name) === key);
      if (same) patch.company_id = same.id;
    }
  }
  if (!c.sector.trim()) {
    const area = areaFromTitle(c.job_title, c.headline);
    if (area) patch.sector = area;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Contagem do que o preenchimento automático vai mudar, para a confirmação. */
export function autoFillSummary(patches: readonly Partial<Contact>[]) {
  let linked = 0;
  let named = 0;
  let areas = 0;
  for (const p of patches) {
    if (p.company_id) linked++;
    if (p.company) named++;
    if (p.sector) areas++;
  }
  return { contacts: patches.length, linked, named, areas };
}

/** Agrupa alterações iguais para gravar várias linhas por requisição. */
export function groupPatches(
  items: readonly { id: string; patch: Partial<Contact> }[],
): { ids: string[]; patch: Partial<Contact> }[] {
  const map = new Map<string, { ids: string[]; patch: Partial<Contact> }>();
  for (const { id, patch } of items) {
    const key = JSON.stringify(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b)));
    const g = map.get(key) ?? { ids: [], patch };
    g.ids.push(id);
    map.set(key, g);
  }
  return [...map.values()];
}
