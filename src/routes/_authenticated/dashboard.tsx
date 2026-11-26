import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/painel/AdminGate";
import { IndicadoresTab } from "@/components/dashboard/IndicadoresTab";
import { ConciliacaoTab } from "@/components/dashboard/conciliacao/ConciliacaoTab";
import { ContadorConciliacao } from "@/components/dashboard/conciliacao/ContadorConciliacao";
import { HuntersTab } from "@/components/dashboard/hunters/HuntersTab";
import { VisaoTab } from "@/components/dashboard/visao/VisaoTab";
import { SemanasTab } from "@/components/dashboard/semanas/SemanasTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/useConfirm";
import { parseIndicadoresBusca, type IndicadoresBusca } from "@/lib/indicadores";

/**
 * Abas da Dashboard. "visao" (Visão geral) é a padrão e não vai para a URL. "indicadores" é o
 * conteúdo antigo dos Indicadores, que sai aos poucos conforme cada módulo novo entra
 * (.claude/plans/dashboard-outbound.md); link antigo só com os filtros dele abre essa aba.
 */
const ABAS = ["visao", "hunters", "semanas", "conciliacao", "indicadores"] as const;
type Aba = (typeof ABAS)[number];
const ABA_LABEL: Record<Aba, string> = {
  visao: "Visão geral",
  hunters: "Hunters",
  semanas: "Semanas",
  conciliacao: "Conciliação",
  indicadores: "Indicadores",
};
/** Chaves de busca que só os Indicadores usam. */
const CHAVES_INDICADORES = [
  "intervalo",
  "de",
  "ate",
  "periodo",
  "grupo",
  "subgrupo",
  "hunter",
  "setor",
  "canal",
  "detalhe",
  "ordem",
  "sentido",
  "aberto",
] as const;
const isAba = (v: unknown): v is Aba =>
  typeof v === "string" && (ABAS as readonly string[]).includes(v);

type DashboardBusca = IndicadoresBusca & {
  aba?: Exclude<Aba, "visao"> | undefined;
  /** Aba Hunters: segunda-feira da semana escolhida e hunter com a ficha aberta. */
  semana?: string | undefined;
  ficha?: string | undefined;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESCRICAO = "A equipe está no ritmo? Envios, atrasados, metas e funil de toda a equipe.";

/**
 * O roteador junta a busca validada com a busca crua da URL: o que o parser descarta voltaria
 * pela mão do roteador. Devolver cada chave (com `undefined` no descartado) apaga o valor cru.
 */
function validarBusca(raw: Record<string, unknown>): DashboardBusca {
  const b = parseIndicadoresBusca(raw);
  // `satisfies` exige todas as chaves: acrescentar uma chave em IndicadoresBusca quebra o typecheck.
  return {
    intervalo: b.intervalo,
    de: b.de,
    ate: b.ate,
    periodo: b.periodo,
    grupo: b.grupo,
    subgrupo: b.subgrupo,
    hunter: b.hunter,
    setor: b.setor,
    canal: b.canal,
    detalhe: b.detalhe,
    ordem: b.ordem,
    sentido: b.sentido,
    aberto: b.aberto,
    aba: isAba(raw["aba"]) && raw["aba"] !== "visao" ? raw["aba"] : undefined,
    semana:
      typeof raw["semana"] === "string" && DIA.test(raw["semana"]) ? raw["semana"] : undefined,
    ficha: typeof raw["ficha"] === "string" && UUID.test(raw["ficha"]) ? raw["ficha"] : undefined,
  } satisfies { [K in keyof DashboardBusca]-?: DashboardBusca[K] };
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Outbound NTec" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Dashboard — Outbound NTec" },
      { property: "og:description", content: DESCRICAO },
    ],
  }),
  validateSearch: validarBusca,
  component: Dashboard,
});

function Dashboard() {
  const { aba: abaBusca, semana, ficha, ...search } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { ask, dialog } = useConfirm();
  // Sem aba na URL: Visão geral, a não ser que o link traga filtros dos Indicadores (links antigos).
  const aba: Aba =
    abaBusca ?? (CHAVES_INDICADORES.some((k) => search[k] !== undefined) ? "indicadores" : "visao");
  const ir = (destino: "hunters" | "semanas" | "conciliacao", hunter?: string) =>
    navigate({
      search: { aba: destino, ficha: destino === "hunters" ? hunter : undefined },
      resetScroll: true,
    });
  return (
    <AdminGate>
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Administração</p>
          <h1 className="mt-1 text-title font-bold">Dashboard</h1>
        </header>
        <Tabs
          value={aba}
          onValueChange={(v) =>
            isAba(v) &&
            navigate({
              // Trocar de aba limpa os filtros das outras (os dos Indicadores só valem lá).
              search: { aba: v === "visao" ? undefined : v },
              replace: true,
            })
          }
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-6 rounded-none border-0 border-b bg-transparent p-0">
            {ABAS.map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                className="-mb-px rounded-none border-b-2 border-transparent px-0 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {ABA_LABEL[v]}
                {v === "conciliacao" && <ContadorConciliacao />}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="visao" className="pt-4">
            <VisaoTab onIr={ir} />
          </TabsContent>
          <TabsContent value="indicadores" className="pt-4">
            <IndicadoresTab
              search={search}
              onSearch={(next) =>
                navigate({
                  search: { ...next, aba: "indicadores", semana: undefined, ficha: undefined },
                  replace: true,
                  resetScroll: false,
                })
              }
            />
          </TabsContent>
          <TabsContent value="hunters" className="pt-4">
            <HuntersTab
              semana={semana}
              ficha={ficha}
              onBusca={(b) =>
                navigate({
                  search: (s) => ({ ...s, ...b }),
                  replace: true,
                  resetScroll: false,
                })
              }
            />
          </TabsContent>
          <TabsContent value="conciliacao" className="pt-4">
            <ConciliacaoTab />
          </TabsContent>
          <TabsContent value="semanas" className="pt-4">
            <SemanasTab ask={ask} />
          </TabsContent>
        </Tabs>
        {dialog}
      </div>
    </AdminGate>
  );
}
