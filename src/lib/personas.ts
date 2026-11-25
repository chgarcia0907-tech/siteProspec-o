// Persona do contato (papel na decisão de compra, GTM do NTec) e a sugestão pelo cargo.
// Par TS/SQL: `matchPersona` ↔ `public.match_persona` e `suggestPersona` ↔ `public.suggest_persona`
// (migração `*_setor_subsetor_persona.sql`). Mudou uma palavra aqui? Crie outra migração: o teste
// `personas.test.ts` confere que o SQL carrega as mesmas palavras.

export const PERSONAS = [
  {
    key: "owner_processo",
    label: "Owner do Processo",
    description: "Executa e cuida do processo no dia a dia (analistas, especialistas, líderes).",
  },
  {
    key: "owner_operacao",
    label: "Owner da Operação",
    description: "Responde pela operação da área (gerentes, heads, gestores).",
  },
  {
    key: "patrocinador_executivo",
    label: "Patrocinador Executivo",
    description: "Decide e patrocina a compra (C-level, diretores, sócios).",
  },
  {
    key: "owner_tecnologia",
    label: "Owner da Tecnologia",
    description: "Responde por sistemas e tecnologia (CIO, CTO, TI).",
  },
] as const;

export type Persona = (typeof PERSONAS)[number]["key"];

export const PERSONA_KEYS: readonly Persona[] = PERSONAS.map((p) => p.key);

export const PERSONA_LABEL: Record<Persona, string> = Object.fromEntries(
  PERSONAS.map((p) => [p.key, p.label]),
) as Record<Persona, string>;

/** Persona usada quando o cargo não diz nada. */
export const DEFAULT_PERSONA: Persona = "owner_operacao";

export const isPersona = (v: unknown): v is Persona =>
  typeof v === "string" && (PERSONA_KEYS as readonly string[]).includes(v);

/**
 * Regras da sugestão, em ordem de prioridade (a primeira que casar vence). Cada palavra é um
 * trecho de regex sobre o texto sem acento e em minúsculas, casado como palavra inteira. O SQL
 * usa o mesmo trecho, então só vale a interseção entre JS e POSIX: grupos, `|`, `?` e classes.
 */
export type PersonaRule = {
  persona: Persona;
  words: string[];
  /** Expressões tiradas do texto antes de casar (ex.: "product owner" não é patrocinador). */
  strip?: string[];
  /** Palavras que só valem quando o texto também cita algum destes trechos (sem borda de palavra). */
  contextual?: { words: string[]; when: string[] };
};

export const PERSONA_RULES: PersonaRule[] = [
  {
    persona: "owner_tecnologia",
    words: [
      "cio",
      "cto",
      "ti",
      "sistemas",
      "tecnologia",
      "tech lead",
      "arquitet(o|a|os|as)",
      "desenvolvimento",
    ],
    strip: ["desenvolvimento de negocios", "desenvolvimento comercial", "business development"],
  },
  {
    persona: "patrocinador_executivo",
    words: [
      "ceo",
      "coo",
      "cfo",
      "presidente(s)?",
      "vice-presidente(s)?",
      "vp",
      "diretor(a|es|as)?",
      "soci(o|a|os|as)",
      "fundador(a|es|as)?",
      "cofundador(a|es|as)?",
      "owner(s)?",
    ],
    strip: ["product owner", "process owner"],
  },
  {
    persona: "owner_operacao",
    words: ["gerente(s)?", "head(s)?", "gestor(a|es|as)?", "encarregad(o|a|os|as)"],
    contextual: {
      words: ["coordenador(a|es|as)?"],
      when: ["operac", "logistic", "producao", "engenharia", "manutencao"],
    },
  },
  {
    persona: "owner_processo",
    words: [
      "analista(s)?",
      "assistente(s)?",
      "especialista(s)?",
      "supervisor(a|es|as)?",
      "lider(es)?",
      "coordenador(a|es|as)?",
    ],
  },
];

/** Texto comparável: sem acento e em minúsculas (mesma conta do `translate`/`lower` do SQL). */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const wordRe = (words: string[]) => new RegExp(`(?<![a-z0-9])(${words.join("|")})(?![a-z0-9])`);

const COMPILED = PERSONA_RULES.map((r) => ({
  rule: r,
  words: wordRe(r.words),
  strip: r.strip ? new RegExp(`(${r.strip.join("|")})`, "g") : null,
  contextual: r.contextual
    ? { words: wordRe(r.contextual.words), when: new RegExp(`(${r.contextual.when.join("|")})`) }
    : null,
}));

/** Persona que o texto indica, ou `null` quando nenhuma regra casa. */
export function matchPersona(texto: string): Persona | null {
  const t = fold(texto ?? "");
  if (!t.trim()) return null;
  for (const { rule, words, strip, contextual } of COMPILED) {
    const s = strip ? t.replace(strip, " ") : t;
    if (words.test(s)) return rule.persona;
    if (contextual && contextual.words.test(s) && contextual.when.test(s)) return rule.persona;
  }
  return null;
}

/** Persona sugerida: o cargo decide; sem pista no cargo, o headline; senão Owner da Operação. */
export function suggestPersona(cargo: string, headline = ""): Persona {
  return matchPersona(cargo) ?? matchPersona(headline) ?? DEFAULT_PERSONA;
}

/**
 * Persona efetiva do contato. Nula no banco = ainda sugerida (calculada na hora); gravada, mesmo
 * igual à sugestão, quer dizer confirmada pelo hunter.
 */
export function contactPersona(c: {
  persona: Persona | null;
  job_title: string;
  headline: string;
}): { persona: Persona; suggested: boolean } {
  if (c.persona) return { persona: c.persona, suggested: false };
  return { persona: suggestPersona(c.job_title, c.headline), suggested: true };
}
