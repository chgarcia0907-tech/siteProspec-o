import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CompanyForm } from "@/components/empresas/CompanyForm";
import { CompanyList } from "@/components/empresas/CompanyList";
import { useConfirm } from "@/components/painel/useConfirm";
import { useCompanies, useContacts, useSectorTemplates, useSectors } from "@/hooks/useCadencia";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas — Cadência Outbound" },
      {
        name: "description",
        content: "Cadastre as empresas prospectadas na semana e o setor de cada uma.",
      },
      { property: "og:title", content: "Empresas — Cadência Outbound" },
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

  const contactCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contacts ?? [])
      if (c.company_id) m.set(c.company_id, (m.get(c.company_id) ?? 0) + 1);
    return m;
  }, [contacts]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre as empresas que você prospecta na semana e escolha o setor de cada uma. Os
          contatos vinculados a uma empresa recebem a cadência de mensagens do setor em Envios de
          hoje.
        </p>
      </div>
      <CompanyForm sectors={sectors ?? []} existing={companies ?? []} />
      <CompanyList
        companies={companies ?? []}
        sectors={sectors ?? []}
        sectorTemplates={sectorTemplates ?? {}}
        contactCount={contactCount}
        ask={ask}
      />
      {dialog}
    </div>
  );
}
