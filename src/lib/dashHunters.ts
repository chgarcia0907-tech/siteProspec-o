// Aba Hunters da Dashboard de Outbound (Módulo 2, fase 3 do plano): cada hunter está
// prospectando, rodando a cadência e isso vira AT? Cálculo puro sobre contatos, ATs, safras e
// alocação; roda no servidor (`dashboardHunters`) e o cliente recebe os números prontos.
//
// Bases (seção 5 do plano):
// - Safra do contato = semana em que foi criado (São Paulo). A fila de prospecção da semana N é a
//   safra N; a fila de cadência é a safra N−1.
// - Passos no prazo: mesma regra dos Indicadores (etapa prevista por `plannedDates` na semana,
//   até ontem, enviada até a data prevista; a etapa só é devida depois que a anterior saiu).
// - ATs vêm da tabela `ats` (tipo diagnóstico); marcada na semana = `registrada_em`. Avançou =
//   card em `ETAPAS_AVANCO` (etapa atual; o histórico completo entra na fase 5).
// - Esforço = (contatos adicionados na safra + passos executados) ÷ (meta de contatos da alocação
//   + meta semanal de passos). Semana em andamento: a meta é proporcional aos dias úteis passados.
//   Alocação com metas zeradas não tem esforço (não dispara alerta).
import { metasDaSafra, alocacaoVigente, parceiroDaDupla, semMeta, type Alocacao } from "./alocacao";
import {
  DEFAULT_OFFSETS,
  STEPS,
  addDaysISO,
  computedStatus,
  entryChannel,
  isActive,
  plannedDates,
  stepApplies,
  type Channel,
  type Contact,
  type Holidays,
  type Offsets,
  type StepDef,
} from "./cadencia";
import { businessDaysBetween, businessDaysIn, type DashGoal } from "./dashboard";
import { ETAPAS_AVANCO } from "./pipedrive";
import {
  diaSP,
  fimDaSemana,
  safraAnterior,
  safraDaData,
  statusSafra,
  type Safra,
  type StatusSafra,
} from "./safras";

/* --------------------------------- Entrada -------------------------------- */

export type HContato = Pick<
  Contact,
  | "id"
  | "user_id"
  | "name"
  | "company"
  | "company_id"
  | "created_at"
  | "connected_at"
  | "status"
  | "step1_date"
  | "sem_whatsapp"
  | "respondeu_em"
  | "resposta_etapa"
  | "at_marcada_em"
  | StepDef["sentField"]
>;

/** Colunas de `contacts` que a aba lê. */
export const H_CONTATO_COLUNAS = [
  "id",
  "user_id",
  "name",
  "company",
  "company_id",
  "created_at",
  "connected_at",
  "status",
  "step1_date",
  "sem_whatsapp",
  "respondeu_em",
  "resposta_etapa",
  "at_marcada_em",
  ...STEPS.map((s) => s.sentField),
].join(", ");

export type HAt = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  registrada_em: string;
  status: string;
  pipedrive_stage_id: number | null;
};

export type HHunter = { id: string; name: string; groupId: string | null };
export type HGoal = DashGoal & { passos_semana: number | null };

export type HuntersInput = {
  hoje: string;
  /** Segunda-feira da semana escolhida (calendário). */
  semana: string;
  /** Safras do ciclo. */
  safras: readonly Safra[];
  maturacaoSemanas: number;
  diasContatoParado: number;
  esforcoAlertaPct: number;
  alocacoes: readonly Alocacao[];
  hunters: readonly HHunter[];
  contatos: readonly HContato[];
  ats: readonly HAt[];
  goals: readonly HGoal[];
  offsets: Readonly<Record<string, Offsets>>;
  holidays: Holidays;
};

/* --------------------------------- Saída --------------------------------- */

export type FilaProspeccao = {
  alocacao: Pick<Alocacao, "sector_id" | "subsector_id" | "dupla" | "motivo_meta_zero"> | null;
  semMeta: boolean;
  metaEmpresas: number | null;
  metaContatos: number | null;
  empresas: number;
  contatos: number;
  /** Contatos ÷ empresas (null sem empresa ligada). */
  contatosPorEmpresa: number | null;
  /** Contatos importados da semana com a conexão aceita na semana. */
  conexoes: number;
};

export type Parado = {
  id: string;
  nome: string;
  empresa: string;
  /** Último envio (ou o início previsto, sem envio). */
  desde: string;
  diasUteis: number;
};

export type FilaCadencia = {
  emCadencia: number;
  previstosHoje: number;
  previstosSemana: number;
  devidos: number;
  noPrazo: number;
  parados: Parado[];
};

export type Esforco = {
  real: number;
  meta: number;
  pct: number;
  /** Semana em andamento: meta proporcional aos dias úteis já passados. */
  parcial: boolean;
  abaixo: boolean;
};

export type Disciplina = {
  passos: number;
  devidos: number;
  noPrazo: number;
  diasAtivos: number;
  diasUteis: number;
  /** null sem metas (sem alocação e sem meta de passos) ou com metas zeradas. */
  esforco: Esforco | null;
  ats: number;
  atsEquipe: number;
};

export type SafraDoHunter = {
  safraId: string;
  numero: number;
  status: StatusSafra;
  madura: boolean;
  setor: Pick<Alocacao, "sector_id" | "subsector_id"> | null;
  contatos: number;
  respostas: number;
  ats: number;
  realizadas: number;
  avancaram: number;
};

export type Canal = { canal: Channel; respostas: number; contatos: number };

export type TotaisHunter = {
  contatos: number;
  ats: number;
  realizadas: number;
  avancaram: number;
  /** Só safras maduras (base do avanço na dispersão volume × avanço). */
  realizadasMaduras: number;
  avancaramMaduras: number;
  devidos: number;
  noPrazo: number;
  canais: Canal[];
};

export type HunterSemana = {
  id: string;
  nome: string;
  dupla: string | null;
  parceiro: string | null;
  prospeccao: FilaProspeccao;
  cadencia: FilaCadencia;
  disciplina: Disciplina;
  /** Atividade por dia da semana (segunda a domingo): contatos adicionados + passos enviados. */
  calor: number[];
  historico: SafraDoHunter[];
  ciclo: TotaisHunter;
};

export type ParticipacaoSemana = {
  semana: string;
  total: number;
  porHunter: Record<string, number>;
};

export type HuntersSemana = {
  semana: string;
  dias: string[];
  safraN: Pick<Safra, "id" | "numero" | "inicio" | "fim"> | null;
  safraAnterior: Pick<Safra, "id" | "numero" | "inicio" | "fim"> | null;
  hunters: HunterSemana[];
  participacao: ParticipacaoSemana[];
  /** Média por hunter dos totais do ciclo (comparação da ficha). */
  media: Omit<TotaisHunter, "canais">;
};

/* --------------------------------- Cálculo -------------------------------- */

/** Meta semanal de passos do hunter, com a herança hunter → grupo → equipe de `resolveGoal`. */
export function metaDePassos(
  goals: readonly HGoal[],
  hunterId: string,
  groupId: string | null | undefined,
): number | null {
  const own = goals.find((g) => g.user_id === hunterId);
  const group = groupId ? goals.find((g) => !g.user_id && g.group_id === groupId) : undefined;
  const team = goals.find((g) => !g.user_id && !g.group_id);
  return own?.passos_semana ?? group?.passos_semana ?? team?.passos_semana ?? null;
}

const dia = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);
const noIntervalo = (d: string | null | undefined, de: string, ate: string) =>
  !!d && d >= de && d <= ate;
const ultimoEnvio = (c: HContato) =>
  STEPS.reduce<string | null>((m, s) => {
    const d = dia(c[s.sentField]);
    return d && (!m || d > m) ? d : m;
  }, null);

/** Passos devidos e no prazo de um contato no intervalo (mesma regra dos Indicadores). */
function cumprimento(
  c: HContato,
  planned: Record<number, string | null>,
  de: string,
  ate: string,
): { devidos: number; noPrazo: number } {
  let devidos = 0;
  let noPrazo = 0;
  const ativo = isActive(c);
  for (const s of STEPS) {
    const p = planned[s.n];
    if (!noIntervalo(p, de, ate) || !stepApplies(c, s)) continue;
    const antes = STEPS.slice(0, s.n - 1).filter((x) => stepApplies(c, x));
    if (antes.length && !c[antes[antes.length - 1]!.sentField]) continue;
    const d = dia(c[s.sentField]);
    if (!d && !ativo) continue;
    devidos++;
    if (d && d <= p!) noPrazo++;
  }
  return { devidos, noPrazo };
}

export function computeHunters(input: HuntersInput): HuntersSemana {
  const { hoje, semana, holidays } = input;
  const dias = Array.from({ length: 7 }, (_, i) => addDaysISO(semana, i));
  const fimSemana = dias[6]!;
  const ontem = addDaysISO(hoje, -1);
  const fimDevido = fimSemana < ontem ? fimSemana : ontem;
  const safraN = safraDaData(semana, input.safras);
  const safraN1 = safraN ? safraAnterior(safraN, input.safras) : null;
  const ids = new Set(input.hunters.map((h) => h.id));
  const contatos = input.contatos.filter((c) => ids.has(c.user_id));
  const offsetsDe = (uid: string) => input.offsets[uid] ?? DEFAULT_OFFSETS;
  const safraDoContato = new Map(
    contatos.map((c) => [c.id, safraDaData(diaSP(c.created_at), input.safras)]),
  );
  const ats = input.ats.filter((a) => a.user_id && ids.has(a.user_id));
  const atsPorContato = new Map<string, HAt[]>();
  for (const a of ats)
    if (a.contact_id)
      atsPorContato.set(a.contact_id, [...(atsPorContato.get(a.contact_id) ?? []), a]);
  const avancou = (a: HAt) =>
    a.pipedrive_stage_id !== null && ETAPAS_AVANCO.has(a.pipedrive_stage_id);
  const atsSemanaEquipe = ats.filter((a) =>
    noIntervalo(diaSP(a.registrada_em), semana, fimSemana),
  ).length;

  // Dias úteis da semana: todos, e os já passados (até hoje) para a meta proporcional.
  const uteisSemana = businessDaysIn(semana, fimSemana, holidays);
  const uteisAteHoje =
    hoje >= semana ? businessDaysIn(semana, hoje < fimSemana ? hoje : fimSemana, holidays) : 0;
  const parcial = hoje <= fimSemana;

  const hunters: HunterSemana[] = input.hunters.map((h) => {
    const meus = contatos.filter((c) => c.user_id === h.id);
    const off = offsetsDe(h.id);

    // Fila de prospecção (safra N).
    const daN = safraN ? meus.filter((c) => safraDoContato.get(c.id)?.id === safraN.id) : [];
    const empresas = new Set(daN.filter((c) => c.company_id).map((c) => c.company_id)).size;
    const comEmpresa = daN.filter((c) => c.company_id).length;
    const aloc = safraN
      ? alocacaoVigente(
          input.alocacoes,
          safraN.id,
          h.id,
          hoje < semana ? semana : hoje > fimSemana ? fimSemana : hoje,
        )
      : null;
    const metas = safraN ? metasDaSafra([...input.alocacoes], safraN.id, h.id) : null;
    const zerada = !!metas && semMeta(metas);
    const prospeccao: FilaProspeccao = {
      alocacao: aloc && {
        sector_id: aloc.sector_id,
        subsector_id: aloc.subsector_id,
        dupla: aloc.dupla,
        motivo_meta_zero: aloc.motivo_meta_zero,
      },
      semMeta: zerada,
      metaEmpresas: metas?.meta_empresas ?? null,
      metaContatos: metas?.meta_contatos ?? null,
      empresas,
      contatos: daN.length,
      contatosPorEmpresa: empresas ? Math.round((comEmpresa / empresas) * 10) / 10 : null,
      conexoes: daN.filter((c) =>
        noIntervalo(dia(c.connected_at) ?? diaSP(c.created_at), semana, fimSemana),
      ).length,
    };

    // Fila de cadência (safra N−1).
    const daN1 = safraN1 ? meus.filter((c) => safraDoContato.get(c.id)?.id === safraN1.id) : [];
    const cadencia: FilaCadencia = {
      emCadencia: 0,
      previstosHoje: 0,
      previstosSemana: 0,
      devidos: 0,
      noPrazo: 0,
      parados: [],
    };
    for (const c of daN1) {
      const planned = plannedDates(c, off, holidays);
      if (computedStatus(c) === "em_cadencia" && isActive(c)) cadencia.emCadencia++;
      for (const s of STEPS) {
        if (c[s.sentField] || !stepApplies(c, s) || !isActive(c)) continue;
        const p = planned[s.n];
        if (p === hoje) cadencia.previstosHoje++;
        if (noIntervalo(p, semana, fimSemana)) cadencia.previstosSemana++;
      }
      const cu = cumprimento(c, planned, semana, fimDevido);
      cadencia.devidos += cu.devidos;
      cadencia.noPrazo += cu.noPrazo;
    }

    // Contatos parados: em cadência, sem resposta e sem envio há mais de N dias úteis (todas as safras).
    for (const c of meus) {
      if (computedStatus(c) !== "em_cadencia" || !isActive(c) || c.respondeu_em) continue;
      const desde = ultimoEnvio(c) ?? dia(c.step1_date);
      if (!desde || desde > hoje) continue;
      const n = businessDaysBetween(desde, hoje, holidays);
      if (n > input.diasContatoParado)
        cadencia.parados.push({ id: c.id, nome: c.name, empresa: c.company, desde, diasUteis: n });
    }
    cadencia.parados.sort(
      (a, b) => b.diasUteis - a.diasUteis || a.nome.localeCompare(b.nome, "pt-BR"),
    );

    // Disciplina da semana (calendário, todos os contatos do hunter).
    const calor = dias.map(() => 0);
    let passos = 0;
    let devidos = 0;
    let noPrazo = 0;
    for (const c of meus) {
      const criado = diaSP(c.created_at);
      const iCriado = dias.indexOf(criado);
      if (iCriado >= 0) calor[iCriado]!++;
      for (const s of STEPS) {
        const d = dia(c[s.sentField]);
        const i = d ? dias.indexOf(d) : -1;
        if (i >= 0) {
          calor[i]!++;
          passos++;
        }
      }
      const cu = cumprimento(c, plannedDates(c, off, holidays), semana, fimDevido);
      devidos += cu.devidos;
      noPrazo += cu.noPrazo;
    }
    const diasAtivos = calor.filter((v, i) => v > 0 && dias[i]! <= hoje).length;
    const metaPassos = metaDePassos(input.goals, h.id, h.groupId);
    let esforco: Esforco | null = null;
    const metaTotal = (prospeccao.metaContatos ?? 0) + (metaPassos ?? 0);
    if (!zerada && metaTotal > 0 && hoje >= semana) {
      const fator = parcial && uteisSemana > 0 ? uteisAteHoje / uteisSemana : 1;
      const alvo = Math.round(metaTotal * fator * 10) / 10;
      const real = prospeccao.contatos + passos;
      const pct = alvo > 0 ? Math.round((real / alvo) * 100) : 100;
      esforco = { real, meta: alvo, pct, parcial, abaixo: pct < input.esforcoAlertaPct };
    }
    const atsSemana = ats.filter(
      (a) => a.user_id === h.id && noIntervalo(diaSP(a.registrada_em), semana, fimSemana),
    ).length;
    const disciplina: Disciplina = {
      passos,
      devidos,
      noPrazo,
      diasAtivos,
      diasUteis: uteisAteHoje,
      esforco,
      ats: atsSemana,
      atsEquipe: atsSemanaEquipe,
    };

    // Histórico por safra e totais do ciclo.
    const historico: SafraDoHunter[] = [...input.safras]
      .sort((a, b) => a.numero - b.numero)
      .filter((s) => s.inicio <= hoje)
      .map((s) => {
        const daSafra = meus.filter((c) => safraDoContato.get(c.id)?.id === s.id);
        const atsSafra = daSafra.flatMap((c) => atsPorContato.get(c.id) ?? []);
        const vig = alocacaoVigente(input.alocacoes, s.id, h.id, fimDaSemana(s));
        const st = statusSafra(s, hoje, input.maturacaoSemanas);
        return {
          safraId: s.id,
          numero: s.numero,
          status: st,
          madura: st === "madura",
          setor: vig && { sector_id: vig.sector_id, subsector_id: vig.subsector_id },
          contatos: daSafra.length,
          respostas: daSafra.filter((c) => c.respondeu_em).length,
          ats: atsSafra.length,
          realizadas: atsSafra.filter((a) => a.status === "realizada").length,
          avancaram: atsSafra.filter(avancou).length,
        };
      });
    const soma = (k: "contatos" | "ats" | "realizadas" | "avancaram", soMaduras = false) =>
      historico.filter((x) => !soMaduras || x.madura).reduce((t, x) => t + x[k], 0);

    let devCiclo = 0;
    let prazoCiclo = 0;
    const primeira = [...input.safras].sort((a, b) => a.inicio.localeCompare(b.inicio)).at(0);
    const canais = new Map<Channel, Canal>(
      (["linkedin", "whatsapp"] as const).map((c) => [c, { canal: c, respostas: 0, contatos: 0 }]),
    );
    for (const c of meus) {
      if (!safraDoContato.get(c.id)) continue;
      if (primeira) {
        const cu = cumprimento(c, plannedDates(c, off, holidays), primeira.inicio, ontem);
        devCiclo += cu.devidos;
        prazoCiclo += cu.noPrazo;
      }
      for (const canal of canais.values())
        if (STEPS.some((s) => s.channel === canal.canal && c[s.sentField])) canal.contatos++;
      if (c.respondeu_em && c.resposta_etapa !== null) {
        const ch = entryChannel(c.resposta_etapa);
        if (ch !== "outro") canais.get(ch)!.respostas++;
      }
    }

    return {
      id: h.id,
      nome: h.name,
      dupla: prospeccao.alocacao?.dupla ?? null,
      parceiro: safraN ? parceiroDaDupla([...input.alocacoes], safraN.id, h.id) : null,
      prospeccao,
      cadencia,
      disciplina,
      calor,
      historico,
      ciclo: {
        contatos: soma("contatos"),
        ats: soma("ats"),
        realizadas: soma("realizadas"),
        avancaram: soma("avancaram"),
        realizadasMaduras: soma("realizadas", true),
        avancaramMaduras: soma("avancaram", true),
        devidos: devCiclo,
        noPrazo: prazoCiclo,
        canais: [...canais.values()],
      },
    };
  });

  // Participação semanal nas ATs: semanas das safras do ciclo até a semana escolhida.
  const participacao: ParticipacaoSemana[] = [...input.safras]
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .filter((s) => s.inicio <= semana)
    .map((s) => {
      const fim = fimDaSemana(s);
      const porHunter: Record<string, number> = {};
      let total = 0;
      for (const a of ats)
        if (noIntervalo(diaSP(a.registrada_em), s.inicio, fim)) {
          porHunter[a.user_id!] = (porHunter[a.user_id!] ?? 0) + 1;
          total++;
        }
      return { semana: s.inicio, total, porHunter };
    });

  const n = hunters.length || 1;
  const med = (k: keyof Omit<TotaisHunter, "canais">) =>
    Math.round((hunters.reduce((t, x) => t + x.ciclo[k], 0) / n) * 10) / 10;

  return {
    semana,
    dias,
    safraN: safraN && {
      id: safraN.id,
      numero: safraN.numero,
      inicio: safraN.inicio,
      fim: safraN.fim,
    },
    safraAnterior: safraN1 && {
      id: safraN1.id,
      numero: safraN1.numero,
      inicio: safraN1.inicio,
      fim: safraN1.fim,
    },
    hunters,
    participacao,
    media: {
      contatos: med("contatos"),
      ats: med("ats"),
      realizadas: med("realizadas"),
      avancaram: med("avancaram"),
      realizadasMaduras: med("realizadasMaduras"),
      avancaramMaduras: med("avancaramMaduras"),
      devidos: med("devidos"),
      noPrazo: med("noPrazo"),
    },
  };
}
