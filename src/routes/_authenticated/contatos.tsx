import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { AutoFillButton } from "@/components/contatos/AutoFillButton";
import { BulkActions } from "@/components/contatos/BulkActions";
import { ContactsTable } from "@/components/contatos/ContactsTable";
import { ContactsToolbar } from "@/components/contatos/ContactsToolbar";
import { useResponseOrigin } from "@/components/RespostaOrigem";
import { TablePagination } from "@/components/TablePagination";
import {
  useCompanies,
  useSectors,
  useContacts,
  useHolidays,
  useSettings,
  useUpdateContact,
} from "@/hooks/useCadencia";
import { useSelection } from "@/hooks/useSelection";
import { DEFAULT_OFFSETS, todayISO, type Contact } from "@/lib/cadencia";
import {
  contactsCsvRows,
  filterContacts,
  withSyncedStatus,
  type MissingFilter,
  type StatusFilter,
} from "@/lib/contatos";
import { downloadCsv } from "@/lib/download";
import { paginate } from "@/lib/paginate";

/** Linhas por página: cada linha tem vários campos editáveis, então a tabela não renderiza tudo. */
const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos — Cadência Outbound" },
      {
        name: "description",
        content: "Tabela de contatos com datas previstas, envios marcados e situação da cadência.",
      },
      { property: "og:title", content: "Contatos — Cadência Outbound" },
      {
        property: "og:description",
        content: "Tabela de contatos com datas previstas, envios marcados e situação da cadência.",
      },
    ],
  }),
  component: Contatos,
});

function Contatos() {
  const { data: contacts, isLoading } = useContacts();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const { data: companies } = useCompanies();
  const { data: sectors } = useSectors();
  const sectorName = useMemo(() => {
    const byId = new Map((sectors ?? []).map((s) => [s.id, s.name]));
    return new Map((companies ?? []).map((co) => [co.id, byId.get(co.sector_id) ?? ""] as const));
  }, [companies, sectors]);
  const offsets = settings ?? DEFAULT_OFFSETS;
  const update = useUpdateContact();
  const selection = useSelection();
  const origin = useResponseOrigin();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [missing, setMissing] = useState<MissingFilter>("todos");
  const [page, setPage] = useState(0);
  // A busca filtra milhares de contatos: o campo responde na hora e a tabela acompanha em seguida.
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(
    () => filterContacts(contacts ?? [], deferredSearch, statusFilter, missing),
    [contacts, deferredSearch, statusFilter, missing],
  );
  const paged = paginate(rows, page, PAGE_SIZE);
  const save = (contact: Contact, patch: Partial<Contact>) =>
    update.mutate({ id: contact.id, patch }, { onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-5">
      <ContactsToolbar
        count={rows.length}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(0);
        }}
        status={statusFilter}
        onStatus={(v) => {
          setStatusFilter(v);
          setPage(0);
        }}
        missing={missing}
        onMissing={(v) => {
          setMissing(v);
          setPage(0);
        }}
        actions={<AutoFillButton contacts={contacts ?? []} companies={companies ?? []} />}
        onExport={() =>
          downloadCsv(`contatos-${todayISO()}.csv`, contactsCsvRows(rows, offsets, holidays))
        }
      />
      <BulkActions selection={selection} />
      <ContactsTable
        rows={paged.pageRows}
        allIds={rows.map((r) => r.id)}
        isLoading={isLoading}
        offsets={offsets}
        holidays={holidays}
        today={todayISO()}
        companies={companies ?? []}
        sectorName={sectorName}
        selection={selection}
        onPatch={(c, changes) => save(c, withSyncedStatus(c, changes))}
        onStatus={(c, status) => origin.guard(c, { status }, (p) => save(c, p))}
      />
      {origin.dialog}
      <TablePagination paged={paged} onPage={setPage} noun="contatos" />
    </div>
  );
}
