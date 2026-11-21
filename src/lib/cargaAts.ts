// Carga única da planilha "Registro de ATs - NTec" (abas ATs, Histórico e Time) para as tabelas
// `ats`, `at_eventos` e `time_comercial`. Tudo aqui é puro: o script `scripts/carga-ats.ts` lê os
// CSVs, busca perfis e contatos e grava o plano. Na dúvida, o campo fica em branco e vira aviso.

import {
  contatoDaAt,
  pessoaDaMarcacao,
  resumoAt,
  type AtEvento,
  type AtEventoTipo,
  type AtStatus,
  type ContatoParaAt,
  type PessoaTime,
} from "./ats";

/* ----------------------------------- CSV ----------------------------------- */

/** CSV do Google Sheets: vírgula, aspas duplas, aspas escapadas ("") e quebra de linha em célula. */
export function lerCSV(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  const t = texto.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else celula += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ",") {
      linha.push(celula);
      celula = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += ch;
  }
  if (celula !== "" || linha.length) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Linhas do CSV como objetos pelo cabeçalho (primeira linha). */
export function porCabecalho(linhas: string[][]): Record<string, string>[] {
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((c, i) => [c.trim(), (l[i] ?? "").trim()])));
}

/* ---------------------------------- Valores ---------------------------------- */

const pad = (n: string) => n.padStart(2, "0");

/** "16/11/2026 13:45" (Brasília) → "2026-11-16T13:45:00-03:00"; vazio ou fora do formato → null. */
export function dataHoraBR(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(texto.trim());
  if (!m) return null;
  const [, d, mes, a, h = "0", min = "00"] = m;
  return `${a}-${pad(mes!)}-${pad(d!)}T${pad(h)}:${min}:00-03:00`;
}

/**
 * Horário de um evento completado pela carga: `minimo`, ou um minuto depois do último evento do
 * log se ele for mais tarde, para não empatar (no banco o empate cairia no `created_at`).
 */
export function depoisDoUltimo(log: readonly { ocorrido_em: string }[], minimo: string): string {
  const ultimo = log.at(-1)?.ocorrido_em;
  if (!ultimo || new Date(minimo) > new Date(ultimo)) return minimo;
  const sp = new Date(new Date(ultimo).getTime() + 60_000).toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  return `${sp.replace(" ", "T")}-03:00`;
}

const inteiro = (texto: string): number | null => {
  const t = texto.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
};

const STATUS_PLANILHA: Record<string, AtStatus> = {
  agendada: "agendada",
  remarcada: "agendada",
  realizada: "realizada",
  "no-show": "no_show",
  "no show": "no_show",
  noshow: "no_show",
  "nao compareceu": "no_show",
  cancelada: "cancelada",
};

const EVENTO_PLANILHA: Record<string, AtEventoTipo> = {
  marcada: "marcada",
  remarcada: "remarcada",
  realizada: "realizada",
  "no-show": "no_show",
  "no show": "no_show",
  no_show: "no_show",
  "nao compareceu": "no_show",
  cancelada: "cancelada",
};

const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ----------------------------------- Time ----------------------------------- */

export type TimeComercialRow = {
  login: string;
  nome: string;
  papel: "hunter" | "cn";
  user_id: string | null;
  apelidos: string[];
  pipedrive_user_id: number | null;
  pipedrive_hunter_option_id: number | null;
  ativo: boolean;
};

export type Perfil = { id: string; email: string | null };

/** Usuário da plataforma cujo e-mail começa pelo login (augustus.rivas@...). Só com um único. */
export function usuarioDoLogin(login: string, perfis: readonly Perfil[]): string | null {
  const alvo = login.trim().toLowerCase();
  if (!alvo) return null;
  const achados = perfis.filter((p) => (p.email ?? "").toLowerCase().split("@")[0] === alvo);
  return achados.length === 1 ? achados[0]!.id : null;
}

export function linhasTime(
  time: readonly Record<string, string>[],
  perfis: readonly Perfil[],
): TimeComercialRow[] {
  return time
    .filter((t) => t["Usuário"] && t["Nome"])
    .map((t) => {
      const login = t["Usuário"]!.toLowerCase();
      return {
        login,
        nome: t["Nome"]!,
        papel: chave(t["Papel"] ?? "") === "cn" ? "cn" : "hunter",
        user_id: usuarioDoLogin(login, perfis),
        apelidos: (t["Apelidos na marcação"] ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        pipedrive_user_id: inteiro(t["ID de usuário no Pipedrive"] ?? ""),
        pipedrive_hunter_option_id: inteiro(t["ID da opção no campo Hunter"] ?? ""),
        ativo: chave(t["Ativo"] ?? "") !== "nao",
      };
    });
}

/* ------------------------------------ ATs ------------------------------------ */

export type AtCarga = {
  tipo: "diagnostico";
  origem: "planilha";
  user_id: string | null;
  hunter_login: string | null;
  cn_login: string | null;
  contact_id: string | null;
  canal: string | null;
  empresa: string;
  prospect: string;
  cargo: string | null;
  setor: string | null;
  linkedin: string | null;
  motivo_prospeccao: string | null;
  ficha_original: string | null;
  agendada_original: string;
  agendada_atual: string;
  registrada_em: string;
  pipedrive_deal_id: number;
  pipedrive_person_id: number | null;
  pipedrive_org_id: number | null;
  pipedrive_activity_at_id: number | null;
  pipedrive_activity_tp1_id: number | null;
  pipedrive_activity_tp3_id: number | null;
  pipedrive_activity_tp4_id: number | null;
};

export type EventoCarga = {
  pipedrive_deal_id: number;
  evento: AtEventoTipo;
  ocorrido_em: string;
  horario_anterior: string | null;
  horario_novo: string | null;
  motivo: string | null;
  origem: "planilha";
};

export type PlanoCarga = {
  time: TimeComercialRow[];
  ats: AtCarga[];
  eventos: EventoCarga[];
  avisos: string[];
};

export type ContatoDoHunter = ContatoParaAt & { user_id: string };

const ouNulo = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/**
 * Monta o que será gravado. Cada AT leva os eventos da aba Histórico; o que faltar para o log
 * bater com a linha da aba ATs (marcada, desfecho, horário atual) é completado e vira aviso, e o
 * resumo calculado (`resumoAt`, a mesma conta do trigger) é conferido com a planilha.
 */
export function planoDeCarga(entrada: {
  ats: readonly Record<string, string>[];
  historico: readonly Record<string, string>[];
  time: readonly Record<string, string>[];
  perfis: readonly Perfil[];
  contatos: readonly ContatoDoHunter[];
}): PlanoCarga {
  const avisos: string[] = [];
  const time = linhasTime(entrada.time, entrada.perfis);
  const pessoas: PessoaTime[] = time;
  for (const p of time) {
    if (!p.user_id) avisos.push(`Time: ${p.login} sem conta na plataforma (fica sem user_id).`);
  }
  const userDoLogin = new Map(time.map((p) => [p.login, p.user_id]));

  const ats: AtCarga[] = [];
  const eventos: EventoCarga[] = [];
  const vistos = new Set<number>();

  for (const [i, r] of entrada.ats.entries()) {
    const linha = `ATs, linha ${i + 2}`;
    const deal = inteiro(r["ID do card"] ?? "");
    if (deal === null) {
      avisos.push(`${linha}: sem ID do card, ignorada.`);
      continue;
    }
    if (vistos.has(deal)) {
      avisos.push(`${linha}: card ${deal} repetido, ignorada.`);
      continue;
    }
    vistos.add(deal);
    const tag = `Card ${deal}`;
    const registrada = dataHoraBR(r["Registrada em"] ?? "");
    const original = dataHoraBR(r["Data/hora original"] ?? "");
    const atual = dataHoraBR(r["Data/hora atual"] ?? "") ?? original;
    if (!registrada || !original || !atual) {
      avisos.push(`${tag}: data de registro ou da AT fora do formato dd/mm/aaaa hh:mm, ignorada.`);
      continue;
    }

    const hunterLogin = ouNulo(r["Hunter"])?.toLowerCase() ?? null;
    const userId = hunterLogin
      ? (userDoLogin.get(hunterLogin) ?? usuarioDoLogin(hunterLogin, entrada.perfis))
      : null;
    if (hunterLogin && !userId)
      avisos.push(`${tag}: hunter ${hunterLogin} sem conta na plataforma.`);
    const cnNome = ouNulo(r["CN"]);
    const cnLogin = cnNome ? pessoaDaMarcacao(cnNome, pessoas, "cn") : null;
    if (cnNome && !cnLogin) avisos.push(`${tag}: CN "${cnNome}" não encontrado no Time.`);

    const empresa = r["Empresa"] ?? "";
    const prospect = r["Prospect"] ?? "";
    const contactId = userId
      ? contatoDaAt(
          { prospect, empresa },
          entrada.contatos.filter((c) => c.user_id === userId),
        )
      : null;
    if (userId && !contactId)
      avisos.push(`${tag}: contato de ${prospect} não achado com segurança.`);
    if (ouNulo(r["Mensagem que converteu"])) {
      avisos.push(
        `${tag}: "Mensagem que converteu" em texto livre não tem coluna; fica só na ficha.`,
      );
    }

    ats.push({
      tipo: "diagnostico",
      origem: "planilha",
      user_id: userId,
      hunter_login: hunterLogin,
      cn_login: cnLogin,
      contact_id: contactId,
      canal: ouNulo(r["Canal"]),
      empresa,
      prospect,
      cargo: ouNulo(r["Cargo"]),
      setor: ouNulo(r["Setor (como veio)"]),
      linkedin: ouNulo(r["LinkedIn"]),
      motivo_prospeccao: ouNulo(r["Por que prospectou"]),
      ficha_original: ouNulo(r["Ficha original"]),
      agendada_original: original,
      agendada_atual: original,
      registrada_em: registrada,
      pipedrive_deal_id: deal,
      pipedrive_person_id: inteiro(r["ID da pessoa"] ?? ""),
      pipedrive_org_id: inteiro(r["ID da organização"] ?? ""),
      pipedrive_activity_at_id: inteiro(r["ID task AT"] ?? ""),
      pipedrive_activity_tp1_id: inteiro(r["ID task TP1"] ?? ""),
      pipedrive_activity_tp3_id: inteiro(r["ID task TP3"] ?? ""),
      pipedrive_activity_tp4_id: inteiro(r["ID task TP4"] ?? ""),
    });

    // Eventos da aba Histórico, na ordem em que aparecem.
    const doCard: EventoCarga[] = [];
    for (const h of entrada.historico) {
      if (inteiro(h["ID do card"] ?? "") !== deal) continue;
      const evento = EVENTO_PLANILHA[chave(h["Evento"] ?? "")];
      const quando = dataHoraBR(h["Quando"] ?? "");
      if (!evento || !quando) {
        avisos.push(
          `${tag}: evento "${h["Evento"]}" de "${h["Quando"]}" não reconhecido, ignorado.`,
        );
        continue;
      }
      const novo = dataHoraBR(h["Horário novo"] ?? "");
      if ((evento === "marcada" || evento === "remarcada") && !novo) {
        avisos.push(`${tag}: ${evento} de ${h["Quando"]} sem horário novo, ignorado.`);
        continue;
      }
      doCard.push({
        pipedrive_deal_id: deal,
        evento,
        ocorrido_em: quando,
        horario_anterior: dataHoraBR(h["Horário anterior"] ?? ""),
        horario_novo: novo,
        motivo: ouNulo(h["Motivo"]),
        origem: "planilha",
      });
    }
    if (!doCard.some((e) => e.evento === "marcada")) {
      avisos.push(`${tag}: sem "marcada" no Histórico; criada com o registro da AT.`);
      doCard.unshift({
        pipedrive_deal_id: deal,
        evento: "marcada",
        ocorrido_em: registrada,
        horario_anterior: null,
        horario_novo: original,
        motivo: null,
        origem: "planilha",
      });
    }

    // Confere o resumo do log com a linha da aba ATs e completa o que faltar.
    const comoLog = (lista: EventoCarga[]): AtEvento[] =>
      lista.map((e, n) => ({
        evento: e.evento,
        ocorrido_em: e.ocorrido_em,
        created_at: String(n).padStart(6, "0"),
        horario_novo: e.horario_novo,
      }));
    let resumo = resumoAt(comoLog(doCard));
    if (resumo.agendadaAtual !== atual) {
      avisos.push(
        `${tag}: horário atual da planilha sem remarcação no Histórico; remarcação criada.`,
      );
      doCard.push({
        pipedrive_deal_id: deal,
        evento: "remarcada",
        ocorrido_em: depoisDoUltimo(doCard, registrada),
        horario_anterior: resumo.agendadaAtual,
        horario_novo: atual,
        motivo: "Carga da planilha (sem registro no Histórico)",
        origem: "planilha",
      });
      resumo = resumoAt(comoLog(doCard));
    }
    const statusPlanilha = STATUS_PLANILHA[chave(r["Status"] ?? "")];
    if (!statusPlanilha) avisos.push(`${tag}: status "${r["Status"]}" não reconhecido.`);
    else if (statusPlanilha !== resumo.status) {
      if (statusPlanilha === "agendada") {
        avisos.push(
          `${tag}: planilha diz ${r["Status"]}, mas o Histórico termina em ${resumo.status}.`,
        );
      } else {
        avisos.push(
          `${tag}: status ${r["Status"]} sem evento no Histórico; evento criado no horário da AT.`,
        );
        doCard.push({
          pipedrive_deal_id: deal,
          evento: statusPlanilha,
          ocorrido_em: depoisDoUltimo(doCard, atual),
          horario_anterior: null,
          horario_novo: null,
          motivo: null,
          origem: "planilha",
        });
        resumo = resumoAt(comoLog(doCard));
      }
    }
    const remarcacoes = inteiro(r["Remarcações"] ?? "");
    if (remarcacoes !== null && remarcacoes !== resumo.remarcacoes) {
      avisos.push(
        `${tag}: planilha conta ${remarcacoes} remarcação(ões), o Histórico tem ${resumo.remarcacoes}.`,
      );
    }
    eventos.push(...doCard);
  }

  for (const h of entrada.historico) {
    const deal = inteiro(h["ID do card"] ?? "");
    if (deal !== null && !vistos.has(deal)) {
      avisos.push(`Histórico: card ${deal} não está na aba ATs, evento ignorado.`);
    }
  }
  return { time, ats, eventos, avisos };
}
