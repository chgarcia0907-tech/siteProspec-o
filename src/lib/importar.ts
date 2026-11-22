// Regras da tela de importação: linhas da pré-visualização e o que vai para o banco.
import {
  jobTitleFromHeadline,
  normalizeKey,
  type CompanyGender,
  type ParsedContact,
} from "./cadencia";
import type { Company } from "./empresas";
import { areaFromTitle, suggestCompany, type Area } from "./enriquecimento";
import { suggestPersona, type Persona } from "./personas";

export type ImportRow = ParsedContact & {
  key: string;
  /** Já cadastrado (ou repetido no próprio texto colado). */
  duplicate: boolean;
  /** Fora do filtro de data (antes da data escolhida ou sem data). */
  filteredOut: boolean;
  noDate: boolean;
  /** Empresa cadastrada citada no headline. */
  suggested: string | null;
  /** Empresa em texto, tirada do headline, quando não há empresa cadastrada citada. */
  companyText: { company: string; company_gender: CompanyGender } | null;
  job_title: string;
  area: Area | null;
  /** Persona sugerida pelo cargo (ou headline). Só vai ao banco se o hunter trocar na prévia. */
  persona: Persona;
};

/**
 * Linhas da pré-visualização: marca repetidos (já cadastrados ou duplicados no texto) e os fora
 * do filtro de data, e sugere empresa e área pelo headline.
 */
export function buildImportRows(
  parsed: readonly ParsedContact[],
  existingKeys: ReadonlySet<string>,
  fromDate: string,
  companies: readonly Pick<Company, "id" | "name">[],
): ImportRow[] {
  const seen = new Set<string>();
  return parsed.map((p) => {
    const key = normalizeKey(p.name, p.headline);
    const duplicate = existingKeys.has(key) || seen.has(key);
    seen.add(key);
    const noDate = fromDate !== "" && !p.connected_at;
    const filteredOut =
      noDate || (fromDate !== "" && !!p.connected_at && p.connected_at < fromDate);
    const guess = suggestCompany(p.headline, companies);
    const suggested = guess && "company_id" in guess ? guess.company_id : null;
    const companyText = guess && "company" in guess ? guess : null;
    const job_title = jobTitleFromHeadline(p.headline);
    const area = areaFromTitle(job_title, p.headline);
    const persona = suggestPersona(job_title, p.headline);
    return {
      ...p,
      key,
      duplicate,
      filteredOut,
      noDate,
      suggested,
      companyText,
      job_title,
      area,
      persona,
    };
  });
}

/** Linhas que entram na importação: novas e dentro do filtro de data. */
export const importable = (rows: readonly ImportRow[]) =>
  rows.filter((r) => !r.duplicate && !r.filteredOut);

/**
 * Contato a gravar. `companyId` é a empresa escolhida (cadastrada); sem ela, vai a empresa em
 * texto do headline, se houver.
 *
 * Toda linha leva as mesmas colunas, com valor vazio quando não há sugestão. No insert em lote,
 * o supabase-js manda NULL na coluna que falta numa linha e existe em outra; como empresa e área
 * são NOT NULL, um contato sem área no meio da lista recusava a importação inteira. Com empresa
 * cadastrada, o trigger `contacts_copy_company` troca empresa e concordância pelas do cadastro.
 *
 * `persona` é a escolha do hunter na prévia e só entra no payload quando ele trocou: sem a chave,
 * o contato fica com persona nula (= "sugerida", calculada na hora). A coluna é anulável, então
 * a chave ausente numa linha do lote (NULL) não recusa a importação.
 */
export function importPayload(r: ImportRow, companyId: string | null, persona?: Persona) {
  const companyText = companyId ? null : r.companyText;
  return {
    name: r.name,
    headline: r.headline,
    job_title: r.job_title,
    connected_at: r.connected_at,
    company_id: companyId,
    company: companyText?.company ?? "",
    company_gender: companyText?.company_gender ?? ("feminino" as CompanyGender),
    sector: r.area ?? "",
    ...(persona ? { persona } : {}),
  };
}
