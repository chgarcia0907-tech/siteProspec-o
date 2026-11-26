// Visão geral da Dashboard de Outbound (Módulo 1, fase 6 do plano): estamos no ritmo para bater a
// meta do ciclo? Cálculo puro; roda no servidor (`dashboardVisao`).
//
// Bases de tempo:
// - ATs que avançaram: semana em que o card entrou na AT de Aprofundamento (ou além) ou foi ganho,
//   pelo histórico da cópia do Pipedrive. AT sem card na cópia não tem data de avanço: conta nos
//   totais por safra (pela etapa atual), fora da série semanal.
// - ATs marcadas: semana de `registrada_em` (como o placar). Realizadas: semana em que a AT
//   aconteceu (`agendada_atual`).
// - Fatores da árvore: última safra madura contra a anterior (contatos: safra da semana contra a
//   anterior). Safras imaturas ficam fora das comparações.
import { addDaysISO } from "./cadencia";
import { ETAPAS_AVANCO } from "./pipedrive";
import { diaSP, fimDaSemana, safraDaData, statusSafra, type Safra } from "./safras";

export type VAt = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  registrada_em: string;
  agendada_atual: string;
  status: string;
  pipedrive_stage_id: number | null;
  pipedrive_deal_id: number | null;
};

export type VCard = {
  status: string;
  won_time: string | null;
  etapas: readonly { stage_id: number; entrou_em: string }[];
};

export type VContato = { id: string; user_id: string; created_at: string };

export type VisaoInput = {
  hoje: string;
  safras: readonly Safra[];
  maturacaoSemanas: number;
  contatos: readonly VContato[];
  ats: readonly VAt[];
  /** Cópia do Pipedrive por `pipedrive_deal_id`. */
  cards: Readonly<Record<number, VCard>>;
  /** Meta de ATs que avançaram no ciclo (`ciclo_metas`), ou null. */
  metaAvancaram: number | null;
  /** Meta semanal de ATs marcadas da equipe (soma das metas dos hunters), ou null. */
  metaSemanalAts: number | null;
};

export type Taxa = { n: number; d: number };
export type Fator = {
  chave: "contatos" | "prospectAt" | "naoRealizadas" | "avanco";
  rotulo: string;
  /** Valor atual: contagem (contatos) ou taxa. */
  atual: Taxa | number | null;
  anterior: Taxa | number | null;
  /** Safras comparadas (número), na ordem atual → anterior. */
  safras: [number | null, number | null];
  /** Variação em pontos (taxas) ou % (contagem); null sem base. */
  variacao: number | null;
  /** Subir é bom? (% não realizadas: cair é bom). */
  subirEhBom: boolean;
};

export type SemanaRitmo = {
  semana: string;
  numero: number;
  marcadas: number;
  realizadas: number;
  avancaram: number;
  /** ATs marcadas na semana, por safra de origem do contato ("fora" = sem contato ou sem safra). */
  porSafra: Record<string, number>;
  futura: boolean;
};

export type Visao = {
  semanaAtual: string | null;
  central: {
    semana: number;
    /** Média por semana das semanas fechadas do ciclo. */
    mediaCiclo: number | null;
    totalCiclo: number;
    meta: number | null;
    /** Esperado até agora pela meta (proporcional às semanas já passadas). */
    esperado: number | null;
    /** Sem data de avanço (card fora da cópia), contadas pela etapa atual. */
    semData: number;
  };
  fatores: Fator[];
  ritmo: SemanaRitmo[];
  metaSemanalAts: number | null;
  metaSemanalAvancaram: number | null;
  funil: { rotulo: string; n: number }[];
};

const pct = (t: Taxa) => (t.d ? (t.n / t.d) * 100 : null);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Dia (SP) em que a AT avançou, pelo histórico do card; null sem card na cópia ou sem avanço. */
export function diaDoAvanco(
  at: Pick<VAt, "pipedrive_deal_id">,
  cards: VisaoInput["cards"],
): string | null {
  const card = at.pipedrive_deal_id ? cards[at.pipedrive_deal_id] : undefined;
  if (!card) return null;
  const etapa = [...card.etapas]
    .sort((a, b) => a.entrou_em.localeCompare(b.entrou_em))
    .find((e) => ETAPAS_AVANCO.has(e.stage_id));
  const datas = [etapa?.entrou_em, card.status === "won" ? card.won_time : null].filter(
    (d): d is string => !!d,
  );
  return datas.length ? diaSP(datas.sort()[0]!) : null;
}

/** A AT avançou (com ou sem data): histórico da cópia, senão a etapa atual. */
export function avancou(
  at: Pick<VAt, "pipedrive_deal_id" | "pipedrive_stage_id">,
  cards: VisaoInput["cards"],
): boolean {
  const card = at.pipedrive_deal_id ? cards[at.pipedrive_deal_id] : undefined;
  if (card) return card.status === "won" || card.etapas.some((e) => ETAPAS_AVANCO.has(e.stage_id));
  return at.pipedrive_stage_id !== null && ETAPAS_AVANCO.has(at.pipedrive_stage_id);
}

/** Chegou à proposta (Proposta Agendada ou além) ou foi ganho. */
function chegouProposta(at: VAt, cards: VisaoInput["cards"]): boolean {
  const card = at.pipedrive_deal_id ? cards[at.pipedrive_deal_id] : undefined;
  const alem = (s: number) => s === 34 || s === 35 || s === 36;
  if (card) return card.status === "won" || card.etapas.some((e) => alem(e.stage_id));
  return at.pipedrive_stage_id !== null && alem(at.pipedrive_stage_id);
}

/** Não realizada ao fim da maturação: ainda agendada com a data passada, no-show ou cancelada. */
export function naoRealizada(at: Pick<VAt, "status" | "agendada_atual">, hoje: string): boolean {
  if (at.status === "no_show" || at.status === "cancelada") return true;
  return at.status === "agendada" && diaSP(at.agendada_atual) < hoje;
}

function variacao(atual: Taxa | number | null, anterior: Taxa | number | null): number | null {
  if (atual === null || anterior === null) return null;
  if (typeof atual === "number" && typeof anterior === "number")
    return anterior ? r1(((atual - anterior) / anterior) * 100) : null;
  const a = pct(atual as Taxa);
  const b = pct(anterior as Taxa);
  return a === null || b === null ? null : r1(a - b);
}

export function computeVisao(input: VisaoInput): Visao {
  const { hoje, cards } = input;
  const safras = [...input.safras].sort((a, b) => a.numero - b.numero);
  const semanaAtual = safraDaData(hoje, safras)?.inicio ?? null;
  const safraDoContato = new Map(
    input.contatos.map((c) => [c.id, safraDaData(diaSP(c.created_at), safras)]),
  );
  const safraDaAt = (a: VAt) => (a.contact_id ? (safraDoContato.get(a.contact_id) ?? null) : null);

  // Por safra: contatos, ATs, realizadas, não realizadas, avançaram.
  const porSafra = safras.map((s) => {
    const ats = input.ats.filter((a) => safraDaAt(a)?.id === s.id);
    return {
      safra: s,
      madura: statusSafra(s, hoje, input.maturacaoSemanas) === "madura",
      contatos: input.contatos.filter((c) => safraDoContato.get(c.id)?.id === s.id).length,
      ats: ats.length,
      realizadas: ats.filter((a) => a.status === "realizada").length,
      naoRealizadas: ats.filter((a) => naoRealizada(a, hoje)).length,
      avancaram: ats.filter((a) => a.status === "realizada" && avancou(a, cards)).length,
    };
  });
  const maduras = porSafra.filter((x) => x.madura);
  const [m0, m1] = [maduras.at(-1) ?? null, maduras.at(-2) ?? null];
  const atualIdx = porSafra.findIndex((x) => x.safra.inicio === semanaAtual);
  const cAtual =
    atualIdx >= 0
      ? porSafra[atualIdx]!
      : (porSafra.filter((x) => x.safra.inicio <= hoje).at(-1) ?? null);
  const cAnterior = cAtual ? (porSafra[porSafra.indexOf(cAtual) - 1] ?? null) : null;

  const fator = (
    chave: Fator["chave"],
    rotulo: string,
    f: (x: (typeof porSafra)[number]) => Taxa,
    subirEhBom = true,
  ): Fator => {
    const atual = m0 ? f(m0) : null;
    const anterior = m1 ? f(m1) : null;
    return {
      chave,
      rotulo,
      atual,
      anterior,
      safras: [m0?.safra.numero ?? null, m1?.safra.numero ?? null],
      variacao: variacao(atual, anterior),
      subirEhBom,
    };
  };
  const fatores: Fator[] = [
    {
      chave: "contatos",
      rotulo: "Contatos prospectados",
      atual: cAtual?.contatos ?? null,
      anterior: cAnterior?.contatos ?? null,
      safras: [cAtual?.safra.numero ?? null, cAnterior?.safra.numero ?? null],
      variacao: variacao(cAtual?.contatos ?? null, cAnterior?.contatos ?? null),
      subirEhBom: true,
    },
    fator("prospectAt", "Prospect → AT", (x) => ({ n: x.ats, d: x.contatos })),
    fator("naoRealizadas", "% não realizadas", (x) => ({ n: x.naoRealizadas, d: x.ats }), false),
    fator("avanco", "% avanço", (x) => ({ n: x.avancaram, d: x.realizadas })),
  ];

  // Ritmo semanal: semanas das safras do ciclo.
  const avancos = input.ats
    .map((a) =>
      a.status === "realizada" || a.status === "agendada" ? diaDoAvanco(a, cards) : null,
    )
    .filter((d): d is string => !!d);
  const ritmo: SemanaRitmo[] = safras.map((s) => {
    const fim = fimDaSemana(s);
    const dentro = (d: string) => d >= s.inicio && d <= fim;
    const marcadas = input.ats.filter((a) => dentro(diaSP(a.registrada_em)));
    const porSafraSemana: Record<string, number> = {};
    for (const a of marcadas) {
      const origem = safraDaAt(a);
      const k = origem ? String(origem.numero) : "fora";
      porSafraSemana[k] = (porSafraSemana[k] ?? 0) + 1;
    }
    return {
      semana: s.inicio,
      numero: s.numero,
      marcadas: marcadas.length,
      realizadas: input.ats.filter(
        (a) => a.status === "realizada" && dentro(diaSP(a.agendada_atual)),
      ).length,
      avancaram: avancos.filter(dentro).length,
      porSafra: porSafraSemana,
      futura: s.inicio > hoje,
    };
  });

  // Cartão central.
  const atual = ritmo.find((w) => w.semana === semanaAtual);
  const fechadas = ritmo.filter((w) => addDaysISO(w.semana, 6) < hoje);
  const totalCiclo = ritmo.reduce((t, w) => t + w.avancaram, 0);
  const semData = input.ats.filter(
    (a) => a.status === "realizada" && avancou(a, cards) && !diaDoAvanco(a, cards),
  ).length;
  const passadas = ritmo.filter((w) => w.semana <= hoje).length;
  const meta = input.metaAvancaram;

  // Funil do ciclo: contatos das safras → ATs deles → realizadas → avançaram → proposta → venda.
  const atsCiclo = input.ats.filter((a) => safraDaAt(a));
  const realizadasCiclo = atsCiclo.filter((a) => a.status === "realizada");
  const funil = [
    { rotulo: "Contatos", n: porSafra.reduce((t, x) => t + x.contatos, 0) },
    { rotulo: "ATs marcadas", n: atsCiclo.length },
    { rotulo: "Realizadas", n: realizadasCiclo.length },
    { rotulo: "Avançaram", n: realizadasCiclo.filter((a) => avancou(a, cards)).length },
    { rotulo: "Proposta", n: realizadasCiclo.filter((a) => chegouProposta(a, cards)).length },
    {
      rotulo: "Venda",
      n: realizadasCiclo.filter(
        (a) => a.pipedrive_deal_id !== null && cards[a.pipedrive_deal_id]?.status === "won",
      ).length,
    },
  ];

  return {
    semanaAtual,
    central: {
      semana: atual?.avancaram ?? 0,
      mediaCiclo: fechadas.length
        ? r1(fechadas.reduce((t, w) => t + w.avancaram, 0) / fechadas.length)
        : null,
      totalCiclo,
      meta,
      esperado: meta !== null && safras.length ? r1((meta * passadas) / safras.length) : null,
      semData,
    },
    fatores,
    ritmo,
    metaSemanalAts: input.metaSemanalAts,
    metaSemanalAvancaram: meta !== null && safras.length ? r1(meta / safras.length) : null,
    funil,
  };
}
