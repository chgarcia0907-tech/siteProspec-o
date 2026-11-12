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
import {
  STEPS,
  type Contact,
  type ContactStatus,
  type Holidays,
  type Offsets,
} from "@/lib/cadencia";
import { ContactRow } from "./ContactRow";

const COLS = STEPS.length + 10;

/** Tabela de contatos com seleção, edição inline e marcação das etapas. */
export function ContactsTable({
  rows,
  isLoading,
  offsets,
  holidays,
  selection,
  onPatch,
  onStatus,
}: {
  rows: Contact[];
  isLoading: boolean;
  offsets: Offsets;
  holidays: Holidays;
  selection: Selection;
  onPatch: (c: Contact, changes: Partial<Contact>) => void;
  onStatus: (c: Contact, s: ContactStatus) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table className="table-dense">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={rows.length > 0 && selection.size === rows.length}
                onCheckedChange={(v) =>
                  v ? selection.selectAll(rows.map((r) => r.id)) : selection.clear()
                }
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Cargo/Headline</TableHead>
            <TableHead>Cargo na empresa</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Telefone/WhatsApp</TableHead>
            <TableHead>Conexão</TableHead>
            {STEPS.map((s) => (
              <TableHead key={s.n}>{s.label}</TableHead>
            ))}
            <TableHead>Situação</TableHead>
            <TableHead>Funil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={COLS} className="text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLS} className="text-muted-foreground">
                Nenhum contato. Use a tela “Importar conexões”.
              </TableCell>
            </TableRow>
          )}
          {rows.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              offsets={offsets}
              holidays={holidays}
              selected={selection.has(c.id)}
              onToggle={() => selection.toggle(c.id)}
              onPatch={(changes) => onPatch(c, changes)}
              onStatus={(s) => onStatus(c, s)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
