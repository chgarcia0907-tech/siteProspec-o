import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Selection } from "@/hooks/useSelection";
import type { Contact, ContactStatus, Holidays, Offsets } from "@/lib/cadencia";
import { cadenceMarks, nextSend } from "@/lib/contatos";
import type { Company } from "@/lib/empresas";
import { ContactEditDialog } from "./ContactEditDialog";
import { ContactRow } from "./ContactRow";

const COLS = 9;

/** Tabela de contatos (9 colunas) com seleção e o editor de cada contato. */
export function ContactsTable({
  rows,
  allIds,
  isLoading,
  offsets,
  holidays,
  today,
  companies,
  sectorName,
  selection,
  onPatch,
  onStatus,
}: {
  /** Linhas da página atual. */
  rows: Contact[];
  /** Todos os contatos do filtro atual ("selecionar todos" vale para eles, não só a página). */
  allIds: string[];
  isLoading: boolean;
  offsets: Offsets;
  holidays: Holidays;
  today: string;
  companies: readonly Company[];
  /** Nome do setor (ramo) de cada empresa cadastrada, por id da empresa. */
  sectorName: ReadonlyMap<string, string>;
  selection: Selection;
  onPatch: (c: Contact, changes: Partial<Contact>) => void;
  onStatus: (c: Contact, s: ContactStatus) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = rows.find((r) => r.id === editingId) ?? null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table className="table-dense">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allIds.length > 0 && selection.size === allIds.length}
                onCheckedChange={(v) => (v ? selection.selectAll(allIds) : selection.clear())}
                aria-label={`Selecionar todos os contatos do filtro (${allIds.length})`}
              />
            </TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Cadência</TableHead>
            <TableHead>Próximo envio</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={COLS} className="text-muted-foreground">
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">
                Nenhum contato. Use a tela “Importar conexões”.
              </TableCell>
            </TableRow>
          )}
          {rows.map((c) => {
            const next = nextSend(c, offsets, holidays, today);
            return (
              <ContactRow
                key={c.id}
                contact={c}
                sectorName={c.company_id ? (sectorName.get(c.company_id) ?? null) : null}
                next={next}
                marks={cadenceMarks(c, next)}
                selected={selection.has(c.id)}
                onToggle={() => selection.toggle(c.id)}
                onEdit={() => setEditingId(c.id)}
              />
            );
          })}
        </TableBody>
      </Table>
      {editing && (
        <ContactEditDialog
          contact={editing}
          offsets={offsets}
          holidays={holidays}
          companies={companies}
          onPatch={(changes) => onPatch(editing, changes)}
          onStatus={(s) => onStatus(editing, s)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
