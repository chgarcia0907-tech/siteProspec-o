import { statusExibido, type AtStatus } from "@/lib/ats";
import { cn } from "@/lib/utils";

const CLASSE: Record<AtStatus | "remarcada", string> = {
  agendada: "bg-linkedin-soft text-linkedin",
  remarcada: "bg-warning-soft text-warning-text",
  realizada: "bg-success-soft text-success",
  no_show: "bg-destructive-soft text-destructive-text",
  cancelada: "bg-divider text-foreground",
};

/** Situação da AT; agendada que já foi remarcada aparece como "Remarcada", como na planilha. */
export function AtStatusBadge({ status, remarcacoes }: { status: AtStatus; remarcacoes: number }) {
  const chave = status === "agendada" && remarcacoes > 0 ? "remarcada" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        CLASSE[chave],
      )}
    >
      {statusExibido(status, remarcacoes)}
    </span>
  );
}
