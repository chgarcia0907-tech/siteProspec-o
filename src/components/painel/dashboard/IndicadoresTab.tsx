import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { formatBR, spParts } from "@/lib/cadencia";
import { presetRange } from "@/lib/dashboard";
import { painelDashboard } from "@/lib/painel.functions";
import { Execucao, Heatmap, Ritmo } from "./Execucao";
import { Filters, type DashFilters } from "./Filters";
import { Abastecimento, ConversaoPor, Funil, OrigemAt, OrigemResposta } from "./Funil";
import { Kpis } from "./Kpis";
import { Metas } from "./Metas";
import { Alertas, Coortes, Tendencia } from "./Tendencia";

/** Aba "Indicadores" do painel: execução da cadência, funil e tendência da equipe. */
export function IndicadoresTab() {
  const today = spParts().iso;
  const [filters, setFilters] = useState<DashFilters>(() => ({
    preset: "semana",
    ...presetRange("semana", today),
    periodId: null,
    groupId: null,
    subgroupId: null,
    hunterId: null,
    sectorId: null,
    channel: "todos",
  }));
  const fn = useServerFn(painelDashboard);
  const { preset: _preset, ...input } = filters;
  const q = useQuery({
    queryKey: ["painel_dashboard", input, today],
    queryFn: () => fn({ data: { ...input, today } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const d = q.data?.dashboard;
  // O servidor escolhe o período ativo quando nenhum foi escolhido; o filtro passa a mostrá-lo.
  const shown: DashFilters = { ...filters, periodId: filters.periodId ?? q.data?.periodId ?? null };

  return (
    <div className="space-y-4">
      <Filters value={shown} onChange={setFilters} options={q.data?.options} today={today} />
      {q.isError && (
        <p className="text-sm text-destructive">Não foi possível carregar os indicadores.</p>
      )}
      {!d ? (
        !q.isError && <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
      ) : (
        <div className={q.isFetching ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
          <p className="text-xs text-muted-foreground">
            {formatBR(d.range.from)} a {formatBR(d.range.to)} · comparado com{" "}
            {formatBR(d.range.prevFrom)} a {formatBR(d.range.prevTo)}
          </p>
          <Kpis d={d} />
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <Alertas d={d} />
            <Abastecimento d={d} />
          </div>
          <Metas d={d} data={q.data!} />
          <Execucao d={d} />
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <Heatmap d={d} />
            <Ritmo d={d} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Funil d={d} />
            <OrigemResposta d={d} />
            <OrigemAt d={d} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ConversaoPor
              title="Conversão por setor da empresa"
              hint="Mede se as cadências por setor funcionam. Sem empresa cadastrada = contato sem vínculo."
              rows={d.bySector}
              label="Setor"
            />
            <ConversaoPor
              title="Conversão por área do contato"
              hint="Área do lead (TI, RH...), que define a dor usada na mensagem."
              rows={d.byArea}
              label="Área"
            />
          </div>
          <Tendencia d={d} />
          <Coortes d={d} />
        </div>
      )}
    </div>
  );
}
