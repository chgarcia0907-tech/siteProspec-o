// Empresas prospectadas pelo hunter e cadências por ramo de atuação (setor da empresa).
import type { Tables } from "@/integrations/supabase/types";
import { STEPS, addDaysISO, weekdayISO, type CompanyGender, type StepDef } from "./cadencia";
import type { Persona } from "./personas";

/** Linha de `companies`, com a concordância estreitada para a união usada no app. */
export type Company = Omit<Tables<"companies">, "gender"> & { gender: CompanyGender };
export type Sector = Tables<"sectors">;
/**
 * Setor ou subsetor (linha de `sectors`; subsetor = `parent_id` preenchido). As regras abaixo só
 * pedem estes campos, então valem para `useSectors`, `useSectorTree` e a leitura do painel.
 */
export type SectorNode = Pick<Sector, "id" | "name" | "active" | "sort"> & {
  parent_id: string | null;
};
export type TemplateText = { code: string; body: string };
/** Mensagens das cadências por setor: setor → etapa → modelo. */
export type SectorTemplates = Record<string, Partial<Record<StepDef["n"], TemplateText>>>;
/** Persona de uma mensagem da cadência: `""` = qualquer persona. */
export type PersonaKey = Persona | "";
/** Cadências por setor ou subsetor: setor → persona (`""` = qualquer) → etapa → modelo. */
export type SectorCadences = Record<string, Partial<Record<PersonaKey, SectorTemplates[string]>>>;

/** Segunda-feira da semana de uma data ISO (semana de prospecção vai de segunda a domingo). */
export function weekStartISO(iso: string): string {
  const wd = weekdayISO(iso);
  return addDaysISO(iso.slice(0, 10), wd === 0 ? -6 : 1 - wd);
}

/** Domingo que fecha a semana iniciada em `weekStart`. */
export function weekEndISO(weekStart: string): string {
  return addDaysISO(weekStart, 6);
}

/** Nome comparável: sem acentos, caixa baixa, pontuação e espaços repetidos removidos. */
export function normalizeCompany(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .trim();
}

/** Nomes colados um por linha (ou separados por ;), sem vazios e sem repetidos. */
export function parseCompanyLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n;]/)) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = normalizeCompany(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Empresa cadastrada cujo nome aparece no texto (headline do LinkedIn ou campo empresa),
 * como palavra inteira. Havendo mais de uma, fica a de nome mais longo (mais específica).
 */
export function matchCompany<C extends Pick<Company, "id" | "name">>(
  text: string,
  companies: readonly C[],
): C | null {
  const hay = ` ${normalizeCompany(text)} `;
  if (!hay.trim()) return null;
  let best: C | null = null;
  let bestLen = 0;
  for (const co of companies) {
    const key = normalizeCompany(co.name);
    if (key.length < 2 || key.length <= bestLen) continue;
    if (hay.includes(` ${key} `)) {
      best = co;
      bestLen = key.length;
    }
  }
  return best;
}

/** Empresas agrupadas por semana, da mais recente para a mais antiga; dentro da semana, por nome. */
export function groupByWeek<C extends Pick<Company, "name" | "week_start">>(
  companies: readonly C[],
): { week: string; companies: C[] }[] {
  const map = new Map<string, C[]>();
  for (const co of companies) {
    const list = map.get(co.week_start) ?? [];
    list.push(co);
    map.set(co.week_start, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, list]) => ({
      week,
      companies: [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }));
}

/** Setores na ordem definida pelo admin (desempate pelo nome). */
export function sortSectors<S extends Pick<Sector, "name" | "sort">>(sectors: readonly S[]): S[] {
  return [...sectors].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "pt-BR"));
}

/** Etapas da cadência do setor que ainda não têm mensagem. */
export function missingSteps(
  templates: SectorTemplates[string] | undefined,
  steps: readonly StepDef[],
): StepDef[] {
  return steps.filter((s) => !templates?.[s.n]?.body.trim());
}

/** Setores de primeiro nível, na ordem definida pelo admin. */
export function topSectors<S extends Pick<SectorNode, "name" | "sort" | "parent_id">>(
  sectors: readonly S[],
): S[] {
  return sortSectors(sectors.filter((s) => !s.parent_id));
}

/** Subsetores de um setor, na ordem definida pelo admin. */
export function subsectorsOf<S extends Pick<SectorNode, "name" | "sort" | "parent_id">>(
  sectors: readonly S[],
  parentId: string,
): S[] {
  return sortSectors(sectors.filter((s) => s.parent_id === parentId));
}

/** Nome para exibir: "Indústria" ou "Indústria › Metalurgia". Vazio se o setor não existe mais. */
export function sectorPath(
  sectors: readonly Pick<SectorNode, "id" | "name">[],
  sectorId: string | null | undefined,
  subsectorId?: string | null,
): string {
  const sector = sectorId ? sectors.find((s) => s.id === sectorId) : undefined;
  if (!sector) return "";
  const sub = subsectorId ? sectors.find((s) => s.id === subsectorId) : undefined;
  return sub ? `${sector.name} › ${sub.name}` : sector.name;
}

/** Opção do seletor setor › subsetor. `value` é `sectorId` ou `sectorId:subsectorId`. */
export type SectorOption = {
  value: string;
  label: string;
  /** Nome do setor (agrupa as opções no seletor). */
  group: string;
  sectorId: string;
  subsectorId: string | null;
};

export const sectorOptionValue = (sectorId: string, subsectorId?: string | null) =>
  subsectorId ? `${sectorId}:${subsectorId}` : sectorId;

/** Inverso de `sectorOptionValue`; `null` para valor vazio. */
export function parseSectorOption(
  value: string,
): { sectorId: string; subsectorId: string | null } | null {
  if (!value) return null;
  const [sectorId, subsectorId] = value.split(":");
  return { sectorId: sectorId!, subsectorId: subsectorId || null };
}

/**
 * Opções do seletor setor › subsetor: só ativos, cada setor com a opção do setor sozinho primeiro
 * e os subsetores depois. O valor atual da empresa entra mesmo inativo, para não sumir da edição.
 */
export function sectorOptions(
  sectors: readonly SectorNode[],
  current?: { sectorId: string | null | undefined; subsectorId?: string | null },
): SectorOption[] {
  const out: SectorOption[] = [];
  for (const top of topSectors(sectors)) {
    const topIsCurrent = current?.sectorId === top.id;
    const subs = subsectorsOf(sectors, top.id).filter(
      (s) => (s.active && top.active) || current?.subsectorId === s.id,
    );
    if (!top.active && !topIsCurrent && subs.length === 0) continue;
    if (top.active || topIsCurrent)
      out.push({
        value: sectorOptionValue(top.id),
        label: top.name,
        group: top.name,
        sectorId: top.id,
        subsectorId: null,
      });
    for (const sub of subs)
      out.push({
        value: sectorOptionValue(top.id, sub.id),
        label: sub.name,
        group: top.name,
        sectorId: top.id,
        subsectorId: sub.id,
      });
  }
  return out;
}

const hasBody = (t: TemplateText | undefined) => !!t?.body.trim();

/**
 * Etapas sem mensagem em "qualquer persona" nem no subsetor nem no setor dele. Serve ao aviso de
 * cadência incompleta em Empresas (a etapa cai no modelo padrão).
 */
export function cadenceGaps(
  cadences: SectorCadences | undefined,
  sectorId: string,
  subsectorId?: string | null,
): StepDef[] {
  return STEPS.filter(
    (s) =>
      !hasBody(subsectorId ? cadences?.[subsectorId]?.[""]?.[s.n] : undefined) &&
      !hasBody(cadences?.[sectorId]?.[""]?.[s.n]),
  );
}

/** Quantas etapas têm mensagem na aba da persona (`""` = qualquer persona) da cadência. */
export function personaFilled(
  cadences: SectorCadences | undefined,
  sectorId: string,
  persona: PersonaKey,
): number {
  return STEPS.filter((s) => hasBody(cadences?.[sectorId]?.[persona]?.[s.n])).length;
}
