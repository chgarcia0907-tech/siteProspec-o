import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuscaTab } from "@/components/painel/BuscaTab";
import { CompTab } from "@/components/painel/CompTab";
import { useConfirm } from "@/components/useConfirm";
import { HuntersTab } from "@/components/painel/HuntersTab";
import { IndicadoresTab } from "@/components/painel/dashboard/IndicadoresTab";
import { PeriodosTab } from "@/components/painel/periodos/PeriodosTab";
import { SetoresTab } from "@/components/painel/setores/SetoresTab";
import { painelIsAdmin } from "@/lib/painel.functions";

const ABAS = ["indicadores", "hunters", "periodos", "setores", "competicao", "busca"] as const;
type Aba = (typeof ABAS)[number];
const isAba = (v: unknown): v is Aba => ABAS.includes(v as Aba);
const ABA_LABEL: Record<Aba, string> = {
  indicadores: "Indicadores",
  hunters: "Hunters",
  periodos: "Períodos e grupos",
  setores: "Setores e cadências",
  competicao: "Competição",
  busca: "Busca geral",
};

export const Route = createFileRoute("/_authenticated/painel")({
  // A aba aberta fica na URL (?aba=competicao), para links diretos e o redirecionamento do /ranking.
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } =>
    isAba(s["aba"]) ? { aba: s["aba"] } : {},
  head: () => ({
    meta: [
      { title: "Painel do administrador — Outbound NTec" },
      {
        name: "description",
        content: "Indicadores das cadências, hunters, competição e contatos de toda a equipe.",
      },
      { property: "og:title", content: "Painel do administrador — Outbound NTec" },
      {
        property: "og:description",
        content: "Indicadores das cadências, hunters, competição e contatos de toda a equipe.",
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
  const { aba = "indicadores" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Painel do administrador</p>
        <h1 className="mt-1 text-title font-bold">{ABA_LABEL[aba]}</h1>
      </header>
      <Tabs
        value={aba}
        onValueChange={(v) => isAba(v) && navigate({ search: { aba: v }, replace: true })}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-6 rounded-none border-0 border-b bg-transparent p-0">
          {ABAS.map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="-mb-px rounded-none border-b-2 border-transparent px-0 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              {ABA_LABEL[v]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="indicadores">
          <IndicadoresTab />
        </TabsContent>
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
