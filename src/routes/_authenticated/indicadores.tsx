import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/painel/AdminGate";
import { IndicadoresTab } from "@/components/painel/dashboard/IndicadoresTab";

const DESCRICAO = "A equipe está no ritmo? Envios, atrasados, metas e funil de toda a equipe.";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores — Outbound NTec" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Indicadores — Outbound NTec" },
      { property: "og:description", content: DESCRICAO },
    ],
  }),
  component: Indicadores,
});

function Indicadores() {
  return (
    <AdminGate>
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Administração</p>
          <h1 className="mt-1 text-title font-bold">Indicadores</h1>
        </header>
        <IndicadoresTab />
      </div>
    </AdminGate>
  );
}
