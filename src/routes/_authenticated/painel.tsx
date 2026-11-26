import { createFileRoute, redirect } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGate } from "@/components/painel/AdminGate";
import { AuditoriaTab } from "@/components/painel/AuditoriaTab";
import { BuscaTab } from "@/components/painel/BuscaTab";
import { CompTab } from "@/components/painel/CompTab";
import { useConfirm } from "@/components/useConfirm";
import { HuntersTab } from "@/components/painel/HuntersTab";
import { PeriodosTab } from "@/components/painel/periodos/PeriodosTab";
import { SetoresTab } from "@/components/painel/setores/SetoresTab";

const ABAS = ["hunters", "periodos", "setores", "competicao", "busca", "auditoria"] as const;
type Aba = (typeof ABAS)[number];
const isAba = (v: unknown): v is Aba => ABAS.includes(v as Aba);
const ABA_LABEL: Record<Aba, string> = {
  hunters: "Hunters",
  periodos: "Períodos e grupos",
  setores: "Setores e cadências",
  competicao: "Competição",
  busca: "Busca geral",
  auditoria: "Auditoria de conexões",
};

export const Route = createFileRoute("/_authenticated/painel")({
  // A aba aberta fica na URL (?aba=competicao), para links diretos e o redirecionamento do /ranking.
  // "indicadores" saiu do painel (virou /dashboard): o valor passa só para o redirecionamento.
  validateSearch: (s: Record<string, unknown>): { aba?: Aba | "indicadores" } =>
    isAba(s["aba"]) || s["aba"] === "indicadores" ? { aba: s["aba"] } : {},
  beforeLoad: ({ search }) => {
    if (search.aba === "indicadores")
      throw redirect({ to: "/dashboard", search: { aba: "indicadores" } });
  },
  head: () => ({
    meta: [
      { title: "Painel do administrador — Outbound NTec" },
      {
        name: "description",
        content: "Hunters, períodos, setores, competição e contatos de toda a equipe.",
      },
      { property: "og:title", content: "Painel do administrador — Outbound NTec" },
      {
        property: "og:description",
        content: "Hunters, períodos, setores, competição e contatos de toda a equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  return (
    <AdminGate>
      <PainelAdmin />
    </AdminGate>
  );
}

function PainelAdmin() {
  const { ask, dialog } = useConfirm();
  const search = Route.useSearch();
  const aba: Aba = search.aba === "indicadores" || !search.aba ? "hunters" : search.aba;
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
        <TabsContent value="auditoria">
          <AuditoriaTab />
        </TabsContent>
      </Tabs>
      {dialog}
    </div>
  );
}
