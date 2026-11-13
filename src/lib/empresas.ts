// Empresas prospectadas pelo hunter e cadências por ramo de atuação (setor da empresa).
import type { Tables } from "@/integrations/supabase/types";
import { addDaysISO, weekdayISO, type CompanyGender, type StepDef } from "./cadencia";

/** Linha de `companies`, com a concordância estreitada para a união usada no app. */
export type Company = Omit<Tables<"companies">, "gender"> & { gender: CompanyGender };
export type Sector = Tables<"sectors">;
export type TemplateText = { code: string; body: string };
/** Mensagens das cadências por setor: setor → etapa → modelo. */
export type SectorTemplates = Record<string, Partial<Record<StepDef["n"], TemplateText>>>;

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
