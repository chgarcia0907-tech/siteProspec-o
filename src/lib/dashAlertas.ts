// Alertas da Dashboard de Outbound (fase 6 do plano). Calculados na hora, sem histórico de lidos;
// limites em `dashboard_parametros`. "Por N semanas seguidas" olha só semanas já fechadas.
// Alocação com metas zeradas não tem esforço, então não dispara o alerta de esforço.
import { addDaysISO, formatBR } from "./cadencia";
import type { Esforco, ParticipacaoSemana } from "./dashHunters";
import { naoRealizada, type Fator, type SemanaRitmo, type VAt } from "./dashRitmo";
import { rotuloSafra, diaSP } from "./safras";
import type { Parametros } from "./safras";

export type Alerta = {
  nivel: "alta" | "media";
  chave: string;
  texto: string;
  /** Aba que explica o alerta. */
  aba: "hunters" | "realizacao" | "conciliacao" | "visao";
  hunterId?: string;
};

export type AlertasInput = {
  hoje: string;
  parametros: Pick<
    Parametros,
    | "esforco_alerta_pct"
    | "semanas_seguidas"
    | "concentracao_ats_pct"
    | "nao_realizadas_pct"
    | "dias_contato_parado"
  >;
  hunters: readonly { id: string; nome: string; parados: number }[];
  esforcoSemanas: readonly {
    semana: string;
    numero: number;
    porHunter: Record<string, Esforco | null>;
  }[];
  participacao: readonly ParticipacaoSemana[];
  ritmo: readonly SemanaRitmo[];
  metaSemanalAts: number | null;
  fatores: readonly Fator[];
  ats: readonly Pick<VAt, "status" | "agendada_atual">[];
  atsSemCard: number;
};

const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fechada = (semana: string, hoje: string) => addDaysISO(semana, 6) < hoje;

/** Fator da árvore que mais piorou (pela variação, no sentido de cada um), ou null. */
export function fatorQueMaisCaiu(fatores: readonly Fator[]): Fator | null {
  const piora = (f: Fator) => (f.variacao === null ? 0 : f.subirEhBom ? f.variacao : -f.variacao);
  const pior = [...fatores].filter((f) => piora(f) < 0).sort((a, b) => piora(a) - piora(b))[0];
  return pior ?? null;
}

export function computeAlertas(input: AlertasInput): Alerta[] {
  const { hoje, parametros: p } = input;
  const n = p.semanas_seguidas;
  const out: Alerta[] = [];

  // 1. Esforço abaixo do limite nas últimas N semanas fechadas.
  const semanasEsforco = input.esforcoSemanas.filter((s) => fechada(s.semana, hoje)).slice(-n);
  if (semanasEsforco.length === n)
    for (const h of input.hunters) {
      const valores = semanasEsforco.map((s) => s.porHunter[h.id] ?? null);
      if (valores.every((e) => e !== null && e.pct < p.esforco_alerta_pct))
        out.push({
          nivel: "alta",
          chave: `esforco-${h.id}`,
          aba: "hunters",
          hunterId: h.id,
          texto: `${h.nome}: esforço abaixo de ${p.esforco_alerta_pct}% da meta há ${n} semanas (${valores.map((e) => `${num(e!.pct)}%`).join(" e ")})`,
        });
    }

  // 2. AT sem card (vale no mesmo dia).
  if (input.atsSemCard > 0)
    out.push({
      nivel: "alta",
      chave: "at-sem-card",
      aba: "conciliacao",
      texto:
        input.atsSemCard === 1
          ? "1 AT sem card no Pipedrive: o status dela não é acompanhado"
          : `${input.atsSemCard} ATs sem card no Pipedrive: o status delas não é acompanhado`,
    });

  // 3. ATs não realizadas acima do limite nas últimas N semanas fechadas (pela data da AT).
  const semanas = input.ritmo.filter((w) => fechada(w.semana, hoje)).slice(-n);
  if (semanas.length === n) {
    const taxas = semanas.map((w) => {
      const fim = addDaysISO(w.semana, 6);
      const doDia = input.ats.filter((a) => {
        const d = diaSP(a.agendada_atual);
        return d >= w.semana && d <= fim;
      });
      return { w, total: doDia.length, nao: doDia.filter((a) => naoRealizada(a, hoje)).length };
    });
    if (taxas.every((t) => t.total > 0 && pct(t.nao, t.total) > p.nao_realizadas_pct))
      out.push({
        nivel: "alta",
        chave: "nao-realizadas",
        aba: "realizacao",
        texto: `ATs não realizadas acima de ${p.nao_realizadas_pct}% há ${n} semanas (${taxas.map((t) => `${rotuloSafra(t.w.numero)}: ${num(pct(t.nao, t.total))}% (${t.nao} de ${t.total})`).join("; ")})`,
      });
  }

  // 4. Meta semanal de ATs marcadas falhou N semanas seguidas, com o fator que mais caiu.
  if (input.metaSemanalAts !== null && semanas.length === n) {
    const meta = input.metaSemanalAts;
    if (semanas.every((w) => w.marcadas < meta)) {
      const fator = fatorQueMaisCaiu(input.fatores);
      out.push({
        nivel: "alta",
        chave: "meta-semanal",
        aba: "visao",
        texto: `Meta semanal de ATs (${num(meta)}) falhou ${n} semanas seguidas (${semanas.map((w) => `${rotuloSafra(w.numero)}: ${w.marcadas}`).join("; ")})${fator ? `; o fator que mais caiu foi ${fator.rotulo}` : ""}`,
      });
    }
  }

  // 5. Concentração: hunter acima do limite das ATs da equipe na última semana fechada.
  const ultima = input.participacao.filter((s) => fechada(s.semana, hoje)).at(-1);
  if (ultima && ultima.total > 0)
    for (const h of input.hunters) {
      const meu = ultima.porHunter[h.id] ?? 0;
      if (pct(meu, ultima.total) > p.concentracao_ats_pct)
        out.push({
          nivel: "media",
          chave: `concentracao-${h.id}`,
          aba: "hunters",
          hunterId: h.id,
          texto: `${h.nome} fez ${num(pct(meu, ultima.total))}% das ATs da equipe na semana de ${formatBR(ultima.semana).slice(0, 5)} (${meu} de ${ultima.total})`,
        });
    }

  // 6. Contatos parados em cadência (diário).
  for (const h of input.hunters)
    if (h.parados > 0)
      out.push({
        nivel: "media",
        chave: `parados-${h.id}`,
        aba: "hunters",
        hunterId: h.id,
        texto: `${h.nome}: ${h.parados} ${h.parados === 1 ? "contato parado" : "contatos parados"} há mais de ${p.dias_contato_parado} dias úteis`,
      });

  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alta" ? -1 : 1));
}
