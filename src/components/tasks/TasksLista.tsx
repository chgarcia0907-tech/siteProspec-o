import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { linkDoCard } from "@/lib/ats";
import { formatBR } from "@/lib/cadencia";
import { NOME_ETAPA_TASKS, type TaskDaLista } from "@/lib/tasksHunter";
import { cn } from "@/lib/utils";

function Situacao({ t }: { t: TaskDaLista }) {
  const [texto, classe] =
    t.situacao === "atrasada"
      ? [
          t.diasAtraso === 1 ? "Atrasada 1 dia" : `Atrasada ${t.diasAtraso} dias`,
          "bg-destructive-soft text-destructive-text",
        ]
      : t.situacao === "hoje"
        ? ["Vence hoje", "bg-warning-soft text-warning-text"]
        : t.situacao === "sem_data"
          ? ["Sem data", "border border-input text-muted-foreground"]
          : ["No prazo", "bg-success-soft text-success"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        classe,
      )}
    >
      {texto}
    </span>
  );
}

/** Tasks abertas do filtro, atrasadas primeiro. */
export function TasksLista({
  tasks,
  mostrarHunter,
  nomeDe,
}: {
  tasks: readonly TaskDaLista[];
  mostrarHunter: boolean;
  nomeDe: (login: string) => string;
}) {
  const cols = mostrarHunter ? 6 : 5;
  return (
    <section aria-label="Tasks abertas" className="space-y-2">
      <h2 className="text-section font-semibold text-heading">Tasks abertas</h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Situação</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Etapa</TableHead>
              {mostrarHunter && <TableHead>Hunter</TableHead>}
              <TableHead>Vence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
                  Nenhuma task aberta neste filtro.
                </TableCell>
              </TableRow>
            )}
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Situacao t={t} />
                </TableCell>
                <TableCell className="text-heading">{t.assunto}</TableCell>
                <TableCell>
                  <a
                    href={linkDoCard(t.card)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    {t.cardTitulo}
                    <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                  </a>
                </TableCell>
                <TableCell className="whitespace-nowrap">{NOME_ETAPA_TASKS[t.etapa]}</TableCell>
                {mostrarHunter && <TableCell>{nomeDe(t.hunter)}</TableCell>}
                <TableCell className="whitespace-nowrap tabular-nums">
                  {t.vence ? formatBR(t.vence) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
