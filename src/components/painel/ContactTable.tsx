import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleter } from "@/hooks/usePainel";
import { useSelection } from "@/hooks/useSelection";
import { STATUS_LABEL, formatBR, type ContactStatus } from "@/lib/cadencia";
import { paginate } from "@/lib/paginate";
import type { painelContacts } from "@/lib/painel.functions";
import type { Ask } from "@/components/useConfirm";

export type PainelContact = Awaited<ReturnType<typeof painelContacts>>["rows"][number];

/** Linhas por página (a busca do painel pode trazer até 2.000 contatos). */
const PAGE_SIZE = 50;

/** Tabela de contatos do painel, paginada, com exclusão individual e em lote. */
export function ContactTable({
  rows,
  names,
  ask,
  onDeleted,
}: {
  rows: PainelContact[];
  names?: Map<string, string>;
  ask: Ask;
  onDeleted?: () => void;
}) {
  const sel = useSelection();
  const deleter = useDeleter();
  const [page, setPage] = useState(0);
  const { clear } = sel;
  useEffect(() => {
    clear();
    setPage(0);
  }, [rows, clear]);
  const paged = paginate(rows, page, PAGE_SIZE);
  const all = rows.length > 0 && sel.size === rows.length;
  const hasAct = rows.some((r) => r.atividades?.length);
  const remove = (ids: string[]) => async () => {
    await deleter({ mode: "ids", ids });
    onDeleted?.();
  };

  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed border-input px-6 py-10 text-center text-dense text-muted-foreground">
        Nenhum contato.
      </div>
    );
  return (
    <div className="space-y-3">
      {sel.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/35 bg-primary-soft px-3 py-2 text-dense">
          <span className="font-semibold text-heading">{sel.size} selecionados</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              ask({
                title: "Excluir selecionados",
                desc: `${sel.size} contatos serão excluídos permanentemente.`,
                run: remove(sel.ids()),
              })
            }
          >
            Excluir selecionados
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={all}
                  onCheckedChange={(v) => (v ? sel.selectAll(rows.map((r) => r.id)) : sel.clear())}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              {names && <TableHead>Hunter</TableHead>}
              <TableHead>Contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Situação</TableHead>
              {hasAct && <TableHead>Atividade no período</TableHead>}
              <TableHead>Importado</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.pageRows.map((r) => (
              <TableRow key={r.id} data-state={sel.has(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(r.id)}
                    onCheckedChange={() => sel.toggle(r.id)}
                    aria-label={`Selecionar ${r.name}`}
                  />
                </TableCell>
                {names && (
                  <TableCell className="whitespace-nowrap">{names.get(r.user_id) ?? "—"}</TableCell>
                )}
                <TableCell className="max-w-64">
                  <p className="truncate font-semibold text-heading">{r.name}</p>
                  <p className="truncate text-caption text-muted-foreground" title={r.headline}>
                    {r.headline || "—"}
                  </p>
                </TableCell>
                <TableCell>{r.company || "—"}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {r.phone || "—"}
                </TableCell>
                <TableCell>
                  {r.status in STATUS_LABEL ? (
                    <StatusBadge status={r.status as ContactStatus} />
                  ) : (
                    r.status
                  )}
                </TableCell>
                {hasAct && (
                  <TableCell className="text-caption text-muted-foreground">
                    {(r.atividades ?? [])
                      .map((a) => a.replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2"))
                      .join(" · ")}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatBR(r.created_at.slice(0, 10))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="destructive-ghost"
                    aria-label={`Excluir ${r.name}`}
                    onClick={() =>
                      ask({
                        title: "Excluir contato",
                        desc: `"${r.name}" será excluído permanentemente.`,
                        run: remove([r.id]),
                      })
                    }
                  >
                    <Trash2 strokeWidth={1.75} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination paged={paged} onPage={setPage} noun="contatos" />
    </div>
  );
}
