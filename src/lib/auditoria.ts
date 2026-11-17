// Auditoria de conexões: compara as conexões do LinkedIn de um hunter (coladas pelo admin)
// com os contatos que ele importou, para saber se as conexões novas estão entrando na cadência.
import { normalizeKey, type ParsedContact } from "./cadencia";

/** Contato do hunter usado na comparação (o que o painel carrega). */
export type AuditContact = {
  id: string;
  name: string;
  headline: string;
  connected_at: string | null;
  created_at: string;
  status: string;
  sent1_at: string | null;
};

/**
 * Como a conexão foi encontrada entre os contatos:
 * - exato: mesmo nome e mesma headline (o que a própria importação usa para evitar duplicata);
 * - nome: mesmo nome, headline diferente (a pessoa mudou a headline no LinkedIn);
 * - aproximado: mesmo primeiro e último nome (o hunter editou o nome, ex.: tirou o do meio).
 */
export type MatchKind = "exato" | "nome" | "aproximado";

export type AuditRow = ParsedContact & {
  /** Dias desde a conexão (null quando o LinkedIn não mostrou a data). */
  days: number | null;
  match: AuditContact | null;
  kind: MatchKind | null;
};

export type AuditBucket = {
  key: "7d" | "30d" | "antigas" | "sem_data";
  label: string;
  total: number;
  importadas: number;
  faltando: number;
};

export type AuditResult = {
  rows: AuditRow[];
  total: number;
  importadas: number;
  faltando: number;
  /** % de conexões importadas (0–100, inteiro). */
  cobertura: number;
  buckets: AuditBucket[];
  /** Conexão não importada mais antiga (yyyy-mm-dd), para dizer "desde quando" está faltando. */
  faltandoDesde: string | null;
  /** Dia da última importação do hunter (yyyy-mm-dd, fuso de São Paulo). */
  ultimaImportacao: string | null;
};

/** Nome só com letras minúsculas sem acento, separado por espaço. */
export function normName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primeiro + último nome normalizados; null quando há só um nome (pouco confiável). */
function firstLastKey(name: string): string | null {
  const parts = normName(name).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]}|${parts[parts.length - 1]}`;
}

/** Dia (yyyy-mm-dd) de um timestamp no fuso de São Paulo. */
export function spDay(ts: string): string {
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Dias corridos entre duas datas ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  const t = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

function bucketOf(days: number | null): AuditBucket["key"] {
  if (days === null) return "sem_data";
  if (days <= 7) return "7d";
  if (days <= 30) return "30d";
  return "antigas";
}

const BUCKET_LABEL: Record<AuditBucket["key"], string> = {
  "7d": "Últimos 7 dias",
  "30d": "8 a 30 dias",
  antigas: "Mais de 30 dias",
  sem_data: "Sem data",
};

/**
 * Compara as conexões coladas com os contatos do hunter. Cada contato casa com no máximo
 * uma conexão, tentando do critério mais forte (exato) para o mais fraco (aproximado).
 * Conexões repetidas no texto colado são contadas uma vez.
 */
export function auditConnections(
  parsed: ParsedContact[],
  contacts: AuditContact[],
  today: string,
): AuditResult {
  const byExact = new Map<string, AuditContact[]>();
  const byName = new Map<string, AuditContact[]>();
  const byFirstLast = new Map<string, AuditContact[]>();
  const push = (m: Map<string, AuditContact[]>, k: string | null, c: AuditContact) => {
    if (!k) return;
    const list = m.get(k);
    if (list) list.push(c);
    else m.set(k, [c]);
  };
  for (const c of contacts) {
    push(byExact, normalizeKey(c.name, c.headline), c);
    push(byName, normName(c.name), c);
    push(byFirstLast, firstLastKey(c.name), c);
  }

  const used = new Set<string>();
  const take = (list: AuditContact[] | undefined) => {
    const c = list?.find((x) => !used.has(x.id)) ?? null;
    if (c) used.add(c.id);
    return c;
  };

  // Remove repetidos do texto colado (mesmo nome e headline).
  const seen = new Set<string>();
  const unique = parsed.filter((p) => {
    const k = normalizeKey(p.name, p.headline);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Três passadas para que um casamento fraco não "roube" o contato de um casamento forte.
  const match: (AuditContact | null)[] = unique.map(() => null);
  const kind: (MatchKind | null)[] = unique.map(() => null);
  const pass = (k: MatchKind, find: (p: ParsedContact) => AuditContact | null) =>
    unique.forEach((p, i) => {
      if (match[i]) return;
      const c = find(p);
      if (c) {
        match[i] = c;
        kind[i] = k;
      }
    });
  pass("exato", (p) => take(byExact.get(normalizeKey(p.name, p.headline))));
  pass("nome", (p) => take(byName.get(normName(p.name))));
  pass("aproximado", (p) => {
    const k = firstLastKey(p.name);
    return k ? take(byFirstLast.get(k)) : null;
  });

  const rows: AuditRow[] = unique.map((p, i) => ({
    ...p,
    days: p.connected_at ? Math.max(0, daysBetween(p.connected_at, today)) : null,
    match: match[i] ?? null,
    kind: kind[i] ?? null,
  }));

  const buckets = (["7d", "30d", "antigas", "sem_data"] as const).map((key) => {
    const inB = rows.filter((r) => bucketOf(r.days) === key);
    const importadas = inB.filter((r) => r.match).length;
    return {
      key,
      label: BUCKET_LABEL[key],
      total: inB.length,
      importadas,
      faltando: inB.length - importadas,
    };
  });

  const importadas = rows.filter((r) => r.match).length;
  const faltandoDatas = rows
    .filter((r) => !r.match && r.connected_at)
    .map((r) => r.connected_at!)
    .sort();
  const ultima = contacts.reduce<string | null>(
    (max, c) => (!max || c.created_at > max ? c.created_at : max),
    null,
  );

  return {
    rows,
    total: rows.length,
    importadas,
    faltando: rows.length - importadas,
    cobertura: rows.length ? Math.round((importadas / rows.length) * 100) : 0,
    buckets,
    faltandoDesde: faltandoDatas[0] ?? null,
    ultimaImportacao: ultima ? spDay(ultima) : null,
  };
}

/** Ordem de exibição: não importadas primeiro, depois as conexões mais recentes. */
export function sortAuditRows(rows: AuditRow[]): AuditRow[] {
  return [...rows].sort((a, b) => {
    if (!a.match !== !b.match) return a.match ? 1 : -1;
    return (a.days ?? Infinity) - (b.days ?? Infinity);
  });
}
