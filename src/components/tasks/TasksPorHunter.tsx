import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LinhaHunter } from "@/lib/tasksHunter";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const cards = (n: number) => (n === 1 ? "1 card" : `${n} cards`);

/** Tabela do admin: uma linha por hunter; clicar no nome filtra a tela por ele. */
export function TasksPorHunter({
  linhas,
  nomeDe,
  selecionado,
  onSelecionar,
}: {
  linhas: readonly LinhaHunter[];
  nomeDe: (login: string) => string;
  selecionado: string | null;
  onSelecionar: (login: string | null) => void;
}) {
  return (
    <section aria-label="Tasks por hunter" className="space-y-2">
      <h2 className="text-section font-semibold text-heading">Por hunter</h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Hunter</TableHead>
              <TableHead className="text-right">AT Diag. Agendada</TableHead>
              <TableHead className="text-right">AT Diag. Realizada</TableHead>
              <TableHead className="text-right">Abertas</TableHead>
              <TableHead className="text-right">Atrasadas</TableHead>
              <TableHead className="text-right">Vencem hoje</TableHead>
              <TableHead className="text-right">No prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum card do NTec nessas etapas.
                </TableCell>
              </TableRow>
            )}
            {linhas.map(({ hunter, contagem: c }) => (
              <TableRow key={hunter} className={cn(selecionado === hunter && "bg-primary-soft")}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onSelecionar(selecionado === hunter ? null : hunter)}
                    aria-pressed={selecionado === hunter}
                    className="font-semibold text-heading underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {nomeDe(hunter)}
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">{cards(c.cards[108])}</TableCell>
                <TableCell className="text-right tabular-nums">{cards(c.cards[31])}</TableCell>
                <TableCell className="text-right tabular-nums">{c.abertas}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    c.atrasadas > 0 && "font-semibold text-destructive-text",
                  )}
                >
                  {c.atrasadas}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.hoje}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.taxaNoPrazo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
