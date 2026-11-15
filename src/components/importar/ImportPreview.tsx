import { CompanySelect } from "@/components/CompanySelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBR } from "@/lib/cadencia";
import type { Company } from "@/lib/empresas";
import type { ImportRow } from "@/lib/importar";

/** Pré-visualização do que foi colado, com a empresa de cada linha e o botão de importar. */
export function ImportPreview({
  rows,
  newCount,
  companies,
  companyOf,
  onCompany,
  busy,
  onImport,
}: {
  rows: readonly ImportRow[];
  newCount: number;
  companies: readonly Company[];
  companyOf: (r: ImportRow) => string | null;
  onCompany: (key: string, id: string | null) => void;
  busy: boolean;
  onImport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Pré-visualização — {rows.length} detectados, {newCount} novos
        </CardTitle>
        <Button disabled={newCount === 0 || busy} onClick={onImport}>
          Importar novos contatos
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo/Headline</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const novo = !r.duplicate && !r.filteredOut;
                return (
                  <TableRow key={`${r.name}-${i}`}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="max-w-[520px] truncate text-muted-foreground">
                      {r.headline || "—"}
                    </TableCell>
                    <TableCell>{formatBR(r.connected_at)}</TableCell>
                    <TableCell>
                      {novo && (
                        <>
                          {companies.length > 0 && (
                            <CompanySelect
                              companies={companies}
                              value={companyOf(r)}
                              onChange={(id) => onCompany(r.key, id)}
                              emptyLabel="Sem empresa cadastrada"
                              className="w-44"
                            />
                          )}
                          {!companyOf(r) && (
                            <span className="block text-xs text-muted-foreground">
                              {r.companyText ? `${r.companyText.company} (do headline)` : "—"}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {novo ? (r.area ?? "—") : ""}
                    </TableCell>
                    <TableCell>
                      <RowStatus row={r} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RowStatus({ row }: { row: ImportRow }) {
  if (row.duplicate)
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
        Já cadastrado
      </span>
    );
  if (row.filteredOut)
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
        {row.noDate ? "Sem data — fora do filtro" : "Antes da data escolhida"}
      </span>
    );
  return (
    <span className="rounded-full bg-whatsapp-soft px-2 py-0.5 text-caption font-medium text-whatsapp">
      Novo
    </span>
  );
}
