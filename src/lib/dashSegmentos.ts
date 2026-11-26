// Segmentos da Dashboard de Outbound (Módulo 3, fase 8 do plano): onde a prospecção converte?
// Cálculo puro; roda no servidor (`dashboardSegmentos`).
//
// Base: contatos das safras **maduras** do ciclo (safra imatura ainda não teve tempo de virar AT)
// e as ATs de diagnóstico deles. Cada segmento mostra Prospect → AT (contatos com AT ÷ contatos) e
// % avanço (ATs que avançaram ÷ realizadas). Segmento com menos de `minAtsSegmento` ATs realizadas
// fica como amostra pequena: aparece em cinza, sem regra de decisão.
//
// Regra de decisão (por % avanço, limites de `dashboard_parametros`): ≥ avanco_fica_pct → fica;
// ≥ avanco_troca_pct → ajusta; abaixo → troca.
import { alocacaoDoContato, type Alocacao } from "./alocacao";
import { STEPS } from "./cadencia";
import { avancou, type VCard } from "./dashRitmo";
import { NIVEL_LABEL, nivelDoCargo } from "./enriquecimento";
import { PORTE_LABEL, isPorte } from "./empresas";
import { PERSONA_LABEL, contactPersona, type Persona } from "./personas";
import { diaSP, safraDaData, statusSafra, type Safra } from "./safras";

export type Dimensao = "setor" | "subsetor" | "porte" | "nivel" | "area" | "persona";

export const DIMENSOES: readonly { key: Dimensao; label: string }[] = [
  { key: "setor", label: "Setor da empresa" },
  { key: "subsetor", label: "Subsetor da empresa" },
  { key: "porte", label: "Porte da empresa" },
  { key: "persona", label: "Cargo (persona)" },
  { key: "nivel", label: "Nível" },
  { key: "area", label: "Área do contato" },
];
export const DIMENSAO_LABEL = Object.fromEntries(DIMENSOES.map((d) => [d.key, d.label])) as Record<
  Dimensao,
  string
>;

export type SContato = {
  id: string;
  user_id: string;
  created_at: string;
  company_id: string | null;
  job_title: string;
  headline: string;
  /** Área do contato (TI, RH...). */
  sector: string | null;
  persona: Persona | null;
};

export type SEmpresa = {
  sector_id: string | null;
  subsector_id: string | null;
  porte: string | null;
};

export type SAt = {
  id: string;
  contact_id: string | null;
  status: string;
  canal: string | null;
  resposta_etapa: number | null;
  pipedrive_stage_id: number | null;
  pipedrive_deal_id: number | null;
};

export type Taxa = { n: number; d: number };
export type Decisao = "fica" | "ajusta" | "troca";

export type Contagem = {
  contatos: number;
  /** Contatos com pelo menos uma AT. */
  comAt: number;
  ats: number;
  realizadas: number;
  avancaram: number;
};

export type Segmento = Contagem & {
  valor: string | null;
  rotulo: string;
  prospectAt: Taxa;
  avanco: Taxa;
  pequeno: boolean;
  decisao: Decisao | null;
};

export type SegmentosInput = {
  hoje: string;
  safras: readonly Safra[];
  maturacaoSemanas: number;
  minAtsSegmento: number;
  avancoFicaPct: number;
  avancoTrocaPct: number;
  contatos: readonly SContato[];
  empresas: Readonly<Record<string, SEmpresa>>;
  /** Nome de cada setor e subsetor (`sectors.id` → nome). */
  setores: Readonly<Record<string, string>>;
  ats: readonly SAt[];
  cards: Readonly<Record<number, VCard>>;
  alocacoes: readonly Alocacao[];
};

export type Segmentos = {
  /** Safras maduras usadas (número). */
  maduras: number[];
  dimensoes: { chave: Dimensao; rotulo: string; segmentos: Segmento[] }[];
  /** Contatos por empresa × empresas que chegaram à AT. */
  porEmpresa: { faixa: string; empresas: number; comAt: number }[];
  /** Contatos sem empresa cadastrada (fora da quebra por empresa). */
  semEmpresa: number;
  canais: (Contagem & { rotulo: string; avanco: Taxa })[];
  mensagens: (Contagem & { rotulo: string; avanco: Taxa })[];
  /** Todas as safras do ciclo × setor alocado: contatos e contatos com AT. */
  safraSetor: {
    setores: { id: string | null; nome: string }[];
    linhas: {
      numero: number;
      madura: boolean;
      celulas: Record<string, { contatos: number; comAt: number }>;
    }[];
  };
};

const SEM_VALOR = "__sem__";
export const FAIXAS_EMPRESA = [
  { faixa: "1 contato", ate: 1 },
  { faixa: "2 contatos", ate: 2 },
  { faixa: "3 contatos", ate: 3 },
  { faixa: "4 a 5 contatos", ate: 5 },
  { faixa: "6 ou mais", ate: Infinity },
] as const;

/** Valor do contato na dimensão (chave guardada nas versões do A/B), ou null sem informação. */
export function valorDaDimensao(
  c: SContato,
  dim: Dimensao,
  empresas: Readonly<Record<string, SEmpresa>>,
): string | null {
  const e = c.company_id ? empresas[c.company_id] : undefined;
  switch (dim) {
    case "setor":
      return e?.sector_id ?? null;
    case "subsetor":
      return e?.subsector_id ?? null;
    case "porte":
      return e?.porte && isPorte(e.porte) ? e.porte : null;
    case "persona":
      return contactPersona(c).persona;
    case "nivel":
      return nivelDoCargo(c.job_title, c.headline);
    case "area":
      return c.sector?.trim() || null;
  }
}

/** Rótulo de um valor da dimensão para a tela. */
export function rotuloDoValor(
  dim: Dimensao,
  valor: string | null,
  setores: Readonly<Record<string, string>>,
): string {
  if (valor === null) return "Não informado";
  switch (dim) {
    case "setor":
    case "subsetor":
      return setores[valor] ?? "Setor removido";
    case "porte":
      return isPorte(valor) ? PORTE_LABEL[valor] : valor;
    case "persona":
      return PERSONA_LABEL[valor as Persona] ?? valor;
    case "nivel":
      return NIVEL_LABEL[valor as keyof typeof NIVEL_LABEL] ?? valor;
    case "area":
      return valor;
  }
}

export function decisaoDoAvanco(avanco: Taxa, fica: number, troca: number): Decisao | null {
  if (!avanco.d) return null;
  const pct = (avanco.n / avanco.d) * 100;
  return pct >= fica ? "fica" : pct >= troca ? "ajusta" : "troca";
}

const vazia = (): Contagem => ({ contatos: 0, comAt: 0, ats: 0, realizadas: 0, avancaram: 0 });

/** Conta contatos e as ATs deles (ATs agrupadas por contato). */
export function contar(
  contatos: readonly { id: string }[],
  atsDe: ReadonlyMap<string, readonly SAt[]>,
  cards: SegmentosInput["cards"],
): Contagem {
  const c = vazia();
  for (const ct of contatos) {
    c.contatos++;
    const ats = atsDe.get(ct.id) ?? [];
    if (ats.length) c.comAt++;
    somarAts(c, ats, cards);
  }
  return c;
}

function somarAts(c: Contagem, ats: readonly SAt[], cards: SegmentosInput["cards"]) {
  for (const a of ats) {
    c.ats++;
    if (a.status !== "realizada") continue;
    c.realizadas++;
    if (avancou(a, cards)) c.avancaram++;
  }
}

export function computeSegmentos(input: SegmentosInput): Segmentos {
  const { hoje, cards } = input;
  const safras = [...input.safras].sort((a, b) => a.numero - b.numero);
  const safraDe = new Map(
    input.contatos.map((c) => [c.id, safraDaData(diaSP(c.created_at), safras)]),
  );
  const madura = (s: Safra) => statusSafra(s, hoje, input.maturacaoSemanas) === "madura";
  const contatosMaduros = input.contatos.filter((c) => {
    const s = safraDe.get(c.id);
    return !!s && madura(s);
  });
  const atsDe = new Map<string, SAt[]>();
  for (const a of input.ats) {
    if (!a.contact_id) continue;
    const l = atsDe.get(a.contact_id) ?? [];
    l.push(a);
    atsDe.set(a.contact_id, l);
  }

  // Quebra por dimensão.
  const dimensoes = DIMENSOES.map(({ key, label }) => {
    const grupos = new Map<string, SContato[]>();
    for (const c of contatosMaduros) {
      const v = valorDaDimensao(c, key, input.empresas) ?? SEM_VALOR;
      const l = grupos.get(v) ?? [];
      l.push(c);
      grupos.set(v, l);
    }
    const segmentos: Segmento[] = [...grupos.entries()].map(([v, cs]) => {
      const valor = v === SEM_VALOR ? null : v;
      const n = contar(cs, atsDe, cards);
      const avanco = { n: n.avancaram, d: n.realizadas };
      const pequeno = valor === null || n.realizadas < input.minAtsSegmento;
      return {
        ...n,
        valor,
        rotulo: rotuloDoValor(key, valor, input.setores),
        prospectAt: { n: n.comAt, d: n.contatos },
        avanco,
        pequeno,
        decisao: pequeno
          ? null
          : decisaoDoAvanco(avanco, input.avancoFicaPct, input.avancoTrocaPct),
      };
    });
    // Amostras suficientes primeiro, pela % avanço; depois as pequenas por volume; "Não
    // informado" no fim.
    const pct = (t: Taxa) => (t.d ? t.n / t.d : -1);
    segmentos.sort(
      (a, b) =>
        Number(a.valor === null) - Number(b.valor === null) ||
        Number(a.pequeno) - Number(b.pequeno) ||
        (a.pequeno ? 0 : pct(b.avanco) - pct(a.avanco)) ||
        b.contatos - a.contatos ||
        a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    );
    return { chave: key, rotulo: label, segmentos };
  });

  // Contatos por empresa × empresa chegou à AT.
  const porEmpresaMap = new Map<string, { contatos: number; comAt: boolean }>();
  let semEmpresa = 0;
  for (const c of contatosMaduros) {
    if (!c.company_id) {
      semEmpresa++;
      continue;
    }
    const e = porEmpresaMap.get(c.company_id) ?? { contatos: 0, comAt: false };
    e.contatos++;
    if ((atsDe.get(c.id) ?? []).length) e.comAt = true;
    porEmpresaMap.set(c.company_id, e);
  }
  const porEmpresa = FAIXAS_EMPRESA.map(({ faixa }) => ({ faixa, empresas: 0, comAt: 0 }));
  for (const e of porEmpresaMap.values()) {
    const i = FAIXAS_EMPRESA.findIndex((f) => e.contatos <= f.ate);
    porEmpresa[i]!.empresas++;
    if (e.comAt) porEmpresa[i]!.comAt++;
  }

  // Canal da AT e mensagem que gerou a resposta (ATs dos contatos maduros).
  const atsMaduras = contatosMaduros.flatMap((c) => atsDe.get(c.id) ?? []);
  const agrupar = (chave: (a: SAt) => string, ordem: (k: string) => number) => {
    const m = new Map<string, SAt[]>();
    for (const a of atsMaduras) {
      const k = chave(a);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()]
      .sort(([a], [b]) => ordem(a) - ordem(b) || a.localeCompare(b, "pt-BR"))
      .map(([rotulo, ats]) => {
        const c = vazia();
        somarAts(c, ats, cards);
        return { ...c, contatos: 0, comAt: 0, rotulo, avanco: { n: c.avancaram, d: c.realizadas } };
      });
  };
  const canais = agrupar(
    (a) => a.canal?.trim() || "Não informado",
    (k) => (k === "Não informado" ? 1 : 0),
  );
  const rotuloEtapa = (e: number | null) =>
    e === null
      ? "Não informada"
      : e === 0
        ? "Outro canal"
        : (STEPS.find((s) => s.n === e)?.label ?? `Etapa ${e}`);
  const ordemEtapa = new Map(
    [...STEPS.map((s) => s.label), "Outro canal", "Não informada"].map((r, i) => [r, i]),
  );
  const mensagens = agrupar(
    (a) => rotuloEtapa(a.resposta_etapa),
    (k) => ordemEtapa.get(k) ?? 99,
  );

  // Safra × setor alocado (todas as safras do ciclo).
  const setoresUsados = new Map<string | null, string>();
  const linhas = safras.map((s) => {
    const celulas: Record<string, { contatos: number; comAt: number }> = {};
    for (const c of input.contatos) {
      if (safraDe.get(c.id)?.id !== s.id) continue;
      const setor = alocacaoDoContato(c, s.id, input.alocacoes)?.sector_id ?? null;
      setoresUsados.set(setor, setor ? (input.setores[setor] ?? "Setor removido") : "Sem alocação");
      const k = setor ?? SEM_VALOR;
      const cel = (celulas[k] ??= { contatos: 0, comAt: 0 });
      cel.contatos++;
      if ((atsDe.get(c.id) ?? []).length) cel.comAt++;
    }
    return { numero: s.numero, madura: madura(s), celulas };
  });
  const setoresSafra = [...setoresUsados.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort(
      (a, b) =>
        Number(a.id === null) - Number(b.id === null) || a.nome.localeCompare(b.nome, "pt-BR"),
    );

  return {
    maduras: safras.filter(madura).map((s) => s.numero),
    dimensoes,
    porEmpresa,
    semEmpresa,
    canais,
    mensagens,
    safraSetor: { setores: setoresSafra, linhas },
  };
}

/**
 * Taxas da base inteira (todos os segmentos somados, "Não informado" incluído) em %, para as
 * linhas de média da dispersão. Null sem base.
 */
export function mediasDaDimensao(segmentos: readonly Segmento[]): {
  prospectAt: number | null;
  avanco: number | null;
} {
  const soma = (f: (s: Segmento) => number) => segmentos.reduce((t, s) => t + f(s), 0);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
  return {
    prospectAt: pct(
      soma((s) => s.comAt),
      soma((s) => s.contatos),
    ),
    avanco: pct(
      soma((s) => s.avancaram),
      soma((s) => s.realizadas),
    ),
  };
}

/** Chave da célula de safra × setor (setor nulo = "Sem alocação"). */
export const chaveSetor = (id: string | null) => id ?? SEM_VALOR;
