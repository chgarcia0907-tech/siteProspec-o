// Realização e avanço da Dashboard de Outbound (Módulo 4, fase 7 do plano): as ATs marcadas
// acontecem e avançam? Onde elas se perdem? Cálculo puro; roda no servidor (`dashboardRealizacao`).
//
// Recorte: ATs de diagnóstico dos membros do ciclo cuja data (`agendada_atual`) cai nas semanas das
// safras do ciclo, ou cujo contato é de uma safra do ciclo. Cards: os dessas ATs na cópia do
// Pipedrive.
//
// Bases de tempo:
// - Situação por semana: semana da data atual da AT. Agendada com a data passada = sem desfecho
//   (para remarcar); com a data de hoje em diante = agendada.
// - Horário × dia: cada horário que a AT teve (o original e cada remarcação), com o desfecho
//   daquele horário, pelo log `at_eventos`. AT sem log usa só o horário atual e a situação dela.
// - Antecedência: dias corridos entre o registro da AT e a data original dela; % realizada só das
//   ATs com a data já passada.
// - Tempo por etapa: dias corridos (como o `days_to_rotten` do Pipedrive) de cada passagem do card
//   pela etapa, pelo histórico da cópia; a passagem em aberto conta até hoje.
import { alocacaoDoContato, type Alocacao } from "./alocacao";
import { avancou, naoRealizada } from "./dashRitmo";
import { NOME_ETAPA } from "./pipedrive";
import { diaSP, fimDaSemana, safraDaData, statusSafra, type Safra } from "./safras";

export type RAt = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  registrada_em: string;
  agendada_original: string;
  agendada_atual: string;
  status: string;
  pipedrive_stage_id: number | null;
  pipedrive_deal_id: number | null;
};

export type REvento = {
  at_id: string;
  evento: string;
  ocorrido_em: string;
  horario_anterior: string | null;
  horario_novo: string | null;
};

export type RCard = {
  status: string;
  stage_id: number | null;
  lost_reason: string | null;
  won_time: string | null;
  etapas: readonly { stage_id: number; entrou_em: string; saiu_em: string | null }[];
};

export type RContato = { id: string; user_id: string; created_at: string };

export type RealizacaoInput = {
  hoje: string;
  safras: readonly Safra[];
  maturacaoSemanas: number;
  contatos: readonly RContato[];
  ats: readonly RAt[];
  eventos: readonly REvento[];
  /** Cópia do Pipedrive por `pipedrive_deal_id`. */
  cards: Readonly<Record<number, RCard>>;
  alocacoes: readonly Alocacao[];
  /** Nome de cada setor (`sectors.id` → nome). */
  setores: Readonly<Record<string, string>>;
  /** Meta de dias corridos em cada etapa (`dashboard_tempo_etapas`). */
  metasTempo: Readonly<Record<number, number>>;
};

export type SituacaoSemana = {
  semana: string;
  numero: number;
  futura: boolean;
  realizada: number;
  noShow: number;
  cancelada: number;
  semDesfecho: number;
  agendada: number;
  /** ATs da semana que já foram remarcadas alguma vez. */
  remarcadas: number;
};

export type DesfechoHorario = "realizada" | "no_show" | "remarcada" | "cancelada" | "sem_desfecho";

export type CelulaHorario = {
  /** 1 = segunda … 5 = sexta. */
  dia: number;
  hora: number;
  total: number;
  noShow: number;
  remarcadas: number;
};

export type FaixaAntecedencia = {
  faixa: string;
  /** ATs com a data já passada. */
  ats: number;
  realizadas: number;
};

export type FunilSetor = {
  setorId: string | null;
  setor: string;
  contatos: number;
  ats: number;
  realizadas: number;
  avancaram: number;
  proposta: number;
  venda: number;
  /** Alguma safra do setor ainda não amadureceu: taxas provisórias. */
  imaturo: boolean;
};

export type Perdas = {
  etapas: { stageId: number; nome: string }[];
  linhas: { motivo: string; porEtapa: Record<number, number>; total: number }[];
  total: number;
};

export type TempoEtapa = {
  stageId: number;
  nome: string;
  meta: number | null;
  /** Passagens encerradas. */
  passagens: number;
  mediana: number | null;
  dentroDaMeta: number;
  /** Cards abertos hoje na etapa e há quanto tempo; os acima da meta. */
  abertos: number;
  abertosAcima: number;
};

export type Realizacao = {
  situacao: SituacaoSemana[];
  horarios: CelulaHorario[];
  antecedencia: FaixaAntecedencia[];
  setores: FunilSetor[];
  perdas: Perdas;
  tempos: TempoEtapa[];
  /** Totais do recorte, para o cabeçalho. */
  totais: { ats: number; realizadas: number; naoRealizadas: number; avancaram: number };
};

/** Etapas do funil 6 na ordem do Pipedrive. */
export const ETAPAS_FUNIL = [108, 31, 33, 34, 35, 36] as const;

export const FAIXAS_ANTECEDENCIA = [
  { faixa: "0 a 2 dias", ate: 2 },
  { faixa: "3 a 5 dias", ate: 5 },
  { faixa: "6 a 10 dias", ate: 10 },
  { faixa: "Mais de 10 dias", ate: Infinity },
] as const;

const DIA_MS = 86_400_000;
const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);

/** Dia da semana (1 = segunda … 7 = domingo) e hora cheia de um horário, no fuso de São Paulo. */
export function diaEHoraSP(ts: string): { dia: number; hora: number } {
  const dia = new Date(`${diaSP(ts)}T12:00:00Z`).getUTCDay() || 7;
  const hora = Number(
    new Date(ts).toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }),
  );
  return { dia, hora };
}

/**
 * Horários que a AT teve, cada um com o desfecho, pelo log de eventos em ordem. Remarcar fecha o
 * horário anterior (como remarcado, salvo se já fechou em no-show) e abre o novo; reabrir volta o
 * último horário para aberto. O horário em aberto no fim fica sem desfecho se a data já passou e
 * some se ainda vai acontecer. Sem log, vale o horário atual com a situação da AT.
 */
export function horariosDaAt(
  at: Pick<RAt, "agendada_original" | "agendada_atual" | "status">,
  eventos: readonly REvento[],
  hoje: string,
): { horario: string; desfecho: DesfechoHorario }[] {
  const finalSemLog = (h: string): DesfechoHorario | null => {
    if (at.status === "realizada" || at.status === "no_show" || at.status === "cancelada")
      return at.status;
    return diaSP(h) < hoje ? "sem_desfecho" : null;
  };
  if (!eventos.length) {
    const d = finalSemLog(at.agendada_atual);
    return d ? [{ horario: at.agendada_atual, desfecho: d }] : [];
  }
  const ordem = [...eventos].sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));
  const fechados: { horario: string; desfecho: DesfechoHorario }[] = [];
  let atual = at.agendada_original;
  let aberto = true;
  for (const e of ordem) {
    if (e.evento === "marcada") {
      if (e.horario_novo) atual = e.horario_novo;
    } else if (e.evento === "remarcada") {
      if (aberto) fechados.push({ horario: e.horario_anterior ?? atual, desfecho: "remarcada" });
      atual = e.horario_novo ?? atual;
      aberto = true;
    } else if (e.evento === "no_show" || e.evento === "realizada" || e.evento === "cancelada") {
      if (aberto) fechados.push({ horario: atual, desfecho: e.evento });
      aberto = false;
    } else if (e.evento === "reaberta") {
      if (!aberto && fechados.at(-1)?.horario === atual) fechados.pop();
      aberto = true;
    }
  }
  if (aberto && diaSP(atual) < hoje) fechados.push({ horario: atual, desfecho: "sem_desfecho" });
  return fechados;
}

/** Faixa de antecedência (dias corridos entre o registro e a data original da AT). */
export function faixaAntecedencia(dias: number): string {
  return FAIXAS_ANTECEDENCIA.find((f) => dias <= f.ate)!.faixa;
}

const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function computeRealizacao(input: RealizacaoInput): Realizacao {
  const { hoje, cards } = input;
  const safras = [...input.safras].sort((a, b) => a.numero - b.numero);
  const inicio = safras[0]?.inicio ?? null;
  const fim = safras.length ? fimDaSemana(safras.at(-1)!) : null;
  const safraDoContato = new Map(
    input.contatos.map((c) => [c.id, safraDaData(diaSP(c.created_at), safras)]),
  );
  const contatoPorId = new Map(input.contatos.map((c) => [c.id, c]));
  const naSemanaDoCiclo = (d: string) => !!inicio && !!fim && d >= inicio && d <= fim;
  const ats = input.ats.filter(
    (a) =>
      naSemanaDoCiclo(diaSP(a.agendada_atual)) ||
      (a.contact_id !== null && !!safraDoContato.get(a.contact_id)),
  );
  const eventosDe = new Map<string, REvento[]>();
  for (const e of input.eventos) {
    const lista = eventosDe.get(e.at_id) ?? [];
    lista.push(e);
    eventosDe.set(e.at_id, lista);
  }
  const remarcou = (a: RAt) => (eventosDe.get(a.id) ?? []).some((e) => e.evento === "remarcada");

  // Situação por semana (data atual da AT).
  const situacao: SituacaoSemana[] = safras.map((s) => {
    const f = fimDaSemana(s);
    const daSemana = ats.filter((a) => {
      const d = diaSP(a.agendada_atual);
      return d >= s.inicio && d <= f;
    });
    const conta = (st: string) => daSemana.filter((a) => a.status === st).length;
    const agendadas = daSemana.filter((a) => a.status === "agendada");
    return {
      semana: s.inicio,
      numero: s.numero,
      futura: s.inicio > hoje,
      realizada: conta("realizada"),
      noShow: conta("no_show"),
      cancelada: conta("cancelada"),
      semDesfecho: agendadas.filter((a) => diaSP(a.agendada_atual) < hoje).length,
      agendada: agendadas.filter((a) => diaSP(a.agendada_atual) >= hoje).length,
      remarcadas: daSemana.filter(remarcou).length,
    };
  });

  // Horário × dia útil: cada horário com desfecho.
  const celulas = new Map<string, CelulaHorario>();
  for (const a of ats)
    for (const h of horariosDaAt(a, eventosDe.get(a.id) ?? [], hoje)) {
      const { dia, hora } = diaEHoraSP(h.horario);
      if (dia > 5) continue;
      const k = `${dia}-${hora}`;
      const c = celulas.get(k) ?? { dia, hora, total: 0, noShow: 0, remarcadas: 0 };
      c.total++;
      if (h.desfecho === "no_show") c.noShow++;
      if (h.desfecho === "remarcada") c.remarcadas++;
      celulas.set(k, c);
    }
  const horarios = [...celulas.values()].sort((a, b) => a.hora - b.hora || a.dia - b.dia);

  // Antecedência × % realizada (só ATs com a data passada).
  const passadas = ats.filter((a) => diaSP(a.agendada_atual) < hoje || a.status !== "agendada");
  const antecedencia: FaixaAntecedencia[] = FAIXAS_ANTECEDENCIA.map(({ faixa }) => {
    const daFaixa = passadas.filter(
      (a) =>
        faixaAntecedencia(
          Math.max(0, diasEntre(diaSP(a.registrada_em), diaSP(a.agendada_original))),
        ) === faixa,
    );
    return {
      faixa,
      ats: daFaixa.length,
      realizadas: daFaixa.filter((a) => a.status === "realizada").length,
    };
  });

  // Funis por setor alocado (setor da alocação do hunter quando o contato entrou).
  const chegouProposta = (a: RAt) => {
    const card = a.pipedrive_deal_id ? cards[a.pipedrive_deal_id] : undefined;
    const alem = (s: number) => s === 34 || s === 35 || s === 36;
    if (card) return card.status === "won" || card.etapas.some((e) => alem(e.stage_id));
    return a.pipedrive_stage_id !== null && alem(a.pipedrive_stage_id);
  };
  const setorDoContato = (id: string): string | null => {
    const c = contatoPorId.get(id);
    const s = safraDoContato.get(id);
    if (!c || !s) return null;
    return alocacaoDoContato(c, s.id, input.alocacoes)?.sector_id ?? null;
  };
  const grupos = new Map<string | null, FunilSetor>();
  const grupo = (setorId: string | null) => {
    let g = grupos.get(setorId);
    if (!g) {
      g = {
        setorId,
        setor: setorId ? (input.setores[setorId] ?? "Setor removido") : "Sem alocação",
        contatos: 0,
        ats: 0,
        realizadas: 0,
        avancaram: 0,
        proposta: 0,
        venda: 0,
        imaturo: false,
      };
      grupos.set(setorId, g);
    }
    return g;
  };
  for (const c of input.contatos) {
    const s = safraDoContato.get(c.id);
    if (!s) continue;
    const g = grupo(setorDoContato(c.id));
    g.contatos++;
    if (statusSafra(s, hoje, input.maturacaoSemanas) !== "madura") g.imaturo = true;
  }
  for (const a of ats) {
    if (!a.contact_id || !safraDoContato.get(a.contact_id)) continue;
    const g = grupo(setorDoContato(a.contact_id));
    g.ats++;
    if (a.status !== "realizada") continue;
    g.realizadas++;
    if (avancou(a, cards)) g.avancaram++;
    if (chegouProposta(a)) g.proposta++;
    if (a.pipedrive_deal_id !== null && cards[a.pipedrive_deal_id]?.status === "won") g.venda++;
  }
  const setores = [...grupos.values()].sort(
    (a, b) =>
      Number(a.setorId === null) - Number(b.setorId === null) ||
      b.ats - a.ats ||
      a.setor.localeCompare(b.setor, "pt-BR"),
  );

  // Cards das ATs do recorte.
  const cardsDoRecorte = [
    ...new Set(ats.map((a) => a.pipedrive_deal_id).filter((d): d is number => d !== null)),
  ]
    .map((d) => cards[d])
    .filter((c): c is RCard => !!c && c.status !== "deleted");

  // Motivo de perda × etapa em que o card foi perdido.
  const perdidos = cardsDoRecorte.filter((c) => c.status === "lost");
  const porMotivo = new Map<string, Record<number, number>>();
  const etapasComPerda = new Set<number>();
  for (const c of perdidos) {
    const motivo = c.lost_reason?.trim() || "Sem motivo";
    const etapa = c.stage_id ?? 0;
    etapasComPerda.add(etapa);
    const linha = porMotivo.get(motivo) ?? {};
    linha[etapa] = (linha[etapa] ?? 0) + 1;
    porMotivo.set(motivo, linha);
  }
  const ordemEtapa = (s: number) => {
    const i = (ETAPAS_FUNIL as readonly number[]).indexOf(s);
    return i < 0 ? ETAPAS_FUNIL.length : i;
  };
  const perdas: Perdas = {
    etapas: [...etapasComPerda]
      .sort((a, b) => ordemEtapa(a) - ordemEtapa(b) || a - b)
      .map((s) => ({ stageId: s, nome: NOME_ETAPA[s] ?? (s ? `Etapa ${s}` : "Sem etapa") })),
    linhas: [...porMotivo.entries()]
      .map(([motivo, porEtapa]) => ({
        motivo,
        porEtapa,
        total: Object.values(porEtapa).reduce((t, n) => t + n, 0),
      }))
      .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, "pt-BR")),
    total: perdidos.length,
  };

  // Tempo por etapa × meta.
  const tempos: TempoEtapa[] = ETAPAS_FUNIL.map((stageId) => {
    const meta = input.metasTempo[stageId] ?? null;
    const fechadas: number[] = [];
    let abertos = 0;
    let abertosAcima = 0;
    for (const c of cardsDoRecorte)
      for (const e of c.etapas) {
        if (e.stage_id !== stageId) continue;
        if (e.saiu_em) fechadas.push(Math.max(0, diasEntre(diaSP(e.entrou_em), diaSP(e.saiu_em))));
        else if (c.status === "open") {
          abertos++;
          if (meta !== null && diasEntre(diaSP(e.entrou_em), hoje) > meta) abertosAcima++;
        }
      }
    return {
      stageId,
      nome: NOME_ETAPA[stageId] ?? `Etapa ${stageId}`,
      meta,
      passagens: fechadas.length,
      mediana: mediana(fechadas),
      dentroDaMeta: meta === null ? 0 : fechadas.filter((d) => d <= meta).length,
      abertos,
      abertosAcima,
    };
  });

  const realizadas = ats.filter((a) => a.status === "realizada");
  return {
    situacao,
    horarios,
    antecedencia,
    setores,
    perdas,
    tempos,
    totais: {
      ats: ats.length,
      realizadas: realizadas.length,
      naoRealizadas: ats.filter((a) => naoRealizada(a, hoje)).length,
      avancaram: realizadas.filter((a) => avancou(a, cards)).length,
    },
  };
}

/** Erro de validação das metas de tempo por etapa (dias corridos, 1 a 365), ou null. */
export function erroMetasTempo(metas: Readonly<Record<number, number>>): string | null {
  for (const s of ETAPAS_FUNIL) {
    const v = metas[s];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 1 || v > 365)
      return `A meta de "${NOME_ETAPA[s] ?? s}" deve ser de 1 a 365 dias.`;
  }
  return null;
}
