import type { Tables } from "@/integrations/supabase/types";
import { daysBetween, normName, spDay } from "./auditoria";
import { responseOriginLabel } from "./cadencia";

/* ---------------------------------- Tipos ---------------------------------- */
// Espelham as colunas de `ats` e `at_eventos` (supabase/migrations/20261118164342_*.sql) que as
// regras usam. No banco são texto com CHECK; aqui viram uniões.

export type AtStatus = "agendada" | "realizada" | "no_show" | "cancelada";
export type AtEventoTipo =
  "marcada" | "remarcada" | "reaberta" | "no_show" | "realizada" | "cancelada" | "etapa_pipedrive";

export const AT_STATUS_LABEL: Record<AtStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  no_show: "No-show",
  cancelada: "Cancelada",
};

export const AT_EVENTO_LABEL: Record<AtEventoTipo, string> = {
  marcada: "Marcada",
  remarcada: "Remarcada",
  reaberta: "Reaberta",
  no_show: "No-show",
  realizada: "Realizada",
  cancelada: "Cancelada",
  etapa_pipedrive: "Etapa no Pipedrive",
};

/** Eventos que o hunter registra pela plataforma (AT sem card no Pipedrive). */
export const AT_EVENTOS_DO_APP = ["remarcada", "no_show", "realizada", "cancelada"] as const;

export type AtEvento = {
  evento: AtEventoTipo;
  ocorrido_em: string;
  created_at: string;
  horario_novo: string | null;
  pipedrive_stage_id?: number | null;
};

export const AT_CANAIS = ["LinkedIn", "E-mail", "WhatsApp", "Cold Call", "Instagram"] as const;
export type AtCanal = (typeof AT_CANAIS)[number];

/* ------------------------------ Resumo do log ------------------------------ */

const porMaisRecente = (a: AtEvento, b: AtEvento) =>
  b.ocorrido_em.localeCompare(a.ocorrido_em) || b.created_at.localeCompare(a.created_at);

export type AtResumo = {
  status: AtStatus;
  agendadaAtual: string | null;
  pipedriveStageId: number | null;
  remarcacoes: number;
};

/**
 * Status, horário atual e número de remarcações a partir do log. Mesma regra do trigger
 * `at_eventos_apply` (cada campo sai do evento mais recente por `ocorrido_em`, então eventos
 * fora de ordem não estragam o resumo). Ao mudar uma, revise a outra.
 */
export function resumoAt(eventos: readonly AtEvento[]): AtResumo {
  const ordenados = [...eventos].sort(porMaisRecente);
  const ultimoStatus = ordenados.find((e) => e.evento !== "etapa_pipedrive");
  const ultimaAgenda = ordenados.find((e) => e.evento === "marcada" || e.evento === "remarcada");
  const ultimaEtapa = ordenados.find((e) => e.evento === "etapa_pipedrive");
  const voltaAgendada = ["marcada", "remarcada", "reaberta"];
  const status: AtStatus =
    !ultimoStatus || voltaAgendada.includes(ultimoStatus.evento)
      ? "agendada"
      : (ultimoStatus.evento as AtStatus);
  return {
    status,
    agendadaAtual: ultimaAgenda?.horario_novo ?? null,
    pipedriveStageId: ultimaEtapa?.pipedrive_stage_id ?? null,
    remarcacoes: eventos.filter((e) => e.evento === "remarcada").length,
  };
}

/** Número de remarcações por AT, a partir de todos os eventos carregados. */
export function remarcacoesPorAt(
  eventos: readonly { at_id: string; evento: AtEventoTipo }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of eventos) {
    if (e.evento === "remarcada") out.set(e.at_id, (out.get(e.at_id) ?? 0) + 1);
  }
  return out;
}

/** Status como a planilha mostrava: AT agendada que já foi remarcada aparece como "Remarcada". */
export function statusExibido(status: AtStatus, remarcacoes: number): string {
  return status === "agendada" && remarcacoes > 0 ? "Remarcada" : AT_STATUS_LABEL[status];
}

/** Dias corridos entre o registro e a data da AT (antecedência com que foi marcada). */
export function antecedenciaDias(registradaEm: string, agendada: string): number {
  return daysBetween(spDay(registradaEm), spDay(agendada));
}

/* ------------------------------- Indicadores ------------------------------- */

export type AtParaContagem = { status: AtStatus; remarcacoes: number };

export type ContagemAts = {
  total: number;
  agendadas: number;
  realizadas: number;
  noShow: number;
  canceladas: number;
  /** ATs com pelo menos uma remarcação. */
  remarcadas: number;
  /** Remarcadas que acabaram realizadas. */
  remarcadasRealizadas: number;
  /** realizadas ÷ (realizadas + no-show); null sem AT com desfecho. */
  taxaShow: number | null;
  /** no-show ÷ (realizadas + no-show); null sem AT com desfecho. */
  taxaNoShow: number | null;
  /** remarcadas ÷ total; null sem AT. */
  taxaRemarcacao: number | null;
};

export function contarAts(ats: readonly AtParaContagem[]): ContagemAts {
  const c = { agendadas: 0, realizadas: 0, noShow: 0, canceladas: 0, remarcadas: 0, rr: 0 };
  for (const a of ats) {
    if (a.status === "agendada") c.agendadas++;
    else if (a.status === "realizada") c.realizadas++;
    else if (a.status === "no_show") c.noShow++;
    else c.canceladas++;
    if (a.remarcacoes > 0) {
      c.remarcadas++;
      if (a.status === "realizada") c.rr++;
    }
  }
  const comDesfecho = c.realizadas + c.noShow;
  return {
    total: ats.length,
    agendadas: c.agendadas,
    realizadas: c.realizadas,
    noShow: c.noShow,
    canceladas: c.canceladas,
    remarcadas: c.remarcadas,
    remarcadasRealizadas: c.rr,
    taxaShow: comDesfecho ? c.realizadas / comDesfecho : null,
    taxaNoShow: comDesfecho ? c.noShow / comDesfecho : null,
    taxaRemarcacao: ats.length ? c.remarcadas / ats.length : null,
  };
}

/** Contagem por grupo (hunter, CN, canal, mensagem...), ordenada pelo total. */
export function contarAtsPor<T extends AtParaContagem>(
  ats: readonly T[],
  chave: (a: T) => string,
): { chave: string; contagem: ContagemAts }[] {
  const grupos = new Map<string, T[]>();
  for (const a of ats) {
    const k = chave(a);
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  return [...grupos]
    .map(([k, lista]) => ({ chave: k, contagem: contarAts(lista) }))
    .sort((a, b) => b.contagem.total - a.contagem.total || a.chave.localeCompare(b.chave));
}

/* --------------------------- Mensagem que converteu -------------------------- */

/** "WhatsApp 1 (WPP-IND-1)", "Outro canal" ou null quando o hunter ainda não informou. */
export function mensagemQueConverteu(c: {
  resposta_etapa: number | null;
  resposta_modelo: string | null;
}): string | null {
  if (c.resposta_etapa == null) return null;
  const etapa = responseOriginLabel(c.resposta_etapa);
  return c.resposta_modelo ? `${etapa} (${c.resposta_modelo})` : etapa;
}

/* ---------------------------------- Fichas ---------------------------------- */
// Formato das fichas do grupo de WhatsApp do comercial (o mesmo da skill criar-card):
//   Ficha de AT - {empresa}            | Ficha de Remarcação - {empresa}
//   Nome do prospect: ...              | Prospect: ...
//   Cargo / Setor / Site da empresa / LinkedIn / Canal de Contato / Data
//   Por que prospectou? {várias linhas até o @}
//   @{CN}                              | Nova data: ... / Motivo: ...
// Campos achados pelo rótulo. Na dúvida (data relativa, dois dias, rótulo ausente), fica em branco
// e o formulário pede: a ficha só preenche.

export type FichaAt = {
  tipo: "at";
  empresa: string;
  prospect: string;
  cargo: string;
  setor: string;
  site: string;
  linkedin: string;
  canal: AtCanal | null;
  /** O que veio depois do canal em "Canal de Contato" (ex.: "respondeu ao FUP 2"). */
  mensagem: string;
  /** Data e hora em Brasília (ISO com -03:00) ou null quando a ficha não deixa claro. */
  agendada: string | null;
  dataTexto: string;
  motivo: string;
  /** Texto da marcação do CN, sem o @. */
  cnMarcacao: string;
  original: string;
};

export type FichaRemarcacao = {
  tipo: "remarcacao";
  empresa: string;
  prospect: string;
  agendada: string | null;
  dataTexto: string;
  motivo: string;
  original: string;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Linha sem emoji, marcador ou espaço antes do rótulo. */
const limparInicio = (linha: string) => linha.replace(/^[^\p{L}\p{N}@]+/u, "");

const ROTULOS: Record<string, readonly string[]> = {
  prospect: ["nome do prospect", "prospect", "nome"],
  cargo: ["cargo"],
  setor: ["setor"],
  site: ["site da empresa", "site"],
  linkedin: ["linkedin"],
  canal: ["canal de contato", "canal"],
  data: ["nova data", "data"],
  motivo: ["motivo"],
};

/** Valor de "Rótulo: valor" quando a linha começa por um dos rótulos. */
function valorDoRotulo(linha: string, rotulos: readonly string[]): string | null {
  const limpa = limparInicio(linha);
  const norm = semAcento(limpa);
  for (const r of rotulos) {
    if (norm.startsWith(r)) {
      const resto = limpa.slice(r.length);
      const m = /^\s*:\s*(.*)$/.exec(resto);
      if (m) return m[1]!.trim();
    }
  }
  return null;
}

function campo(linhas: readonly string[], chave: keyof typeof ROTULOS): string {
  for (const l of linhas) {
    const v = valorDoRotulo(l, ROTULOS[chave]!);
    if (v !== null) return v;
  }
  return "";
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Data e hora da ficha em Brasília (ISO com -03:00). Aceita "20/11/2026 às 10:00", "25/11 - 14h",
 * "qui 19/11 9h30". Sem ano, usa o de `hoje`, ou o seguinte se a data ficaria mais de 60 dias no
 * passado (ficha de dezembro para janeiro). Data relativa ("amanhã", "quinta"), dois dias, sem
 * horário ou valores impossíveis devolvem null.
 */
export function dataDaFicha(texto: string, hoje: string): string | null {
  const datas = [...texto.matchAll(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g)];
  if (datas.length !== 1) return null;
  const [inteiro, d, m, a] = datas[0]!;
  const semData = texto.replace(inteiro, " ");
  const horas = [...semData.matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?!\d)/gi)];
  if (horas.length !== 1) return null;
  const dia = Number(d);
  const mes = Number(m);
  const hora = Number(horas[0]![1]);
  const min = Number(horas[0]![2] ?? 0);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || min > 59) return null;
  let ano: number;
  if (a) ano = a.length === 2 ? 2000 + Number(a) : Number(a);
  else {
    ano = Number(hoje.slice(0, 4));
    if (daysBetween(`${ano}-${pad(mes)}-${pad(dia)}`, hoje) > 60) ano++;
  }
  const iso = `${ano}-${pad(mes)}-${pad(dia)}`;
  // 31/02 e afins: o Date "anda" para o mês seguinte.
  const conf = new Date(`${iso}T12:00:00Z`);
  if (conf.getUTCMonth() + 1 !== mes || conf.getUTCDate() !== dia) return null;
  return `${iso}T${pad(hora)}:${pad(min)}:00-03:00`;
}

/** Canal e mensagem de "Canal de Contato: WhatsApp - respondeu ao FUP 2". */
export function canalDaFicha(texto: string): { canal: AtCanal | null; mensagem: string } {
  const norm = semAcento(texto);
  const canal: AtCanal | null = /linkedin/.test(norm)
    ? "LinkedIn"
    : /e-?mail/.test(norm)
      ? "E-mail"
      : /whats|wpp|zap/.test(norm)
        ? "WhatsApp"
        : /cold ?call|ligacao|telefone/.test(norm)
          ? "Cold Call"
          : /insta/.test(norm)
            ? "Instagram"
            : null;
  // A mensagem é o que sobra sem o nome do canal e sem os separadores das pontas.
  let mensagem = texto
    .replace(/linked\s?in|e-?mail|whats\s?app|wpp|zap|cold\s?call|instagram|insta/i, " ")
    .replace(/^[\s,(\-–—:]+|[\s,\-–—:]+$/g, "");
  if (mensagem.endsWith(")") && !mensagem.includes("(")) mensagem = mensagem.slice(0, -1).trim();
  return { canal, mensagem };
}

/** Lê uma Ficha de AT ou de Remarcação; null quando o texto não começa por nenhuma das duas. */
export function lerFicha(texto: string, hoje: string): FichaAt | FichaRemarcacao | null {
  const original = texto.trim();
  const linhas = original.split(/\r?\n/).map((l) => l.trim());
  const primeira = linhas.findIndex((l) => l !== "");
  if (primeira < 0) return null;
  const titulo = /^ficha de (at|remarcacao)\s*[-–—:]\s*(.+)$/i.exec(
    semAcento(limparInicio(linhas[primeira]!)),
  );
  if (!titulo) return null;
  const empresa = limparInicio(linhas[primeira]!)
    .replace(/^[^-–—:]+[-–—:]\s*/, "")
    .trim();
  const corpo = linhas.slice(primeira + 1);
  const dataTexto = campo(corpo, "data");
  const agendada = dataTexto ? dataDaFicha(dataTexto, hoje) : null;

  if (titulo[1] === "remarcacao") {
    return {
      tipo: "remarcacao",
      empresa,
      prospect: campo(corpo, "prospect"),
      agendada,
      dataTexto,
      motivo: campo(corpo, "motivo"),
      original,
    };
  }

  // "Por que prospectou?" vai até a linha com @ ou o fim da ficha.
  const iMotivo = corpo.findIndex((l) =>
    semAcento(limparInicio(l)).startsWith("por que prospectou"),
  );
  const iCn = corpo.findIndex((l) => limparInicio(l).startsWith("@") || l.startsWith("@"));
  let motivo = "";
  if (iMotivo >= 0) {
    const fim = iCn > iMotivo ? iCn : corpo.length;
    const primeiraLinha = corpo[iMotivo]!.replace(/^.*?prospectou\s*\??\s*:?\s*/i, "");
    motivo = [primeiraLinha, ...corpo.slice(iMotivo + 1, fim)]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const { canal, mensagem } = canalDaFicha(campo(corpo, "canal"));
  return {
    tipo: "at",
    empresa,
    prospect: campo(corpo, "prospect"),
    cargo: campo(corpo, "cargo"),
    setor: campo(corpo, "setor"),
    site: campo(corpo, "site"),
    linkedin: campo(corpo, "linkedin"),
    canal,
    mensagem,
    agendada,
    dataTexto,
    motivo,
    cnMarcacao: iCn >= 0 ? corpo[iCn]!.replace(/^.*?@/, "").trim() : "",
    original,
  };
}

/* ------------------------------ Pessoas e contato ----------------------------- */

export type PessoaTime = {
  login: string;
  nome: string;
  papel: "hunter" | "cn";
  apelidos: readonly string[];
  ativo: boolean;
};

/**
 * Login de quem a ficha marcou (@Sophia, @Sophia Labadaseea...), comparando com nome, login e
 * apelidos do time ativo. Só devolve quando há exatamente uma pessoa; senão null (o formulário
 * pergunta).
 */
export function pessoaDaMarcacao(
  marcacao: string,
  time: readonly PessoaTime[],
  papel?: PessoaTime["papel"],
): string | null {
  const alvo = normName(marcacao);
  if (!alvo) return null;
  const achadas = time.filter(
    (p) =>
      p.ativo &&
      (!papel || p.papel === papel) &&
      [p.nome, p.login.replace(/\./g, " "), ...p.apelidos].some((n) => normName(n) === alvo),
  );
  return achadas.length === 1 ? achadas[0]!.login : null;
}

export type ContatoParaAt = { id: string; name: string; company: string };

const mesmaEmpresa = (a: string, b: string) => {
  const x = normName(a);
  const y = normName(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

/**
 * Contato do hunter que corresponde à AT, pelo nome do prospect e pela empresa. Nome igual e
 * empresa compatível (ou vazia no contato) com um único contato; qualquer dúvida, null.
 */
export function contatoDaAt(
  at: { prospect: string; empresa: string },
  contatos: readonly ContatoParaAt[],
): string | null {
  const nome = normName(at.prospect);
  if (!nome) return null;
  const mesmoNome = contatos.filter((c) => normName(c.name) === nome);
  const compativeis = mesmoNome.filter(
    (c) => !normName(c.company) || mesmaEmpresa(c.company, at.empresa),
  );
  return compativeis.length === 1 ? compativeis[0]!.id : null;
}

/* ------------------------------- Tela de ATs ------------------------------- */

/** Linha de `ats` como a tela usa (tipos gerados do Supabase, com o status estreitado). */
export type AtRow = Omit<Tables<"ats">, "status"> & { status: AtStatus };

/** AT com o número de remarcações (contado no log) para a tabela. */
export type AtLinha = AtRow & { remarcacoes: number };

export function linhasDaTabela(
  ats: readonly AtRow[],
  eventos: readonly { at_id: string; evento: AtEventoTipo }[],
): AtLinha[] {
  const rem = remarcacoesPorAt(eventos);
  return ats
    .map((a) => ({ ...a, remarcacoes: rem.get(a.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.agendada_atual.localeCompare(a.agendada_atual) ||
        b.registrada_em.localeCompare(a.registrada_em),
    );
}

export type FiltroStatus = AtStatus | "remarcada" | "todas";

export const FILTRO_STATUS_LABEL: Record<FiltroStatus, string> = {
  todas: "Todas as situações",
  agendada: "Agendadas",
  remarcada: "Remarcadas",
  realizada: "Realizadas",
  no_show: "No-show",
  cancelada: "Canceladas",
};

export type AtFiltros = {
  busca: string;
  status: FiltroStatus;
  /** Login do hunter ou "" para todos. */
  hunter: string;
  /** Login do CN ou "" para todos. */
  cn: string;
};

export const FILTROS_VAZIOS: AtFiltros = { busca: "", status: "todas", hunter: "", cn: "" };

/** Busca por empresa ou prospect (todas as palavras, sem acento), situação, hunter e CN. */
export function filtrarAts<T extends AtLinha>(linhas: readonly T[], f: AtFiltros): T[] {
  const palavras = normName(f.busca).split(" ").filter(Boolean);
  return linhas.filter((a) => {
    const texto = normName(`${a.empresa} ${a.prospect}`);
    if (!palavras.every((p) => texto.includes(p))) return false;
    if (f.hunter && a.hunter_login !== f.hunter) return false;
    if (f.cn && a.cn_login !== f.cn) return false;
    if (f.status === "todas") return true;
    if (f.status === "remarcada") return a.remarcacoes > 0;
    return a.status === f.status;
  });
}

/**
 * Quem pode registrar remarcação, no-show etc. pela plataforma: o hunter dono ou o admin, e só em
 * AT sem card no Pipedrive (com card, o status vem da integração). Mesma regra da política
 * `at_eventos_insert_app`.
 */
export function podeRegistrarEvento(
  at: Pick<AtRow, "user_id" | "pipedrive_deal_id">,
  userId: string,
  isAdmin: boolean,
): boolean {
  return at.pipedrive_deal_id == null && (isAdmin || at.user_id === userId);
}

/** Link do card no Pipedrive. */
export const linkDoCard = (deal: number) => `https://polijunior.pipedrive.com/deal/${deal}`;

/** "2026-11-20T10:00" (campo datetime-local, horário de Brasília) → ISO com -03:00. */
export function deDatetimeLocal(v: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00-03:00` : null;
}

/** ISO qualquer → valor do campo datetime-local no horário de Brasília. */
export function paraDatetimeLocal(iso: string): string {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .replace(" ", "T")
    .slice(0, 16);
}

/** "20/11/2026 10:00" no horário de Brasília. */
export function dataHoraSP(iso: string): string {
  const [d, h] = paraDatetimeLocal(iso).split("T");
  const [a, m, dia] = d!.split("-");
  return `${dia}/${m}/${a} ${h}`;
}

export type NovaAtForm = {
  empresa: string;
  prospect: string;
  cargo: string;
  setor: string;
  linkedin: string;
  canal: AtCanal | "";
  cn: string;
  /** Valor do campo datetime-local. */
  quando: string;
  motivo: string;
  ficha: string;
};

export const NOVA_AT_VAZIA: NovaAtForm = {
  empresa: "",
  prospect: "",
  cargo: "",
  setor: "",
  linkedin: "",
  canal: "",
  cn: "",
  quando: "",
  motivo: "",
  ficha: "",
};

/** Preenche o formulário com a Ficha de AT colada; o que a ficha não traz fica como estava. */
export function formDaFicha(
  form: NovaAtForm,
  ficha: FichaAt,
  time: readonly PessoaTime[],
): NovaAtForm {
  const cn = pessoaDaMarcacao(ficha.cnMarcacao, time, "cn");
  return {
    ...form,
    empresa: ficha.empresa || form.empresa,
    prospect: ficha.prospect || form.prospect,
    cargo: ficha.cargo || form.cargo,
    setor: ficha.setor || form.setor,
    linkedin: ficha.linkedin || form.linkedin,
    canal: ficha.canal ?? form.canal,
    cn: cn ?? form.cn,
    quando: ficha.agendada ? paraDatetimeLocal(ficha.agendada) : form.quando,
    motivo: ficha.motivo || form.motivo,
    ficha: ficha.original,
  };
}

/** Motivo que impede registrar a AT, ou null. */
export function novaAtErro(f: NovaAtForm): string | null {
  if (!f.empresa.trim()) return "Informe a empresa.";
  if (!f.prospect.trim()) return "Informe o nome do prospect.";
  if (!deDatetimeLocal(f.quando)) return "Informe a data e o horário da AT.";
  return null;
}

/** Linha a inserir em `ats` pelo hunter logado (status e registro o banco carimba). */
export function novaAtLinha(
  f: NovaAtForm,
  ctx: {
    userId: string;
    hunterLogin: string | null;
    contato: { id: string; resposta_etapa: number | null; resposta_modelo: string | null } | null;
  },
) {
  const vazio = (s: string) => (s.trim() ? s.trim() : null);
  return {
    user_id: ctx.userId,
    hunter_login: ctx.hunterLogin,
    cn_login: vazio(f.cn),
    contact_id: ctx.contato?.id ?? null,
    resposta_etapa: ctx.contato?.resposta_etapa ?? null,
    resposta_modelo: ctx.contato?.resposta_modelo ?? null,
    canal: vazio(f.canal),
    empresa: f.empresa.trim(),
    prospect: f.prospect.trim(),
    cargo: vazio(f.cargo),
    setor: vazio(f.setor),
    linkedin: vazio(f.linkedin),
    motivo_prospeccao: vazio(f.motivo),
    ficha_original: vazio(f.ficha),
    agendada_original: deDatetimeLocal(f.quando)!,
  };
}

/** Login do hunter logado: o do time comercial ligado à conta, senão o começo do e-mail. */
export function loginDoUsuario(
  userId: string,
  email: string | null | undefined,
  time: readonly { login: string; user_id: string | null }[],
): string | null {
  const doTime = time.find((p) => p.user_id === userId);
  if (doTime) return doTime.login;
  const local = (email ?? "").split("@")[0]?.toLowerCase();
  return local || null;
}

export type EventoApp = (typeof AT_EVENTOS_DO_APP)[number];

export type EventoForm = { quando: string; motivo: string };

/** Motivo que impede registrar o evento, ou null. Remarcação pede nova data e motivo. */
export function eventoErro(tipo: EventoApp, f: EventoForm): string | null {
  if (tipo !== "remarcada") return null;
  if (!deDatetimeLocal(f.quando)) return "Informe a nova data e o horário.";
  if (!f.motivo.trim()) return "Informe o motivo da remarcação.";
  return null;
}

/** Linha a inserir em `at_eventos` pelo app (origem e autor o banco carimba). */
export function eventoLinha(atId: string, tipo: EventoApp, f: EventoForm) {
  return {
    at_id: atId,
    evento: tipo,
    horario_novo: tipo === "remarcada" ? deDatetimeLocal(f.quando) : null,
    motivo: f.motivo.trim() || null,
  };
}
