// Retomada (fase 4 da dashboard de outbound): o prospect pediu para ser procurado depois. O hunter
// marca a data (e o motivo), o contato aparece na fila "Retomadas" de Envios de hoje nesse dia e,
// ao falar com ele, o hunter registra "Retomei o contato". Não reinicia a cadência nem muda a
// situação; o contato mantém a safra original. Carimbos pelo trigger `stamp_retomada`.
import { addDaysISO, formatBR, type Contact } from "./cadencia";

export type RetomadaCampos = Pick<Contact, "retomar_em" | "retomar_motivo" | "retomado_em">;

export const MOTIVO_MAX = 300;

/** Está para retomar: tem data combinada e ainda não foi retomado. */
export const retomadaPendente = (c: Pick<Contact, "retomar_em" | "retomado_em">) =>
  !!c.retomar_em && !c.retomado_em;

/** Entra na fila do dia: pendente com a data até hoje. */
export const retomadaDoDia = (c: Pick<Contact, "retomar_em" | "retomado_em">, hoje: string) =>
  retomadaPendente(c) && c.retomar_em! <= hoje;

/** Dias corridos de atraso (0 = é hoje). */
export function diasDeAtraso(c: Pick<Contact, "retomar_em">, hoje: string): number {
  if (!c.retomar_em || c.retomar_em >= hoje) return 0;
  let n = 0;
  for (let d = c.retomar_em; d < hoje; d = addDaysISO(d, 1)) n++;
  return n;
}

/** Fila "Retomadas" do dia: as mais atrasadas primeiro, depois por nome. */
export function retomadasDoDia<C extends Pick<Contact, "retomar_em" | "retomado_em" | "name">>(
  contatos: readonly C[],
  hoje: string,
): C[] {
  return contatos
    .filter((c) => retomadaDoDia(c, hoje))
    .sort(
      (a, b) => a.retomar_em!.localeCompare(b.retomar_em!) || a.name.localeCompare(b.name, "pt-BR"),
    );
}

/** Erro ao marcar a retomada, ou null. A data é obrigatória e não pode ser antes de hoje. */
export function erroRetomada(data: string, motivo: string, hoje: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Escolha o dia para retomar o contato.";
  if (data < hoje) return "O dia para retomar não pode ser antes de hoje.";
  if (motivo.trim().length > MOTIVO_MAX) return `O motivo tem no máximo ${MOTIVO_MAX} caracteres.`;
  return null;
}

/** Alteração para marcar (ou trocar a data da) retomada. */
export const marcarRetomada = (data: string, motivo: string): Partial<RetomadaCampos> => ({
  retomar_em: data,
  retomar_motivo: motivo.trim() || null,
});

/** Alteração para registrar que o hunter retomou o contato. */
export const concluirRetomada = (agora = new Date()): Partial<RetomadaCampos> => ({
  retomado_em: agora.toISOString(),
});

/** Alteração para desmarcar (o trigger limpa motivo e carimbos). */
export const desmarcarRetomada = (): Partial<RetomadaCampos> => ({ retomar_em: null });

/** Texto curto do selo: "Retomar em 10/12" ou "Retomar: atrasada 3 dias". */
export function textoRetomada(
  c: Pick<Contact, "retomar_em" | "retomado_em">,
  hoje: string,
): string {
  if (!retomadaPendente(c)) return "";
  const atraso = diasDeAtraso(c, hoje);
  if (atraso > 0) return `Retomar: atrasada ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
  if (c.retomar_em === hoje) return "Retomar hoje";
  return `Retomar em ${formatBR(c.retomar_em).slice(0, 5)}`;
}
