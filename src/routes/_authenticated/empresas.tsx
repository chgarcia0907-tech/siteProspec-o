import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CompanyForm } from "@/components/empresas/CompanyForm";
import { CompanyList } from "@/components/empresas/CompanyList";
import { useConfirm } from "@/components/useConfirm";
import { formatBR, todayISO } from "@/lib/cadencia";
import { weekEndISO, weekStartISO } from "@/lib/empresas";
import { useCompanies, useContacts, useSectorTemplates, useSectors } from "@/hooks/useCadencia";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas — Outbound NTec" },
      {
        name: "description",
        content: "Cadastre as empresas prospectadas na semana e o setor de cada uma.",
      },
      { property: "og:title", content: "Empresas — Outbound NTec" },
      {
        property: "og:description",
        content: "Cadastre as empresas prospectadas na semana e o setor de cada uma.",
      },
    ],
  }),
  component: Empresas,
});

function Empresas() {
  const { data: companies } = useCompanies();
  const { data: sectors } = useSectors();
  const { data: sectorTemplates } = useSectorTemplates();
  const { data: contacts } = useContacts();
  const { ask, dialog } = useConfirm();
  const semana = weekStartISO(todayISO());

  const contactCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contacts ?? [])
      if (c.company_id) m.set(c.company_id, (m.get(c.company_id) ?? 0) + 1);
    return m;
  }, [contacts]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">
          Semana de {formatBR(semana)} a {formatBR(weekEndISO(semana))}
        </p>
        <h1 className="mt-1 text-title font-bold">Empresas</h1>
        <p className="mt-2 max-w-3xl text-body text-muted-foreground">
          Cadastre as empresas que você prospecta na semana e escolha o setor de cada uma. Os
          contatos vinculados a uma empresa recebem a cadência de mensagens do setor em Envios de
          hoje.
        </p>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
        <CompanyList
          companies={companies ?? []}
          sectors={sectors ?? []}
          sectorTemplates={sectorTemplates ?? {}}
          contactCount={contactCount}
          ask={ask}
        />
        <div className="sticky top-8">
          <CompanyForm sectors={sectors} existing={companies ?? []} />
        </div>
      </div>
      {dialog}
    </div>
  );
}
