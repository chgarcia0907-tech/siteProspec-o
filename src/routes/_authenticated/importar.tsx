import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CompanySelect } from "@/components/CompanySelect";
import { useCompanies, useContacts, useImportContacts } from "@/hooks/useCadencia";
import { formatBR, normalizeKey, parseLinkedInConnections } from "@/lib/cadencia";
import { jobTitleFromHeadline } from "@/lib/cadencia";
import { matchCompany } from "@/lib/empresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar conexões — Cadência Outbound" },
      {
        name: "description",
        content: "Cole a lista de conexões aceitas do LinkedIn e importe os novos contatos.",
      },
      { property: "og:title", content: "Importar conexões" },
      {
        property: "og:description",
        content: "Cole a lista de conexões aceitas do LinkedIn e importe os novos contatos.",
      },
    ],
  }),
  component: Importar,
});

function Importar() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();
  /** Empresa escolhida à mão por linha (sobrepõe a sugestão pelo headline). */
  const [chosen, setChosen] = useState<Record<string, string | null>>({});
  const importMutation = useImportContacts();

  const existing = useMemo(
    () => new Set((contacts ?? []).map((c) => normalizeKey(c.name, c.headline))),
    [contacts],
  );

  const parsed = useMemo(() => parseLinkedInConnections(text), [text]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return parsed.map((p) => {
      const key = normalizeKey(p.name, p.headline);
      const duplicate = existing.has(key) || seen.has(key);
      seen.add(key);
      const noDate = fromDate !== "" && !p.connected_at;
      const filteredOut =
        noDate || (fromDate !== "" && !!p.connected_at && p.connected_at < fromDate);
      const suggested = matchCompany(p.headline, companies ?? [])?.id ?? null;
      return { ...p, key, duplicate, filteredOut, noDate, suggested };
    });
  }, [parsed, existing, fromDate, companies]);
  const companyOf = (r: { key: string; suggested: string | null }) =>
    r.key in chosen ? (chosen[r.key] ?? null) : r.suggested;

  const toImport = rows.filter((r) => !r.duplicate && !r.filteredOut);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar conexões</h1>
        <p className="text-sm text-muted-foreground">
          Copie a página de conexões do LinkedIn (Ctrl+A, Ctrl+C) e cole abaixo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Texto copiado do LinkedIn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={12}
            className="font-mono text-xs"
            placeholder={
              "Foto do perfil de Kenny Tan Mei\nKenny Tan Mei\nGraduando em Engenharia Elétrica\nConexão feita em 28 de setembro de 2026\nMensagem"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from">Importar apenas conexões feitas a partir de</Label>
              <Input
                id="from"
                type="date"
                className="w-48"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <Button variant="ghost" onClick={() => setFromDate("")}>
              Sem filtro de data
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Pré-visualização — {rows.length} detectados, {toImport.length} novos
            </CardTitle>
            <Button
              disabled={toImport.length === 0 || importMutation.isPending}
              onClick={() =>
                importMutation.mutate(
                  toImport.map((r) => ({
                    name: r.name,
                    headline: r.headline,
                    job_title: jobTitleFromHeadline(r.headline),
                    connected_at: r.connected_at,
                    company_id: companyOf(r),
                  })),
                  {
                    onSuccess: (n) => {
                      toast.success(`${n} contatos importados`);
                      setText("");
                      setChosen({});
                      navigate({ to: "/contatos" });
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
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
                    {!!companies?.length && <TableHead>Empresa</TableHead>}
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.name}-${i}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="max-w-[520px] truncate text-muted-foreground">
                        {r.headline || "—"}
                      </TableCell>
                      <TableCell>{formatBR(r.connected_at)}</TableCell>
                      {!!companies?.length && (
                        <TableCell>
                          {!r.duplicate && !r.filteredOut && (
                            <CompanySelect
                              companies={companies}
                              value={companyOf(r)}
                              onChange={(id) => setChosen((m) => ({ ...m, [r.key]: id }))}
                              emptyLabel="Sem empresa"
                              className="w-44"
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {r.duplicate ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Já cadastrado
                          </span>
                        ) : r.filteredOut ? (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                            {r.noDate ? "Sem data — fora do filtro" : "Antes da data escolhida"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-whatsapp-soft px-2 py-0.5 text-[11px] font-medium text-whatsapp">
                            Novo
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
