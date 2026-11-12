import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCompetition } from "@/lib/admin.functions";
import { formatBR } from "@/lib/cadencia";
import { filterByGroup, groupOptions, subgroupOptions, type GroupFilter } from "@/lib/ranking";
import { CompetitionTable } from "./CompetitionTable";
import { GroupTotals } from "./GroupTotals";
import { ScoringRules } from "./ScoringRules";
import { WeeklyWinners } from "./WeeklyWinners";

function usePeriods() {
  return useQuery({
    queryKey: ["periods-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("id, name, status, started_at, kind")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Placar da competição: período, visão semanal, placar oficial/vivo e filtro por grupo. */
export function CompetitionBoard() {
  const fetchComp = useServerFn(getCompetition);
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState("geral");
  const [oficial, setOficial] = useState(true);
  const [grupo, setGrupo] = useState<GroupFilter>("todos");
  const [subgrupo, setSubgrupo] = useState("todos");
  const { data: periods } = usePeriods();
  // Abre no período ativo (o ciclo da equipe); "Competição geral" continua disponível no seletor.
  const periodId =
    picked ?? periods?.find((p) => p.status === "active")?.id ?? (periods ? "geral" : null);
  const sel = periods?.find((p) => p.id === periodId);
  const closed = sel?.status === "closed";
  const useOficial = closed && oficial;
  const { data, isLoading } = useQuery({
    queryKey: ["competition", periodId, useOficial],
    enabled: periodId !== null,
    queryFn: () =>
      fetchComp({
        data: periodId === "geral" || !periodId ? undefined : { periodId, oficial: useOficial },
      }),
  });
  const semanas = !useOficial ? (data?.semanas ?? []) : [];
  const semana = view === "geral" ? undefined : semanas.find((w) => w.inicio === view);
  const baseRows = semana ? semana.rows : (data?.rows ?? []);
  const grupos = groupOptions(baseRows);
  const subgrupos = subgroupOptions(baseRows, grupo);
  const shown = filterByGroup(baseRows, grupo, subgrupo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={periodId ?? ""}
          onChange={(e) => {
            setPicked(e.target.value);
            setView("geral");
            setGrupo("todos");
            setSubgrupo("todos");
          }}
        >
          <option value="geral">Competição geral</option>
          {periods?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === "active" ? " (ativo)" : " (encerrado)"}
            </option>
          ))}
        </NativeSelect>
        {semanas.length > 0 && (
          <NativeSelect
            aria-label="Visão do ranking"
            value={semana ? view : "geral"}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="geral">Geral do ciclo</option>
            {semanas.map((w) => (
              <option key={w.inicio} value={w.inicio}>
                Semana {formatBR(w.inicio)} a {formatBR(w.fim)}
                {w.parcial ? " (parcial)" : ""}
              </option>
            ))}
          </NativeSelect>
        )}
        {closed && (
          <Tabs
            value={oficial ? "oficial" : "vivo"}
            onValueChange={(v) => setOficial(v === "oficial")}
          >
            <TabsList>
              <TabsTrigger value="oficial">Placar oficial</TabsTrigger>
              <TabsTrigger value="vivo">Maturação atual</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <NativeSelect
          value={grupo}
          onChange={(e) => {
            setGrupo(e.target.value);
            setSubgrupo("todos");
          }}
        >
          <option value="todos">Todos os grupos</option>
          {grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value="sem">Sem grupo</option>
        </NativeSelect>
        {subgrupos.length > 0 && (
          <NativeSelect value={subgrupo} onChange={(e) => setSubgrupo(e.target.value)}>
            <option value="todos">Todos os subgrupos</option>
            {subgrupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {useOficial && "Placar oficial congelado no encerramento · "}
        {closed &&
          !oficial &&
          "Resultados atualizados após o encerramento (não alteram o placar oficial) · "}
        {semana
          ? `Semana: ${formatBR(semana.inicio)} a ${formatBR(semana.fim)}${semana.parcial ? " (parcial)" : ""}`
          : data
            ? `Período: ${formatBR(data.start)} ${data.end ? `a ${formatBR(data.end)}` : "em diante"}`
            : "Carregando período..."}
        {!semana &&
          data?.primeiroAt &&
          ` · 1º AT: ${data.primeiroAt.hunter} em ${formatBR(data.primeiroAt.data)}`}
      </p>
      {grupo !== "todos" && shown.length > 0 && (
        <GroupTotals rows={shown} grupo={grupo} subgrupo={subgrupo} />
      )}
      <CompetitionTable rows={shown} isLoading={isLoading} />
      {data && !semana && <WeeklyWinners weeks={data.weeks} />}
      <ScoringRules />
    </div>
  );
}
