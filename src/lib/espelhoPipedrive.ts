// Cópia dos cards do Pipedrive (fase 5 da dashboard de outbound): regras puras para decidir quais
// cards entram, transformar card, tasks e histórico de etapas em linhas do banco e saber quando
// um card precisa ser sincronizado de novo. O servidor (`pipedrive.server.ts`) busca pela API e
// grava o que estas funções devolverem.
import type { TablesInsert } from "@/integrations/supabase/types";
import { porteDoPipedrive } from "./empresas";
import { ETAPAS_AVANCO, isoDoPipedrive, type PdActivity } from "./pipedrive";
import { CAMPO_HUNTER, ETIQUETA_NTEC } from "./tasksHunter";

/** Funil "Vendas (CN)". */
export const FUNIL_NTEC = 6;
/** Campo "Canal de Entrada" do card e a opção "Outbound". */
export const CAMPO_CANAL_ENTRADA = "97d0502cc2b489986844a93b374656e5acf179e1";
export const OPCAO_OUTBOUND = 28;
/** Campo "Número de Funcionários" do card (faixas iguais a `companies.porte`). */
export const CAMPO_FUNCIONARIOS = "0b2be49fb7615b170878d944a7cb05f6ec8f9e27";
/** Campo "Cargo" da pessoa. */
export const CAMPO_CARGO_PESSOA = "54dfa4cb1118103bebc367d6e0ae574df374d478";

/** Card como a API v2 devolve (só o que a cópia usa). */
export type PdCard = {
  id: number;
  title?: string | null;
  pipeline_id?: number | null;
  stage_id: number;
  status: string;
  value?: number | null;
  currency?: string | null;
  lost_reason?: string | null;
  add_time?: string | null;
  update_time?: string | null;
  stage_change_time?: string | null;
  won_time?: string | null;
  lost_time?: string | null;
  person_id?: number | null;
  org_id?: number | null;
  label_ids?: number[] | null;
  custom_fields?: Record<string, unknown> | null;
};

/** Item do histórico do card (API v1, `/deals/{id}/flow`). */
export type PdFluxo = {
  object?: string;
  timestamp?: string;
  data?: {
    field_key?: string;
    old_value?: string | number | null;
    new_value?: string | number | null;
    log_time?: string;
  } | null;
};

/** Opções de um campo de seleção: id → rótulo. */
export type Opcoes = ReadonlyMap<number, string>;

/** Id da opção num campo de seleção (algumas respostas trazem `{ id, label }`). */
function opcao(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  if (v && typeof v === "object" && "id" in v && typeof (v as { id: unknown }).id === "number")
    return (v as { id: number }).id;
  return null;
}

/** Card do outbound NTec: funil 6, etiqueta NTec e Canal de Entrada "Outbound". */
export function ehCardOutbound(d: PdCard): boolean {
  return (
    d.pipeline_id === FUNIL_NTEC &&
    (d.label_ids ?? []).includes(ETIQUETA_NTEC) &&
    opcao(d.custom_fields?.[CAMPO_CANAL_ENTRADA]) === OPCAO_OUTBOUND
  );
}

/** O card mudou desde a última cópia (ou ainda não foi copiado)? */
export function precisaSincronizar(
  d: Pick<PdCard, "update_time">,
  copia: { update_time: string | null } | undefined,
): boolean {
  if (!copia) return true;
  return isoDoPipedrive(d.update_time) !== isoDoPipedrive(copia.update_time);
}

const STATUS = new Set(["open", "won", "lost", "deleted"]);

/** Linha de `pd_cards`. "Nenhum" no campo Hunter vira null. */
export function linhaDoCard(
  d: PdCard,
  opcoes: { hunter: Opcoes; canal: Opcoes; funcionarios: Opcoes },
  cargo: string | null,
  outbound: boolean,
  agora = new Date(),
): TablesInsert<"pd_cards"> {
  const rotulo = (m: Opcoes, campo: string) => {
    const id = opcao(d.custom_fields?.[campo]);
    return id === null ? null : (m.get(id) ?? null);
  };
  const hunter = rotulo(opcoes.hunter, CAMPO_HUNTER);
  return {
    deal_id: d.id,
    titulo: d.title ?? "",
    pipeline_id: d.pipeline_id ?? null,
    stage_id: d.stage_id,
    status: STATUS.has(d.status) ? d.status : "open",
    valor: d.value ?? null,
    moeda: d.currency ?? null,
    lost_reason: d.lost_reason?.trim() || null,
    add_time: isoDoPipedrive(d.add_time),
    update_time: isoDoPipedrive(d.update_time),
    stage_change_time: isoDoPipedrive(d.stage_change_time),
    won_time: isoDoPipedrive(d.won_time),
    lost_time: isoDoPipedrive(d.lost_time),
    hunter_login: hunter && hunter !== "Nenhum" ? hunter : null,
    canal_entrada: rotulo(opcoes.canal, CAMPO_CANAL_ENTRADA),
    porte: porteDoPipedrive(rotulo(opcoes.funcionarios, CAMPO_FUNCIONARIOS)),
    person_id: d.person_id ?? null,
    org_id: d.org_id ?? null,
    cargo: cargo?.trim() || null,
    etiquetas: d.label_ids ?? [],
    outbound,
    sincronizado_em: agora.toISOString(),
  };
}

export type Etapa = { stage_id: number; entrou_em: string; saiu_em: string | null };

/**
 * Passagens do card pelas etapas, a partir das mudanças de `stage_id` no histórico. A primeira
 * etapa começa na criação do card (a de antes da primeira mudança, ou a atual se nunca mudou); a
 * última fica aberta (`saiu_em` null), mesmo com o card ganho ou perdido.
 */
export function etapasDoFluxo(
  d: Pick<PdCard, "stage_id" | "add_time">,
  fluxo: readonly PdFluxo[],
): Etapa[] {
  const mudancas = fluxo
    .filter((f) => f.object === "dealChange" && f.data?.field_key === "stage_id")
    .map((f) => ({
      de: Number(f.data!.old_value),
      para: Number(f.data!.new_value),
      quando: isoDoPipedrive(f.data!.log_time ?? f.timestamp),
    }))
    .filter((m) => m.quando && Number.isFinite(m.para))
    .sort((a, b) => a.quando!.localeCompare(b.quando!));
  const inicio = isoDoPipedrive(d.add_time) ?? mudancas[0]?.quando ?? new Date(0).toISOString();
  const primeira =
    mudancas.length && Number.isFinite(mudancas[0]!.de) ? mudancas[0]!.de : d.stage_id;
  const out: Etapa[] = [{ stage_id: primeira, entrou_em: inicio, saiu_em: null }];
  for (const m of mudancas) {
    const atual = out[out.length - 1]!;
    if (m.para === atual.stage_id) continue;
    const quando = m.quando! < atual.entrou_em ? atual.entrou_em : m.quando!;
    atual.saiu_em = quando;
    out.push({ stage_id: m.para, entrou_em: quando, saiu_em: null });
  }
  // Duas linhas com a mesma entrada e a mesma etapa violariam a chave: a mais recente vence.
  const vistas = new Set<string>();
  return out
    .reverse()
    .filter((e) => {
      const k = `${e.entrou_em}|${e.stage_id}`;
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })
    .reverse();
}

/** Linha de `pd_tasks` (sem as tasks apagadas). */
export function linhaDaTask(
  a: PdActivity & { type?: string | null },
  dealId: number,
  hunter: string | null,
): TablesInsert<"pd_tasks"> | null {
  if (a.is_deleted) return null;
  return {
    activity_id: a.id,
    deal_id: dealId,
    assunto: a.subject ?? "",
    tipo: a.type ?? null,
    due_date: a.due_date?.slice(0, 10) ?? null,
    done: !!a.done,
    marked_as_done_time: isoDoPipedrive(a.marked_as_done_time),
    add_time: isoDoPipedrive(a.add_time),
    hunter_login: hunter,
  };
}

/** A AT do card avançou em algum momento: passou por AT de Aprofundamento ou além, ou foi ganha. */
export function avancouNoHistorico(
  etapas: readonly Pick<Etapa, "stage_id">[],
  status: string | null | undefined,
): boolean {
  return status === "won" || etapas.some((e) => ETAPAS_AVANCO.has(e.stage_id));
}
