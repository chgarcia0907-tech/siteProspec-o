import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuscaTab } from "@/components/painel/BuscaTab";
import { CompTab } from "@/components/painel/CompTab";
import { useConfirm } from "@/components/painel/useConfirm";
import { HuntersTab } from "@/components/painel/HuntersTab";
import { PeriodosTab } from "@/components/painel/periodos/PeriodosTab";
import { SetoresTab } from "@/components/painel/setores/SetoresTab";
import { painelIsAdmin } from "@/lib/painel.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — Cadência Outbound" },
      {
        name: "description",
        content: "Acompanhe hunters, competição e contatos de toda a equipe.",
      },
      { property: "og:title", content: "Painel do administrador — Cadência Outbound" },
      {
        property: "og:description",
        content: "Acompanhe hunters, competição e contatos de toda a equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const isAdmin = useServerFn(painelIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["painel_admin"], queryFn: () => isAdmin() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.admin)
    return (
      <p className="text-sm text-muted-foreground">
        Acesso restrito ao administrador.{" "}
        <Link to="/hoje" className="underline">
          Voltar
        </Link>
      </p>
    );
  return <PainelAdmin />;
}

function PainelAdmin() {
  const { ask, dialog } = useConfirm();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Painel do administrador</h1>
      <Tabs defaultValue="hunters">
        <TabsList>
          <TabsTrigger value="hunters">Hunters</TabsTrigger>
          <TabsTrigger value="periodos">Períodos e grupos</TabsTrigger>
          <TabsTrigger value="setores">Setores e cadências</TabsTrigger>
          <TabsTrigger value="competicao">Competição</TabsTrigger>
          <TabsTrigger value="busca">Busca geral</TabsTrigger>
        </TabsList>
        <TabsContent value="hunters">
          <HuntersTab ask={ask} />
        </TabsContent>
        <TabsContent value="periodos">
          <PeriodosTab ask={ask} />
        </TabsContent>
        <TabsContent value="setores">
          <SetoresTab ask={ask} />
        </TabsContent>
        <TabsContent value="competicao">
          <CompTab />
        </TabsContent>
        <TabsContent value="busca">
          <BuscaTab ask={ask} />
        </TabsContent>
      </Tabs>
      {dialog}
    </div>
  );
}
