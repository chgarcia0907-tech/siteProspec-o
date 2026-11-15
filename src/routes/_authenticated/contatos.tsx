import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkActions } from "@/components/contatos/BulkActions";
import { ContactsTable } from "@/components/contatos/ContactsTable";
import { ContactsToolbar } from "@/components/contatos/ContactsToolbar";
import { TablePagination } from "@/components/TablePagination";
import {
  useCompanies,
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
  const offsets = settings ?? DEFAULT_OFFSETS;
  const update = useUpdateContact();
  const selection = useSelection();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [page, setPage] = useState(0);
  // A busca filtra milhares de contatos: o campo responde na hora e a tabela acompanha em seguida.
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(
    () => filterContacts(contacts ?? [], deferredSearch, statusFilter),
    [contacts, deferredSearch, statusFilter],
  );
  const paged = paginate(rows, page, PAGE_SIZE);
  const save = (contact: Contact, patch: Partial<Contact>) =>
    update.mutate({ id: contact.id, patch }, { onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-4">
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
        companies={companies ?? []}
        selection={selection}
        onPatch={(c, changes) => save(c, withSyncedStatus(c, changes))}
        onStatus={(c, status) => save(c, { status })}
      />
      <TablePagination paged={paged} onPage={setPage} noun="contatos" />
    </div>
  );
}
