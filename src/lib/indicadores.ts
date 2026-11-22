import { z } from "zod";
import { RANGE_LABEL, presetRange, type ChannelFilter, type RangePreset } from "./dashboard";

/** Regras de URL e resumo dos filtros da tela Indicadores (sem cálculo de métrica). */

export type IndicadoresFiltros = {
  from: string;
  to: string;
  preset: RangePreset | "periodo" | "livre";
  periodId: string | null;
  groupId: string | null;
  subgroupId: string | null;
  hunterId: string | null;
  sectorId: string | null;
  channel: ChannelFilter;
};

/** Chaves das abas do Detalhamento (os rótulos ficam no componente). */
export const DETALHE_ABAS = [
  "execucao",
  "envios",
  "ritmo",
  "funil",
  "origem",
  "conversao",
  "tendencia",
  "abastecimento",
] as const;
export type DetalheAba = (typeof DETALHE_ABAS)[number];

/** Colunas ordenáveis da Execução por hunter. */
export const EXEC_SORT_KEYS = [
  "hunter",
  "importados",
  "total",
  "noPrazo",
  "late",
  "idle",
  "started",
  "inProgress",
  "ats",
  "responses",
  "conv",
] as const;
export type ExecSortKey = (typeof EXEC_SORT_KEYS)[number];

type Intervalo = RangePreset | "periodo" | "livre";
const INTERVALOS = [...(Object.keys(RANGE_LABEL) as RangePreset[]), "periodo", "livre"] as const;

export type IndicadoresBusca = {
  intervalo?: Intervalo | undefined;
  de?: string | undefined;
  ate?: string | undefined;
  periodo?: string | undefined;
  grupo?: string | undefined;
  subgrupo?: string | undefined;
  hunter?: string | undefined;
  setor?: string | undefined;
  canal?: "linkedin" | "whatsapp" | undefined;
  detalhe?: DetalheAba | undefined;
  ordem?: ExecSortKey | undefined;
  sentido?: "asc" | "desc" | undefined;
  aberto?: string | undefined;
};

/** Chaves da URL que são filtros (as demais são aba, ordenação e hunter aberto). */
export type ChaveDeFiltro = Exclude<
  keyof IndicadoresBusca,
  "detalhe" | "ordem" | "sentido" | "aberto"
>;

const uuid = z.string().uuid();

function validUuid(v: unknown): string | undefined {
  const r = uuid.safeParse(v);
  return r.success ? r.data : undefined;
}

function oneOf<T extends string>(list: readonly T[], v: unknown): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Data AAAA-MM-DD que existe no calendário. */
function validDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

/** Lê a query string; descarta o que é inválido e o que é igual ao padrão da tela. */
export function parseIndicadoresBusca(raw: Record<string, unknown>): IndicadoresBusca {
  const get = (k: keyof IndicadoresBusca): unknown => raw[k];
  const out: IndicadoresBusca = {};

  const intervalo = oneOf(INTERVALOS, get("intervalo"));
  if (intervalo === "livre" || intervalo === "periodo") {
    const de = validDate(get("de"));
    const ate = validDate(get("ate"));
    if (de && ate && de <= ate) {
      out.intervalo = intervalo;
      out.de = de;
      out.ate = ate;
    }
  } else if (intervalo && intervalo !== "semana") {
    out.intervalo = intervalo;
  }

  const periodo = validUuid(get("periodo"));
  if (periodo) out.periodo = periodo;
  const grupo = validUuid(get("grupo"));
  if (grupo) out.grupo = grupo;
  const subgrupo = validUuid(get("subgrupo"));
  if (subgrupo) out.subgrupo = subgrupo;
  const hunter = validUuid(get("hunter"));
  if (hunter) out.hunter = hunter;
  const setor = validUuid(get("setor"));
  if (setor) out.setor = setor;

  const canal = oneOf(["linkedin", "whatsapp"] as const, get("canal"));
  if (canal) out.canal = canal;

  const detalhe = oneOf(DETALHE_ABAS, get("detalhe"));
  if (detalhe && detalhe !== "execucao") out.detalhe = detalhe;

  const ordem = oneOf(EXEC_SORT_KEYS, get("ordem"));
  if (ordem && ordem !== "total") out.ordem = ordem;

  const sentido = oneOf(["asc", "desc"] as const, get("sentido"));
  if (sentido && sentido !== (out.ordem === "hunter" ? "asc" : "desc")) out.sentido = sentido;

  const aberto = validUuid(get("aberto"));
  if (aberto) out.aberto = aberto;

  return out;
}

/** Filtros da tela a partir da URL; atalhos são recalculados em relação a `today`. */
export function filtrosDaBusca(b: IndicadoresBusca, today: string): IndicadoresFiltros {
  const base = {
    periodId: b.periodo ?? null,
    groupId: b.grupo ?? null,
    subgroupId: b.subgrupo ?? null,
    hunterId: b.hunter ?? null,
    sectorId: b.setor ?? null,
    channel: (b.canal ?? "todos") as ChannelFilter,
  };
  if ((b.intervalo === "livre" || b.intervalo === "periodo") && b.de && b.ate) {
    return { ...base, preset: b.intervalo, from: b.de, to: b.ate };
  }
  const preset: RangePreset =
    b.intervalo && b.intervalo !== "livre" && b.intervalo !== "periodo" ? b.intervalo : "semana";
  return { ...base, preset, ...presetRange(preset, today) };
}

/** Filtros da tela para a URL: todas as chaves, com `undefined` no que é padrão (apaga da URL). */
export function buscaDosFiltros(f: IndicadoresFiltros): {
  [K in ChaveDeFiltro]-?: IndicadoresBusca[K];
} {
  const fixo = f.preset === "livre" || f.preset === "periodo";
  return {
    intervalo: f.preset === "semana" ? undefined : f.preset,
    de: fixo ? f.from : undefined,
    ate: fixo ? f.to : undefined,
    periodo: f.periodId ?? undefined,
    grupo: f.groupId ?? undefined,
    subgrupo: f.subgroupId ?? undefined,
    hunter: f.hunterId ?? undefined,
    setor: f.sectorId ?? undefined,
    canal: f.channel === "todos" ? undefined : f.channel,
  };
}

export function filtrosPadrao(today: string): IndicadoresFiltros {
  return filtrosDaBusca({}, today);
}

/** Há algum filtro diferente do padrão na busca (a aba, a ordem e o hunter aberto não contam). */
export function temFiltroAtivo(b: IndicadoresBusca): boolean {
  return Boolean(
    b.intervalo || b.periodo || b.grupo || b.subgrupo || b.hunter || b.setor || b.canal,
  );
}

type Opcao = { id: string; name: string };

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;

/** Rótulos dos chips de resumo, na ordem: intervalo, período, grupo, subgrupo, hunter, setor, canal. */
export function resumoFiltros(
  f: IndicadoresFiltros,
  options: {
    periods: Opcao[];
    groups: Opcao[];
    subgroups: Opcao[];
    hunters: Opcao[];
    sectors: Opcao[];
  },
): string[] {
  const nome = (list: Opcao[], id: string, removido: string) =>
    list.find((o) => o.id === id)?.name ?? removido;
  const chips: string[] = [
    f.preset === "livre"
      ? f.from.slice(0, 4) === f.to.slice(0, 4)
        ? `${dm(f.from)} a ${dm(f.to)}`
        : `${dmy(f.from)} a ${dmy(f.to)}`
      : f.preset === "periodo"
        ? "Período inteiro"
        : RANGE_LABEL[f.preset],
  ];
  if (f.periodId) chips.push(nome(options.periods, f.periodId, "Período removido"));
  if (f.groupId) chips.push(nome(options.groups, f.groupId, "Grupo removido"));
  if (f.subgroupId) chips.push(nome(options.subgroups, f.subgroupId, "Subgrupo removido"));
  if (f.hunterId) chips.push(nome(options.hunters, f.hunterId, "Hunter removido"));
  if (f.sectorId) chips.push(nome(options.sectors, f.sectorId, "Setor removido"));
  if (f.channel === "linkedin") chips.push("Só LinkedIn");
  if (f.channel === "whatsapp") chips.push("Só WhatsApp");
  return chips;
}

/** Nome do hunter para id; nome repetido (ou vazio) fica fora do mapa. */
export function hunterIdsByName(
  rows: { hunter_id: string; hunter: string }[],
): Map<string, string> {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.hunter, (count.get(r.hunter) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const r of rows) if (r.hunter && count.get(r.hunter) === 1) out.set(r.hunter, r.hunter_id);
  return out;
}
