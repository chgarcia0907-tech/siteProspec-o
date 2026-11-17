import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useHunters } from "@/hooks/usePainel";
import {
  auditConnections,
  daysBetween,
  sortAuditRows,
  spDay,
  type AuditResult,
  type AuditRow,
} from "@/lib/auditoria";
import {
  STATUS_LABEL,
  formatBR,
  parseLinkedInConnections,
  spParts,
  type ContactStatus,
} from "@/lib/cadencia";
import { paginate } from "@/lib/paginate";
import { painelAuditContacts } from "@/lib/painel.functions";
import { cn, errorMessage } from "@/lib/utils";

type View = "faltando" | "importadas" | "todas";

const KIND_LABEL = { exato: "", nome: "headline mudou", aproximado: "nome parecido" } as const;

const ago = (days: number | null) =>
  days === null ? "" : days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;

/**
 * Aba "Auditoria de conexões": o admin cola as conexões do LinkedIn de um hunter e vê quais
 * já foram importadas na plataforma e quais ficaram de fora (para cobrar a importação).
 */
export function AuditoriaTab() {
  const { data: hs } = useHunters();
  const [hid, setHid] = useState("");
  const [text, setText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [view, setView] = useState<View>("faltando");
  const [page, setPage] = useState(0);
  const today = spParts().iso;

  const fn = useServerFn(painelAuditContacts);
  const contacts = useQuery({
    queryKey: ["painel_audit", hid],
    enabled: !!hid,
    queryFn: () => fn({ data: { hunterId: hid } }),
  });

  const parsed = useMemo(() => {
    const all = parseLinkedInConnections(text);
    return fromDate ? all.filter((p) => p.connected_at && p.connected_at >= fromDate) : all;
  }, [text, fromDate]);

  const result = useMemo(
    () => (contacts.data ? auditConnections(parsed, contacts.data.rows, today) : null),
    [parsed, contacts.data, today],
  );

  const shown = useMemo(() => {
    const rows = sortAuditRows(result?.rows ?? []);
    if (view === "faltando") return rows.filter((r) => !r.match);
    if (view === "importadas") return rows.filter((r) => r.match);
    return rows;
  }, [result, view]);
  const paged = paginate(shown, page, 50);
  const hunter = hs?.hunters.find((h) => h.id === hid);

  const copyMissing = async () => {
    const missing = sortAuditRows(result?.rows ?? []).filter((r) => !r.match);
    const lines = missing.map(
      (r) => `- ${r.name}${r.connected_at ? ` (conexão em ${formatBR(r.connected_at)})` : ""}`,
    );
    const head = `Conexões ainda não importadas na plataforma${hunter ? ` — ${hunter.name}` : ""} (${missing.length}):`;
    try {
      await navigator.clipboard.writeText([head, ...lines].join("\n"));
      toast.success("Lista copiada");
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível copiar"));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Conexões do LinkedIn do hunter</CardTitle>
          <p className="text-dense text-muted-foreground">
            Escolha o hunter e cole a página de conexões dele (Ctrl+A, Ctrl+C). O sistema compara
            com os contatos que ele importou e mostra o que ficou de fora.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-hunter">Hunter</Label>
              <NativeSelect
                id="audit-hunter"
                className="w-64"
                value={hid}
                onChange={(e) => {
                  setHid(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Escolher hunter…</option>
                {hs?.hunters.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.total} contatos)
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-from">Só conexões feitas a partir de (opcional)</Label>
              <Input
                id="audit-from"
                type="date"
                className="w-48"
                max={today}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            {fromDate && (
              <Button variant="ghost" size="sm" onClick={() => setFromDate("")}>
                Sem filtro de data
              </Button>
            )}
          </div>
          <Textarea
            rows={8}
            className="font-mono text-caption"
            aria-label="Texto copiado da página de conexões do LinkedIn"
            placeholder={
              "Foto do perfil de Kenny Tan Mei\nKenny Tan Mei\nGraduando em Engenharia Elétrica\nConexão feita em 28 de setembro de 2026\nMensagem"
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPage(0);
            }}
          />
          {text.trim() && parsed.length === 0 && (
            <p className="rounded-lg border border-warning-border bg-warning-soft/60 px-3 py-2 text-dense text-warning-text">
              Nenhuma conexão reconhecida{fromDate ? " a partir da data escolhida" : ""}. Confira se
              o texto veio da página de conexões do LinkedIn.
            </p>
          )}
        </CardContent>
      </Card>

      {!hid ? null : contacts.isLoading ? (
        <p className="text-dense text-muted-foreground">Carregando contatos do hunter…</p>
      ) : contacts.error ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive-border bg-destructive-soft/40 px-4 py-3 text-dense">
          <span>{errorMessage(contacts.error)}</span>
          <Button size="sm" variant="ghost" onClick={() => contacts.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        result &&
        result.total > 0 && (
          <>
            <Resumo result={result} today={today} hunterName={hunter?.name} />
            <PorIdade result={result} />

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border bg-card p-[3px]" role="group">
                {(
                  [
                    ["faltando", `Não importadas (${result.faltando})`],
                    ["importadas", `Importadas (${result.importadas})`],
                    ["todas", `Todas (${result.total})`],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => {
                      setView(v);
                      setPage(0);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-dense text-muted-foreground transition-colors",
                      view === v && "bg-primary-soft font-semibold text-heading",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto"
                disabled={!result.faltando}
                onClick={copyMissing}
              >
                Copiar lista de não importadas
              </Button>
            </div>

            <AuditTable rows={paged.pageRows} />
            <TablePagination paged={paged} onPage={setPage} noun="conexões" />
          </>
        )
      )}
    </div>
  );
}

/** KPIs e a frase de cobrança. */
function Resumo({
  result,
  today,
  hunterName,
}: {
  result: AuditResult;
  today: string;
  hunterName: string | undefined;
}) {
  const recentes = result.buckets
    .filter((b) => b.key === "7d" || b.key === "30d")
    .reduce((s, b) => s + b.faltando, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Conexões coladas" value={result.total} />
        <Kpi
          label="Importadas"
          value={result.importadas}
          hint={`${result.cobertura}% das conexões`}
        />
        <Kpi
          label="Não importadas"
          value={result.faltando}
          hint={
            result.faltandoDesde
              ? `a mais antiga é de ${formatBR(result.faltandoDesde)}`
              : "nenhuma faltando"
          }
          alert={recentes > 0}
        />
        <Kpi
          label="Última importação"
          value={formatBR(result.ultimaImportacao)}
          hint={
            result.ultimaImportacao
              ? ago(daysBetween(result.ultimaImportacao, today))
              : "nunca importou"
          }
        />
      </div>
      {recentes > 0 ? (
        <p className="rounded-lg border border-warning-border bg-warning-soft/60 px-4 py-3 text-dense text-warning-text">
          <strong>{recentes}</strong> {recentes === 1 ? "conexão" : "conexões"} dos últimos 30 dias
          ainda não {recentes === 1 ? "foi importada" : "foram importadas"}
          {hunterName ? ` por ${hunterName}` : ""}. Conexão fora da plataforma não entra na
          cadência.
        </p>
      ) : (
        <p className="rounded-lg border bg-success-soft/40 px-4 py-3 text-dense text-success">
          {result.faltando
            ? "As conexões dos últimos 30 dias estão na plataforma; faltam só conexões antigas ou sem data."
            : "Todas as conexões coladas já estão na plataforma."}
        </p>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  alert?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "rounded-xl border bg-card p-5",
        alert && "border-destructive-border bg-destructive-soft/50",
      )}
    >
      <p className="text-dense text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-section font-bold tabular-nums",
          alert ? "text-destructive-text" : "text-heading",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-dense text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Conexões coladas, importadas e não importadas por idade da conexão. */
function PorIdade({ result }: { result: AuditResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por idade da conexão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-2xl overflow-x-auto rounded-xl border">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Conexão feita</TableHead>
                <TableHead className="text-right">Coladas</TableHead>
                <TableHead className="text-right">Importadas</TableHead>
                <TableHead className="text-right">Não importadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.buckets
                .filter((b) => b.total > 0)
                .map((b) => (
                  <TableRow key={b.key}>
                    <TableCell>{b.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.importadas}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        b.faltando > 0 && "font-semibold text-destructive-text",
                      )}
                    >
                      {b.faltando}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed border-input px-6 py-10 text-center text-dense text-muted-foreground">
        Nenhuma conexão nesta lista.
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table className="table-dense">
        <TableHeader>
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Conexão</TableHead>
            <TableHead>Na plataforma</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.name}-${i}`}>
              <TableCell className="max-w-80">
                <p className="truncate font-semibold text-heading">{r.name}</p>
                <p className="truncate text-caption text-muted-foreground" title={r.headline}>
                  {r.headline || "—"}
                </p>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatBR(r.connected_at)}
                {r.days !== null && (
                  <span className="ml-1 text-caption text-muted-foreground">({ago(r.days)})</span>
                )}
              </TableCell>
              <TableCell>
                {r.match ? (
                  <div>
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-caption font-semibold whitespace-nowrap text-success">
                      Importada em {formatBR(spDay(r.match.created_at))}
                    </span>
                    {r.kind && KIND_LABEL[r.kind] && (
                      <p className="mt-1 text-caption text-muted-foreground">
                        {KIND_LABEL[r.kind]}: cadastrada como “{r.match.name}”
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-caption font-semibold whitespace-nowrap text-destructive-text">
                    Não importada
                  </span>
                )}
              </TableCell>
              <TableCell className="text-caption text-muted-foreground">
                {r.match ? (
                  <div className="space-y-1">
                    {r.match.status in STATUS_LABEL ? (
                      <StatusBadge status={r.match.status as ContactStatus} />
                    ) : (
                      r.match.status
                    )}
                    <p>
                      {r.match.sent1_at
                        ? `LinkedIn 1 em ${formatBR(r.match.sent1_at)}`
                        : "LinkedIn 1 não enviada"}
                    </p>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
