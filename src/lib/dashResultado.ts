// Resultado e curvas de safra da Dashboard de Outbound (Módulo 5, fase 9 do plano): quanto a
// prospecção vira de negócio, e quando cada safra pode ser comparada. Cálculo puro; roda no
// servidor (`dashboardResultado` e `dashboardSafrasCurvas`).
//
// - Pipeline e conversão: cards (cópia do Pipedrive) das ATs de diagnóstico do ciclo. Venda = card
//   ganho; ticket = valor do card ganho; dias até fechar = da data da AT até o ganho.
// - Valor esperado por AT realizada = valor ganho ÷ ATs realizadas, por porte e por setor.
// - Higiene: quanto da base tem o dado de que as métricas dependem.
// - Curvas de safra: % acumulada dos contatos da safra com AT, semana a semana desde o início.
// - Dias prospecção → AT: do cadastro do contato ao registro da primeira AT; P90 sugere a janela
//   de maturação (a safra amadurece no começo da semana N + 1 + maturação).
import { addDaysISO } from "./cadencia";
import { avancou } from "./dashRitmo";
import { valorDaDimensao, type SContato, type SEmpresa } from "./dashSegmentos";
import { ETAPAS_FUNIL } from "./dashRealizacao";
import { PORTES, PORTE_LABEL, isPorte } from "./empresas";
import { NOME_ETAPA } from "./pipedrive";
import { diaSP, fimDaSemana, safraDaData, type Safra } from "./safras";

export type ZAt = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  registrada_em: string;
  agendada_atual: string;
  status: string;
  resposta_etapa: number | null;
  pipedrive_stage_id: number | null;
  pipedrive_deal_id: number | null;
};

export type ZCard = {
  status: string;
  stage_id: number | null;
  valor: number | null;
  porte: string | null;
  won_time: string | null;
  etapas: readonly { stage_id: number; entrou_em: string }[];
};

export type ResultadoInput = {
  hoje: string;
  safras: readonly Safra[];
  minAtsSegmento: number;
  contatos: readonly SContato[];
  empresas: Readonly<Record<string, SEmpresa>>;
  setores: Readonly<Record<string, string>>;
  ats: readonly ZAt[];
  cards: Readonly<Record<number, ZCard>>;
};

export type Taxa = { n: number; d: number };

export type LinhaValor = {
  chave: string | null;
  rotulo: string;
  realizadas: number;
  vendas: number;
  valorGanho: number;
  /** Ticket médio dos ganhos com valor; null sem ganho com valor. */
  ticket: number | null;
  /** Mediana de dias da AT ao ganho. */
  diasAteFechar: number | null;
  /** Valor ganho ÷ ATs realizadas. */
  valorPorAt: number | null;
  pequeno: boolean;
};

export type Resultado = {
  pipeline: { stageId: number; nome: string; cards: number; valor: number; semValor: number }[];
  ganhos: { cards: number; valor: number };
  perdidos: number;
  conversao: {
    realizadas: number;
    avancaram: number;
    proposta: number;
    vendas: number;
    ticket: number | null;
    diasAteFechar: number | null;
    valorPorAt: number | null;
  };
  porPorte: LinhaValor[];
  porSetor: LinhaValor[];
  higiene: { chave: string; rotulo: string; taxa: Taxa }[];
};

const DIA_MS = 86_400_000;
const dias = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Percentil pelo método do posto mais próximo (o valor de pelo menos p% da amostra). */
export function percentil(xs: readonly number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)]!;
}

/** ATs do ciclo: contato numa safra do ciclo ou data da AT nas semanas do ciclo. */
export function atsDoRecorte<T extends Pick<ZAt, "contact_id" | "agendada_atual">>(
  ats: readonly T[],
  safras: readonly Safra[],
  safraDoContato: ReadonlyMap<string, Safra | null>,
): T[] {
  const ordenadas = [...safras].sort((a, b) => a.numero - b.numero);
  const inicio = ordenadas[0]?.inicio;
  const fim = ordenadas.length ? fimDaSemana(ordenadas.at(-1)!) : null;
  return ats.filter((a) => {
    const d = diaSP(a.agendada_atual);
    return (
      (!!inicio && !!fim && d >= inicio && d <= fim) ||
      (a.contact_id !== null && !!safraDoContato.get(a.contact_id))
    );
  });
}

export function computeResultado(input: ResultadoInput): Resultado {
  const { cards } = input;
  const safras = [...input.safras].sort((a, b) => a.numero - b.numero);
  const safraDe = new Map(
    input.contatos.map((c) => [c.id, safraDaData(diaSP(c.created_at), safras)]),
  );
  const contatoDe = new Map(input.contatos.map((c) => [c.id, c]));
  const ats = atsDoRecorte(input.ats, safras, safraDe);
  const cardDe = (a: ZAt) => (a.pipedrive_deal_id ? cards[a.pipedrive_deal_id] : undefined);
  const ganho = (a: ZAt) => cardDe(a)?.status === "won";

  // Pipeline: cards abertos das ATs do ciclo, por etapa atual (cada card uma vez).
  const deals = [...new Set(ats.map((a) => a.pipedrive_deal_id).filter((d) => d !== null))];
  const doCiclo = deals.map((d) => cards[d!]).filter((c): c is ZCard => !!c);
  const pipeline = ETAPAS_FUNIL.map((stageId) => {
    const daEtapa = doCiclo.filter((c) => c.status === "open" && c.stage_id === stageId);
    return {
      stageId,
      nome: NOME_ETAPA[stageId] ?? `Etapa ${stageId}`,
      cards: daEtapa.length,
      valor: r2(daEtapa.reduce((t, c) => t + (c.valor ?? 0), 0)),
      semValor: daEtapa.filter((c) => !c.valor).length,
    };
  });
  const ganhos = doCiclo.filter((c) => c.status === "won");

  // Linha de valor de um grupo de ATs realizadas.
  const linha = (chave: string | null, rotulo: string, grupo: readonly ZAt[]): LinhaValor => {
    const vendas = grupo.filter(ganho);
    const comValor = vendas.map((a) => cardDe(a)!.valor).filter((v): v is number => !!v);
    const valorGanho = r2(comValor.reduce((t, v) => t + v, 0));
    const ate = vendas
      .map((a) => cardDe(a)!.won_time)
      .map((w, i) => (w ? dias(diaSP(vendas[i]!.agendada_atual), diaSP(w)) : null))
      .filter((d): d is number => d !== null && d >= 0);
    return {
      chave,
      rotulo,
      realizadas: grupo.length,
      vendas: vendas.length,
      valorGanho,
      ticket: comValor.length ? r2(valorGanho / comValor.length) : null,
      diasAteFechar: mediana(ate),
      valorPorAt: grupo.length ? r2(valorGanho / grupo.length) : null,
      pequeno: grupo.length < input.minAtsSegmento,
    };
  };
  const realizadas = ats.filter((a) => a.status === "realizada");
  const geral = linha(null, "Todas", realizadas);
  const alem = (s: number) => s === 34 || s === 35 || s === 36;

  // Por porte: o do card; sem ele, o da empresa do contato.
  const porteDe = (a: ZAt): string | null => {
    const doCard = cardDe(a)?.porte;
    if (doCard && isPorte(doCard)) return doCard;
    const c = a.contact_id ? contatoDe.get(a.contact_id) : undefined;
    return c ? valorDaDimensao(c, "porte", input.empresas) : null;
  };
  const agrupar = (chave: (a: ZAt) => string | null) => {
    const m = new Map<string | null, ZAt[]>();
    for (const a of realizadas) {
      const k = chave(a);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  };
  const porPorteMap = agrupar(porteDe);
  const porPorte = [
    ...PORTES.filter((p) => porPorteMap.has(p.key)).map((p) =>
      linha(p.key, PORTE_LABEL[p.key], porPorteMap.get(p.key)!),
    ),
    ...(porPorteMap.has(null) ? [linha(null, "Não informado", porPorteMap.get(null)!)] : []),
  ];
  const porSetorMap = agrupar((a) => {
    const c = a.contact_id ? contatoDe.get(a.contact_id) : undefined;
    return c ? valorDaDimensao(c, "setor", input.empresas) : null;
  });
  const porSetor = [...porSetorMap.entries()]
    .map(([k, g]) =>
      linha(k, k === null ? "Não informado" : (input.setores[k] ?? "Setor removido"), g),
    )
    .sort(
      (a, b) =>
        Number(a.chave === null) - Number(b.chave === null) ||
        Number(a.pequeno) - Number(b.pequeno) ||
        (b.valorPorAt ?? -1) - (a.valorPorAt ?? -1) ||
        a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    );

  // Higiene dos dados.
  const contatosCiclo = input.contatos.filter((c) => !!safraDe.get(c.id));
  const comCard = ats.filter((a) => !!cardDe(a));
  const higiene = [
    {
      chave: "at_contato",
      rotulo: "ATs ligadas a um contato",
      taxa: { n: ats.filter((a) => a.contact_id !== null).length, d: ats.length },
    },
    {
      chave: "at_card",
      rotulo: "ATs com card na cópia do Pipedrive",
      taxa: { n: comCard.length, d: ats.length },
    },
    {
      chave: "at_mensagem",
      rotulo: "ATs com a mensagem de origem",
      taxa: { n: ats.filter((a) => a.resposta_etapa !== null).length, d: ats.length },
    },
    {
      chave: "card_porte",
      rotulo: "Cards com porte",
      taxa: { n: comCard.filter((a) => porteDe(a) !== null).length, d: comCard.length },
    },
    {
      chave: "ganho_valor",
      rotulo: "Ganhos com valor",
      taxa: { n: ganhos.filter((c) => !!c.valor).length, d: ganhos.length },
    },
    {
      chave: "contato_empresa",
      rotulo: "Contatos com empresa cadastrada",
      taxa: { n: contatosCiclo.filter((c) => !!c.company_id).length, d: contatosCiclo.length },
    },
    {
      chave: "contato_cargo",
      rotulo: "Contatos com cargo",
      taxa: {
        n: contatosCiclo.filter((c) => !!c.job_title.trim()).length,
        d: contatosCiclo.length,
      },
    },
  ];

  return {
    pipeline,
    ganhos: { cards: ganhos.length, valor: r2(ganhos.reduce((t, c) => t + (c.valor ?? 0), 0)) },
    perdidos: doCiclo.filter((c) => c.status === "lost").length,
    conversao: {
      realizadas: realizadas.length,
      avancaram: realizadas.filter((a) => avancou(a, cards)).length,
      proposta: realizadas.filter((a) => {
        const c = cardDe(a);
        if (c) return c.status === "won" || c.etapas.some((e) => alem(e.stage_id));
        return a.pipedrive_stage_id !== null && alem(a.pipedrive_stage_id);
      }).length,
      vendas: geral.vendas,
      ticket: geral.ticket,
      diasAteFechar: geral.diasAteFechar,
      valorPorAt: geral.valorPorAt,
    },
    porPorte,
    porSetor,
    higiene,
  };
}

/* ---------------------------- Indicadores por ciclo --------------------------- */

export type CicloInfo = {
  id: string;
  nome: string;
  inicio: string;
  /** Último dia (encerramento), ou null se ativo. */
  fim: string | null;
  ativo: boolean;
  membros: readonly string[];
};

export type LinhaCiclo = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  ativo: boolean;
  contatos: number;
  ats: number;
  realizadas: number;
  avancaram: number;
  vendas: number;
  valorGanho: number;
  prospectAt: Taxa;
};

/**
 * Indicadores de cada ciclo da plataforma pelas datas dele, só com os membros: contatos
 * cadastrados, ATs registradas (e, delas, realizadas, avançaram e vendas) no intervalo.
 */
export function computeCiclos(input: {
  hoje: string;
  ciclos: readonly CicloInfo[];
  contatos: readonly { user_id: string; created_at: string }[];
  ats: readonly ZAt[];
  cards: Readonly<Record<number, ZCard>>;
}): LinhaCiclo[] {
  return [...input.ciclos]
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((c) => {
      const fim = c.fim ?? input.hoje;
      const membros = new Set(c.membros);
      const dentro = (ts: string) => {
        const d = diaSP(ts);
        return d >= c.inicio && d <= fim;
      };
      const contatos = input.contatos.filter(
        (x) => membros.has(x.user_id) && dentro(x.created_at),
      ).length;
      const ats = input.ats.filter(
        (a) => a.user_id !== null && membros.has(a.user_id) && dentro(a.registrada_em),
      );
      const realizadas = ats.filter((a) => a.status === "realizada");
      const vendas = realizadas.filter(
        (a) => a.pipedrive_deal_id !== null && input.cards[a.pipedrive_deal_id]?.status === "won",
      );
      return {
        id: c.id,
        nome: c.nome,
        inicio: c.inicio,
        fim,
        ativo: c.ativo,
        contatos,
        ats: ats.length,
        realizadas: realizadas.length,
        avancaram: realizadas.filter((a) => avancou(a, input.cards)).length,
        vendas: vendas.length,
        valorGanho: r2(
          vendas.reduce((t, a) => t + (input.cards[a.pipedrive_deal_id!]?.valor ?? 0), 0),
        ),
        prospectAt: { n: ats.length, d: contatos },
      };
    });
}

/* ------------------------------ Curvas de safra ------------------------------ */

export type CurvasSafra = {
  /** Uma curva por safra: % acumulada dos contatos com AT ao fim de cada semana desde o início. */
  curvas: {
    numero: number;
    contatos: number;
    pontos: { semana: number; pct: number; comAt: number; parcial: boolean }[];
  }[];
  /** Safra × semana do calendário: ATs registradas (de contatos da safra) em cada semana. */
  mapa: { semanas: string[]; linhas: { numero: number; ats: number[] }[] };
  /** Dias do cadastro do contato à primeira AT. */
  distribuicao: {
    faixas: { faixa: string; n: number }[];
    total: number;
    p50: number | null;
    p90: number | null;
    /** Maturação (semanas) que cobre o P90 para o contato cadastrado na sexta. */
    maturacaoSugerida: number | null;
  };
};

export const FAIXAS_DIAS = [
  { faixa: "Mesma semana (0 a 6 dias)", ate: 6 },
  { faixa: "2ª semana (7 a 13)", ate: 13 },
  { faixa: "3ª semana (14 a 20)", ate: 20 },
  { faixa: "4ª semana (21 a 27)", ate: 27 },
  { faixa: "5ª e 6ª semanas (28 a 41)", ate: 41 },
  { faixa: "Mais de 6 semanas", ate: Infinity },
] as const;

/**
 * Maturação (semanas) que cobre `p90` dias para o contato cadastrado na sexta (dia 4 da safra; os
 * hunters cadastram em dias úteis): a safra amadurece na segunda da semana N + 1 + maturação, o
 * dia 7 × (1 + maturação) contado da segunda da safra, então 4 + p90 ≤ 7 × (1 + maturação) − 1.
 */
export function maturacaoParaP90(p90: number): number {
  return Math.max(0, Math.ceil((p90 - 2) / 7));
}

export function computeCurvas(input: {
  hoje: string;
  safras: readonly Safra[];
  contatos: readonly { id: string; created_at: string }[];
  ats: readonly Pick<ZAt, "contact_id" | "registrada_em">[];
}): CurvasSafra {
  const safras = [...input.safras].sort((a, b) => a.numero - b.numero);
  const primeiraAt = new Map<string, string>();
  for (const a of input.ats) {
    if (!a.contact_id) continue;
    const d = diaSP(a.registrada_em);
    const atual = primeiraAt.get(a.contact_id);
    if (!atual || d < atual) primeiraAt.set(a.contact_id, d);
  }
  const daSafra = new Map<number, { id: string; criado: string }[]>(
    safras.map((s) => [s.numero, []]),
  );
  for (const c of input.contatos) {
    const s = safraDaData(diaSP(c.created_at), safras);
    if (s) daSafra.get(s.numero)!.push({ id: c.id, criado: diaSP(c.created_at) });
  }

  const curvas = safras
    .filter((s) => s.inicio <= input.hoje)
    .map((s) => {
      const cs = daSafra.get(s.numero)!;
      const pontos: CurvasSafra["curvas"][number]["pontos"] = [];
      for (let k = 0; addDaysISO(s.inicio, 7 * k) <= input.hoje; k++) {
        const fimSemana = addDaysISO(s.inicio, 7 * k + 6);
        const comAt = cs.filter((c) => {
          const d = primeiraAt.get(c.id);
          return !!d && d <= fimSemana;
        }).length;
        pontos.push({
          semana: k,
          comAt,
          pct: cs.length ? Math.round((comAt / cs.length) * 1000) / 10 : 0,
          parcial: fimSemana >= input.hoje,
        });
      }
      return { numero: s.numero, contatos: cs.length, pontos };
    });

  // Mapa: semanas do calendário da primeira safra até a semana de hoje.
  const semanas: string[] = [];
  if (safras.length)
    for (let w = safras[0]!.inicio; w <= input.hoje; w = addDaysISO(w, 7)) semanas.push(w);
  const safraDoContato = new Map<string, number>();
  for (const [numero, cs] of daSafra) for (const c of cs) safraDoContato.set(c.id, numero);
  const linhas = safras
    .filter((s) => s.inicio <= input.hoje)
    .map((s) => ({ numero: s.numero, ats: semanas.map(() => 0) }));
  for (const a of input.ats) {
    const numero = a.contact_id ? safraDoContato.get(a.contact_id) : undefined;
    if (numero === undefined) continue;
    const d = diaSP(a.registrada_em);
    const i = semanas.findIndex((w) => d >= w && d <= addDaysISO(w, 6));
    const l = linhas.find((x) => x.numero === numero);
    if (i >= 0 && l) l.ats[i]!++;
  }

  // Distribuição de dias do cadastro à primeira AT (contatos das safras).
  const valores: number[] = [];
  for (const cs of daSafra.values())
    for (const c of cs) {
      const d = primeiraAt.get(c.id);
      if (d) valores.push(Math.max(0, dias(c.criado, d)));
    }
  const faixas = FAIXAS_DIAS.map(({ faixa }) => ({ faixa, n: 0 }));
  for (const v of valores) faixas[FAIXAS_DIAS.findIndex((f) => v <= f.ate)]!.n++;
  const p90 = percentil(valores, 90);
  return {
    curvas,
    mapa: { semanas, linhas },
    distribuicao: {
      faixas,
      total: valores.length,
      p50: percentil(valores, 50),
      p90,
      maturacaoSugerida: p90 === null ? null : maturacaoParaP90(p90),
    },
  };
}
