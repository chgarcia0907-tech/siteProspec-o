import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkActions } from "@/components/contatos/BulkActions";
import { ContactsTable } from "@/components/contatos/ContactsTable";
import { ContactsToolbar } from "@/components/contatos/ContactsToolbar";
import { useContacts, useHolidays, useSettings, useUpdateContact } from "@/hooks/useCadencia";
import { useSelection } from "@/hooks/useSelection";
import { DEFAULT_OFFSETS, todayISO, type Contact } from "@/lib/cadencia";
import {
  contactsCsvRows,
  filterContacts,
  withSyncedStatus,
  type StatusFilter,
} from "@/lib/contatos";
import { downloadCsv } from "@/lib/download";

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
  const offsets = settings ?? DEFAULT_OFFSETS;
  const update = useUpdateContact();
  const selection = useSelection();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const rows = useMemo(
    () => filterContacts(contacts ?? [], search, statusFilter),
    [contacts, search, statusFilter],
  );
  const save = (contact: Contact, patch: Partial<Contact>) =>
    update.mutate({ id: contact.id, patch }, { onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <ContactsToolbar
        count={rows.length}
        search={search}
        onSearch={setSearch}
        status={statusFilter}
        onStatus={setStatusFilter}
        onExport={() =>
          downloadCsv(`contatos-${todayISO()}.csv`, contactsCsvRows(rows, offsets, holidays))
        }
      />
      <BulkActions selection={selection} />
      <ContactsTable
        rows={rows}
        isLoading={isLoading}
        offsets={offsets}
        holidays={holidays}
        selection={selection}
        onPatch={(c, changes) => save(c, withSyncedStatus(c, changes))}
        onStatus={(c, status) => save(c, { status })}
      />
    </div>
  );
}
