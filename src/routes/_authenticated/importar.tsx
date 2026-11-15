import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImportPreview } from "@/components/importar/ImportPreview";
import { PasteCard } from "@/components/importar/PasteCard";
import { useCompanies, useContacts, useImportContacts } from "@/hooks/useCadencia";
import { normalizeKey, parseLinkedInConnections } from "@/lib/cadencia";
import { buildImportRows, importPayload, importable, type ImportRow } from "@/lib/importar";
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
  const rows = useMemo(
    () => buildImportRows(parsed, existing, fromDate, companies ?? []),
    [parsed, existing, fromDate, companies],
  );
  const toImport = importable(rows);
  const companyOf = (r: ImportRow) => (r.key in chosen ? (chosen[r.key] ?? null) : r.suggested);

  function runImport() {
    importMutation.mutate(
      toImport.map((r) => importPayload(r, companyOf(r))),
      {
        onSuccess: (n) => {
          toast.success(`${n} contatos importados`);
          setText("");
          setChosen({});
          navigate({ to: "/contatos" });
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar conexões</h1>
        <p className="text-sm text-muted-foreground">
          Copie a página de conexões do LinkedIn (Ctrl+A, Ctrl+C) e cole abaixo. Empresa e área são
          sugeridas pelo headline; o que não der para descobrir fica em branco.
        </p>
      </div>
      <PasteCard text={text} onText={setText} fromDate={fromDate} onFromDate={setFromDate} />
      {rows.length > 0 && (
        <ImportPreview
          rows={rows}
          newCount={toImport.length}
          companies={companies ?? []}
          companyOf={companyOf}
          onCompany={(key, id) => setChosen((m) => ({ ...m, [key]: id }))}
          busy={importMutation.isPending}
          onImport={runImport}
        />
      )}
    </div>
  );
}
