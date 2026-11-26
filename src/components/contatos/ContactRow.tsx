import { CalendarClock, Pencil } from "lucide-react";
import { FunnelBadge } from "@/components/Funnel";
import { PersonaSelect } from "@/components/PersonaSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { STEPS, computedStatus, formatBR, funnelIndex, type Contact } from "@/lib/cadencia";
import type { NextSend, StepMark } from "@/lib/contatos";
import { contactPersona, type Persona } from "@/lib/personas";
import { cn } from "@/lib/utils";

/** "2026-11-06" → "06/11". */
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const MARK_LABEL: Record<StepMark, string> = {
  enviada: "enviada",
  proxima: "próxima",
  atrasada: "atrasada",
  futura: "a enviar",
  dispensada: "sem WhatsApp",
};

/**
 * Linha de um contato (DESIGN.md, seção 7): só leitura, com as 9 colunas. A edição detalhada
 * abre pelo botão de editar, no fim da linha.
 */
export function ContactRow({
  contact: c,
  sectorName,
  next,
  marks,
  selected,
  onToggle,
  onEdit,
  onPersona,
  retomada,
  retomadaAtrasada,
  onRetomada,
}: {
  contact: Contact;
  /** Setor (ramo) da empresa cadastrada, quando o contato está vinculado a uma. */
  sectorName: string | null;
  next: NextSend | null;
  marks: StepMark[];
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /** Grava a persona escolhida (confirma a sugerida). */
  onPersona: (persona: Persona) => void;
  /** Texto do selo de retomada ("Retomar em 10/12"); vazio quando não está para retomar. */
  retomada: string;
  retomadaAtrasada: boolean;
  onRetomada: () => void;
}) {
  const { persona, suggested } = contactPersona(c);
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Selecionar ${c.name}`}
        />
      </TableCell>
      <TableCell className="max-w-44">
        <p className="truncate font-semibold text-heading">{c.name}</p>
        <p className="truncate text-caption text-muted-foreground" title={c.headline}>
          {c.job_title.trim() || c.headline || "Sem cargo"}
        </p>
      </TableCell>
      <TableCell className="max-w-48">
        <p className="truncate text-foreground">{c.company.trim() || "—"}</p>
        {c.company.trim() && (
          <p className="truncate text-caption text-subtle-foreground">
            {c.company_id ? (sectorName ?? "empresa cadastrada") : "texto livre"}
          </p>
        )}
      </TableCell>
      <TableCell>
        <p className="whitespace-nowrap text-muted-foreground">{c.sector || "—"}</p>
        <PersonaSelect
          compact
          noBadge
          value={suggested ? null : persona}
          suggested={persona}
          onChange={onPersona}
          className="mt-1 w-28"
        />
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
        {c.phone || "—"}
      </TableCell>
      <TableCell>
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`Cadência: ${STEPS.map((s, i) => `${s.label} ${MARK_LABEL[marks[i]!]}`).join(", ")}`}
        >
          {STEPS.map((s, i) => {
            const m = marks[i]!;
            const sent = c[s.sentField] as string | null;
            return (
              <span
                key={s.n}
                title={`${s.label}: ${sent ? `enviada em ${formatBR(sent)}` : MARK_LABEL[m]}`}
                className={cn(
                  "size-3 rounded-full border-2",
                  m === "enviada" &&
                    (s.channel === "linkedin"
                      ? "border-linkedin bg-linkedin"
                      : "border-whatsapp bg-whatsapp"),
                  m === "proxima" &&
                    (s.channel === "linkedin" ? "border-linkedin" : "border-whatsapp"),
                  m === "atrasada" && "border-destructive",
                  m === "futura" && "border-divider",
                  m === "dispensada" && "border-dashed border-divider opacity-50",
                )}
              />
            );
          })}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {!next ? (
          <span className="text-subtle-foreground">—</span>
        ) : (
          <>
            <p className={cn("text-heading", next.late && "text-destructive-text")}>
              {next.date ? ddmm(next.date) : "Sem data"}
              {next.late && <span className="ml-1 text-caption">atrasado</span>}
            </p>
            <p className="text-caption text-subtle-foreground">{next.step.label}</p>
          </>
        )}
      </TableCell>
      <TableCell>
        {funnelIndex(c) >= 0 ? (
          <FunnelBadge contact={c} />
        ) : (
          <StatusBadge status={computedStatus(c)} />
        )}
        {retomada && (
          <span
            className={cn(
              "mt-1 block w-fit rounded-sm px-1.5 py-0.5 text-caption font-semibold",
              retomadaAtrasada
                ? "bg-warning-soft text-warning-text"
                : "bg-primary-soft text-primary-text-strong",
            )}
            title={c.retomar_motivo ?? undefined}
          >
            {retomada}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button
          size="icon"
          variant="ghost"
          onClick={onRetomada}
          aria-label={`Retomar ${c.name} depois`}
          title="Retomar depois"
        >
          <CalendarClock strokeWidth={1.75} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${c.name}`}>
          <Pencil strokeWidth={1.75} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
