import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBR, spParts } from "@/lib/cadencia";
import { presetRange } from "@/lib/dashboard";
import { painelDashboard } from "@/lib/painel.functions";
import { cn } from "@/lib/utils";
import { Execucao, Heatmap, Ritmo } from "./Execucao";
import { Filters, type DashFilters } from "./Filters";
import {
  Abastecimento,
  CanalEntrada,
  ConversaoPor,
  Funil,
  Mensagens,
  OrigemAt,
  OrigemResposta,
} from "./Funil";
import { KpisPrincipais, KpisSecundarios } from "./Kpis";
import { Metas } from "./Metas";
import { Alertas, Coortes, Tendencia } from "./Tendencia";

/** Abas do "Detalhamento" (DESIGN.md, seção 7), na ordem em que aparecem. */
const DETALHE = [
  ["execucao", "Execução por hunter"],
  ["envios", "Envios por dia"],
  ["ritmo", "Ritmo"],
  ["funil", "Funil"],
  ["origem", "Origem"],
  ["conversao", "Conversão"],
  ["tendencia", "Tendência"],
  ["abastecimento", "Abastecimento"],
] as const;

/**
 * Aba "Indicadores": primeiro a pergunta "a equipe está no ritmo?" (KPIs), depois quem precisa
 * de ajuda e as metas, e o detalhamento um nível abaixo, em abas internas.
 */
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
  const [detalhe, setDetalhe] = useState<string>("execucao");
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
  const semana = filters.preset === "semana";

  return (
    <div className="space-y-6">
      <Filters value={shown} onChange={setFilters} options={q.data?.options} today={today} />
      {q.isError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive-border bg-destructive-soft/40 px-4 py-3">
          <p className="text-dense text-destructive-text">
            Não foi possível carregar os indicadores.
          </p>
          <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {q.data?.cycle && (
        <p className="rounded-lg border bg-card px-4 py-2 text-dense text-muted-foreground">
          Ciclo <span className="font-semibold text-heading">{q.data.cycle.name}</span>: só os{" "}
          {q.data.cycle.members} membros do ciclo, a partir de {formatBR(q.data.cycle.start)}
          {q.data.cycle.end ? ` até ${formatBR(q.data.cycle.end)}` : ""}.
          {q.data.cycle.outside
            ? " O intervalo escolhido fica fora do ciclo, então não há números para mostrar."
            : " Para ver o histórico anterior, escolha outro período no filtro."}
        </p>
      )}
      {!d ? (
        !q.isError && (
          <div className="space-y-3" aria-busy="true">
            <p className="text-dense text-muted-foreground">Carregando indicadores…</p>
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl border bg-card p-5">
                  <div className="h-3 w-24 rounded-sm bg-divider" />
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div
          className={cn("space-y-8 transition-opacity", q.isFetching && "opacity-60")}
          aria-busy={q.isFetching}
        >
          <section className="space-y-4" aria-labelledby="ritmo-titulo">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ritmo-titulo" className="text-section font-semibold">
                {semana ? "A equipe está no ritmo desta semana?" : "A equipe está no ritmo?"}
              </h2>
              <p className="text-dense text-subtle-foreground">
                {formatBR(d.range.from)} a {formatBR(d.range.to)} · comparado com{" "}
                {formatBR(d.range.prevFrom)} a {formatBR(d.range.prevTo)}
              </p>
            </div>
            <KpisPrincipais d={d} />
            <KpisSecundarios d={d} />
          </section>

          <div className="grid grid-cols-2 items-start gap-6">
            <Alertas d={d} />
            <Metas d={d} data={q.data!} title={semana ? "Metas da semana" : "Metas do intervalo"} />
          </div>

          <section className="space-y-4" aria-labelledby="detalhe-titulo">
            <h2 id="detalhe-titulo" className="text-section font-semibold">
              Detalhamento
            </h2>
            <Tabs value={detalhe} onValueChange={setDetalhe}>
              <TabsList className="h-auto flex-wrap justify-start">
                {DETALHE.map(([v, label]) => (
                  <TabsTrigger key={v} value={v}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="execucao">
                <Execucao d={d} />
              </TabsContent>
              <TabsContent value="envios">
                <Heatmap d={d} />
              </TabsContent>
              <TabsContent value="ritmo">
                <Ritmo d={d} />
              </TabsContent>
              <TabsContent value="funil">
                <Funil d={d} />
              </TabsContent>
              <TabsContent value="origem" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <OrigemResposta d={d} />
                  <OrigemAt d={d} />
                </div>
                <div className="grid grid-cols-[380px_1fr] gap-4">
                  <CanalEntrada d={d} />
                  <Mensagens d={d} />
                </div>
              </TabsContent>
              <TabsContent value="conversao">
                <div className="grid grid-cols-2 gap-4">
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
              </TabsContent>
              <TabsContent value="tendencia" className="space-y-4">
                <Tendencia d={d} />
                <Coortes d={d} />
              </TabsContent>
              <TabsContent value="abastecimento">
                <Abastecimento d={d} />
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}
    </div>
  );
}
