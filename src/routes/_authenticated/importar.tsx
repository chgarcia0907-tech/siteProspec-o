import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImportPreview } from "@/components/importar/ImportPreview";
import { PasteCard } from "@/components/importar/PasteCard";
import { useCompanies, useContacts, useImportContacts } from "@/hooks/useCadencia";
import { normalizeKey, parseLinkedInConnections } from "@/lib/cadencia";
import { buildImportRows, importPayload, importable, type ImportRow } from "@/lib/importar";
import type { Persona } from "@/lib/personas";
export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar conexões — Outbound NTec" },
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
  /** Persona trocada à mão por linha; sem troca, o contato fica com a sugerida (persona nula). */
  const [personas, setPersonas] = useState<Record<string, Persona>>({});
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
      toImport.map((r) => importPayload(r, companyOf(r), personas[r.key])),
      {
        onSuccess: (n) => {
          toast.success(`${n} contatos importados`);
          setText("");
          setChosen({});
          setPersonas({});
          navigate({ to: "/contatos" });
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Conexões do LinkedIn</p>
        <h1 className="mt-1 text-title font-bold">Importar conexões</h1>
        <p className="mt-2 max-w-3xl text-body text-muted-foreground">
          Cole a página de conexões e confira a pré-visualização. Empresa, área e persona são
          sugeridas pelo headline; o que não der para descobrir fica em branco para você completar
          depois.
        </p>
      </header>
      <PasteCard text={text} onText={setText} fromDate={fromDate} onFromDate={setFromDate} />
      {rows.length > 0 && (
        <ImportPreview
          key={`${rows.length}-${fromDate}`}
          rows={rows}
          newCount={toImport.length}
          companies={companies ?? []}
          companyOf={companyOf}
          onCompany={(key, id) => setChosen((m) => ({ ...m, [key]: id }))}
          personaOf={(r) => personas[r.key] ?? null}
          onPersona={(key, p) => setPersonas((m) => ({ ...m, [key]: p }))}
          busy={importMutation.isPending}
          onImport={runImport}
        />
      )}
    </div>
  );
}
