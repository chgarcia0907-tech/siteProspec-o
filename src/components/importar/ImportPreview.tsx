import { useState } from "react";
import { CompanySelect } from "@/components/CompanySelect";
import { PersonaSelect } from "@/components/PersonaSelect";
import { TablePagination } from "@/components/TablePagination";
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
import { paginate } from "@/lib/paginate";
import type { Persona } from "@/lib/personas";

/** Linhas por página na pré-visualização (o mesmo limite das outras tabelas). */
const PAGE_SIZE = 50;

/** Pré-visualização do que foi colado, com a empresa de cada linha e o botão de importar. */
export function ImportPreview({
  rows,
  newCount,
  companies,
  companyOf,
  onCompany,
  personaOf,
  onPersona,
  busy,
  onImport,
}: {
  rows: readonly ImportRow[];
  newCount: number;
  companies: readonly Company[];
  companyOf: (r: ImportRow) => string | null;
  onCompany: (key: string, id: string | null) => void;
  /** Persona trocada à mão na linha (`null` = continua a sugerida pelo cargo). */
  personaOf: (r: ImportRow) => Persona | null;
  onPersona: (key: string, persona: Persona) => void;
  busy: boolean;
  onImport: () => void;
}) {
  const [page, setPage] = useState(0);
  const paged = paginate([...rows], page, PAGE_SIZE);
  const duplicados = rows.filter((r) => r.duplicate).length;
  const foraDoFiltro = rows.filter((r) => !r.duplicate && r.filteredOut).length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <p className="text-caption font-bold tracking-wider text-subtle-foreground uppercase">
            Passo 2
          </p>
          <CardTitle>
            Pré-visualização — {rows.length} detectados, {newCount} novos
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Contagem tone="novo">
              {newCount} {newCount === 1 ? "novo" : "novos"}
            </Contagem>
            {duplicados > 0 && (
              <Contagem tone="duplicado">
                {duplicados} {duplicados === 1 ? "já cadastrado" : "já cadastrados"}
              </Contagem>
            )}
            {foraDoFiltro > 0 && (
              <Contagem tone="filtro">{foraDoFiltro} fora do filtro de data</Contagem>
            )}
          </div>
        </div>
        <Button disabled={newCount === 0 || busy} onClick={onImport}>
          Importar novos contatos
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-xl border">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo/Headline</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.pageRows.map((r, i) => {
                const novo = !r.duplicate && !r.filteredOut;
                return (
                  <TableRow key={`${r.name}-${page}-${i}`}>
                    <TableCell className="font-semibold text-heading">{r.name}</TableCell>
                    <TableCell
                      className="max-w-56 truncate text-muted-foreground"
                      title={r.headline}
                    >
                      {r.headline || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatBR(r.connected_at)}</TableCell>
                    <TableCell>
                      {novo && (
                        <>
                          {companies.length > 0 && (
                            <CompanySelect
                              companies={companies}
                              value={companyOf(r)}
                              onChange={(id) => onCompany(r.key, id)}
                              emptyLabel="Sem empresa"
                              className="h-8 w-40"
                            />
                          )}
                          {!companyOf(r) && (
                            <span className="block text-caption text-muted-foreground">
                              {r.companyText ? `${r.companyText.company} (do headline)` : "—"}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {novo ? (r.area ?? "—") : ""}
                    </TableCell>
                    <TableCell>
                      {novo && (
                        <PersonaSelect
                          compact
                          noBadge
                          value={personaOf(r)}
                          suggested={r.persona}
                          onChange={(p) => onPersona(r.key, p)}
                          className="w-28"
                        />
                      )}
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
        <TablePagination paged={paged} onPage={setPage} noun="conexões" />
      </CardContent>
    </Card>
  );
}

const TONE = {
  novo: "bg-success-soft text-success",
  duplicado: "border border-input text-muted-foreground",
  filtro: "bg-warning-soft text-warning-text",
} as const;

function Contagem({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}

function RowStatus({ row }: { row: ImportRow }) {
  const [tone, label] = row.duplicate
    ? (["duplicado", "Já cadastrado"] as const)
    : row.filteredOut
      ? (["filtro", row.noDate ? "Sem data — fora do filtro" : "Antes da data escolhida"] as const)
      : (["novo", "Novo"] as const);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}
