import { CompanyGenderToggle } from "@/components/CompanyGender";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useContacts,
  useSettings,
  useHolidays,
  useUpdateContact,
  useUpdateContacts,
} from "@/hooks/useCadencia";
import {
  DEFAULT_OFFSETS,
  STATUS_LABEL,
  STEPS,
  computedStatus,
  funnelIndex,
  SECTORS,
  formatBR,
  plannedDates,
  toCSV,
  todayISO,
  type Contact,
  type ContactStatus,
} from "@/lib/cadencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";

export const Route = createFileRoute("/_authenticated/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos — Cadência Outbound" },
      {
        name: "description",
        content:
          "Tabela de contatos com datas previstas, envios marcados e situação da cadência.",
      },
      { property: "og:title", content: "Contatos — Cadência Outbound" },
      {
        property: "og:description",
        content:
          "Tabela de contatos com datas previstas, envios marcados e situação da cadência.",
      },
    ],
  }),
  component: Contatos,
});

const STATUS_OPTIONS: ContactStatus[] = [
  "aguardando",
  "em_cadencia",
  "respondeu",
  "concluido",
  "descartado",
];

function Contatos() {
  const { data: contacts, isLoading } = useContacts();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const offsets = settings ?? DEFAULT_OFFSETS;
  const update = useUpdateContact();
  const updateMany = useUpdateContacts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | ContactStatus>(
    "todos",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const term = search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    return (contacts ?? []).filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (!term) return true;
      const hay = `${c.name} ${c.company}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [contacts, search, statusFilter]);

  function patch(contact: Contact, changes: Partial<Contact>) {
    const merged = { ...contact, ...changes } as Contact;
    const next: Partial<Contact> = { ...changes };
    const status = computedStatus(merged);
    if (status !== contact.status) next.status = status;
    update.mutate(
      { id: contact.id, patch: next },
      { onError: (e) => toast.error(e.message) },
    );
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkStep1Today() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const today = todayISO();
    updateMany.mutate(
      {
        ids,
        patch: {
          step1_date: today,
          sent1_at: today,
          status: "em_cadencia",
        },
      },
      {
        onSuccess: () => {
          toast.success(`LinkedIn 1 registrada para ${ids.length} contatos`);
          setSelected(new Set());
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function exportCSV() {
    const header = [
      "Nome",
      "Cargo/Headline",
      "Empresa",
      "Telefone",
      "Data da conexão",
      ...STEPS.flatMap((s) => [`${s.label} prevista`, `${s.label} enviada`]),
      "Situação",
    ];
    const body = rows.map((c) => {
      const planned = plannedDates(c, offsets, holidays);
      return [
        c.name,
        c.headline,
        c.company,
        c.phone,
        formatBR(c.connected_at),
        ...STEPS.flatMap((s) => [
          formatBR(planned[s.n]),
          formatBR(c[s.sentField]),
        ]),
        STATUS_LABEL[computedStatus(c)],
      ];
    });
    const blob = new Blob(["\uFEFF" + toCSV([header, ...body])], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} contatos · edite empresa, telefone e datas direto na
            tabela.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nome ou empresa"
            className="w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col items-end leading-tight">
            <a
              href="https://docs.google.com/spreadsheets/d/1M25CO9Y4NqPjGdCi3P1hNWNglWZ3Jf7EDVIl_k9JLj0/edit"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Abrir planilha
            </a>
            <span className="text-[11px] text-muted-foreground">
              atualiza automaticamente, com atraso de até 1 hora
            </span>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            Exportar CSV
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/60 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selecionados</span>
          <Button size="sm" onClick={bulkStep1Today}>
            Enviei LinkedIn 1 hoje para os selecionados
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateMany.mutate(
                { ids: [...selected], patch: { status: "descartado" } },
                {
                  onSuccess: () => setSelected(new Set()),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Marcar como descartado
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={rows.length > 0 && selected.size === rows.length}
                  onCheckedChange={(v) =>
                    setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())
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
              <TableHead>LinkedIn 1</TableHead>
              {STEPS.slice(1).map((s) => (
                <TableHead key={s.n}>{s.label}</TableHead>
              ))}
              <TableHead>Situação</TableHead>
              <TableHead>Funil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={15} className="text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-muted-foreground">
                  Nenhum contato. Use a tela “Importar conexões”.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => {
              const planned = plannedDates(c, offsets, holidays);
              const status = computedStatus(c);
              return (
                <TableRow key={c.id} className="align-middle">
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleSelected(c.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    <InlineInput
                      value={c.name}
                      placeholder="Nome"
                      onCommit={(v) => v.trim() && patch(c, { name: v.trim() })}
                    />
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {c.headline || "—"}
                  </TableCell>
                  <TableCell>
                    <InlineInput
                      value={c.job_title}
                      placeholder="Cargo"
                      onCommit={(v) => patch(c, { job_title: v })}
                    />
                    {c.headline && (
                      <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-muted-foreground" title={c.headline}>
                        {c.headline}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={c.sector}
                      onValueChange={(v) => patch(c, { sector: v })}
                    >
                      <SelectTrigger className="h-7 w-40 text-xs" aria-label="Setor">
                        <SelectValue placeholder="Setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <InlineInput
                        value={c.company}
                        placeholder="Empresa"
                        onCommit={(v) => patch(c, { company: v })}
                      />
                      <CompanyGenderToggle
                        value={c.company_gender ?? "feminino"}
                        onChange={(g) => patch(c, { company_gender: g })}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <InlineInput
                      value={c.phone}
                      placeholder="(11) 90000-0000"
                      onCommit={(v) => patch(c, { phone: v })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatBR(c.connected_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        className="h-7 w-32 text-xs"
                        value={c.step1_date ?? ""}
                        onChange={(e) =>
                          patch(c, { step1_date: e.target.value || null })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          patch(c, {
                            step1_date: todayISO(),
                            sent1_at: todayISO(),
                          })
                        }
                      >
                        Enviei hoje
                      </Button>
                      <StepCheck
                        checked={!!c.sent1_at}
                        onToggle={(v) =>
                          patch(c, {
                            sent1_at: v ? todayISO() : null,
                            ...(v && !c.step1_date
                              ? { step1_date: todayISO() }
                              : {}),
                          })
                        }
                      />
                    </div>
                  </TableCell>
                  {STEPS.slice(1).map((s) => (
                    <TableCell key={s.n} className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-xs",
                            c[s.sentField]
                              ? "text-muted-foreground line-through"
                              : "",
                          )}
                        >
                          {formatBR(planned[s.n])}
                        </span>
                        <StepCheck
                          checked={!!c[s.sentField]}
                          onToggle={(v) =>
                            patch(c, {
                              [s.sentField]: v ? todayISO() : null,
                            } as Partial<Contact>)
                          }
                        />
                      </div>
                    </TableCell>
                  ))}
                  <TableCell>
                    {funnelIndex(c) >= 0 ? (
                      <FunnelBadge contact={c} />
                    ) : (
                    <Select
                      value={status}
                      onValueChange={(v) =>
                        update.mutate(
                          { id: c.id, patch: { status: v as ContactStatus } },
                          { onError: (e) => toast.error(e.message) },
                        )
                      }
                    >
                      <SelectTrigger className="h-7 w-[150px] text-xs">
                        <SelectValue asChild>
                          <span>
                            <StatusBadge status={status} />
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <FunnelControl contact={c} onPatch={(p) => patch(c, p)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

function StepCheck({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onToggle(!!v)}
      title="Enviado"
    />
  );
}

function InlineInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <Input
      className="h-7 w-36 text-xs"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
