import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/painel/AdminGate";
import { IndicadoresTab } from "@/components/painel/dashboard/IndicadoresTab";
import { parseIndicadoresBusca, type IndicadoresBusca } from "@/lib/indicadores";

const DESCRICAO = "A equipe está no ritmo? Envios, atrasados, metas e funil de toda a equipe.";

/**
 * O roteador junta a busca validada com a busca crua da URL: o que o parser descarta voltaria
 * pela mão do roteador. Devolver cada chave (com `undefined` no descartado) apaga o valor cru.
 */
function validarBusca(raw: Record<string, unknown>): IndicadoresBusca {
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
  } satisfies { [K in keyof IndicadoresBusca]-?: IndicadoresBusca[K] };
}

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores — Outbound NTec" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Indicadores — Outbound NTec" },
      { property: "og:description", content: DESCRICAO },
    ],
  }),
  validateSearch: validarBusca,
  component: Indicadores,
});

function Indicadores() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminGate>
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Administração</p>
          <h1 className="mt-1 text-title font-bold">Indicadores</h1>
        </header>
        <IndicadoresTab
          search={search}
          onSearch={(next) => navigate({ search: next, replace: true, resetScroll: false })}
        />
      </div>
    </AdminGate>
  );
}
