import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getCompetition } from "@/lib/admin.functions";
import { formatBR } from "@/lib/cadencia";
import { cn } from "@/lib/utils";
import { addDaysISO, todayISO } from "@/lib/cadencia";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking dos hunters — Cadência Outbound" },
      {
        name: "description",
        content:
          "Compare importações, mensagens enviadas, cadências concluídas e respostas por hunter.",
      },
      { property: "og:title", content: "Ranking dos hunters" },
      {
        property: "og:description",
        content:
          "Compare importações, mensagens enviadas, cadências concluídas e respostas por hunter.",
      },
    ],
  }),
  component: Ranking,
});

type Row = {
  hunter_id: string;
  hunter_name: string;
  importados: number;
  enviadas1: number;
  enviadas2: number;
  enviadas3: number;
  enviadas4: number;
  enviadas5: number;
  concluidas: number;
  respostas: number;
};

const PERIODS = {
  hoje: { label: "Hoje", days: 0 },
  semana: { label: "Semana", days: 6 },
  mes: { label: "Mês", days: 29 },
} as const;

function Ranking() {
  const [period, setPeriod] = useState<keyof typeof PERIODS>("hoje");
  const start = addDaysISO(todayISO(), -PERIODS[period].days);

  const { data, isLoading } = useQuery({
    queryKey: ["ranking", start],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("ranking", {
        period_start: start,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = [...(data ?? [])].sort(
    (a, b) =>
      b.enviadas1 +
      b.enviadas2 +
      b.enviadas3 +
      b.enviadas4 +
      b.enviadas5 -
      (a.enviadas1 + a.enviadas2 + a.enviadas3 + a.enviadas4 + a.enviadas5),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ranking da competição</h1>
      </div>
      <CompetitionBoard />
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Atividade</h2>
          <p className="text-sm text-muted-foreground">
            Mensagens enviadas por etapa — período a partir de {formatBR(start)}.
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as keyof typeof PERIODS)}>
          <TabsList>
            {Object.entries(PERIODS).map(([key, p]) => (
              <TabsTrigger key={key} value={key}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métricas de atividade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Hunter</TableHead>
                  <TableHead className="text-right">Importados</TableHead>
                  <TableHead className="text-right">LinkedIn 1</TableHead>
                  <TableHead className="text-right">WhatsApp 1</TableHead>
                  <TableHead className="text-right">LinkedIn 2</TableHead>
                  <TableHead className="text-right">WhatsApp 2</TableHead>
                  <TableHead className="text-right">LinkedIn 3</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground">
                      Nenhum dado no período.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r, i) => (
                  <TableRow key={r.hunter_id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.hunter_name}</TableCell>
                    <TableCell className="text-right">{r.importados}</TableCell>
                    <TableCell className="text-right">{r.enviadas1}</TableCell>
                    <TableCell className="text-right">{r.enviadas2}</TableCell>
                    <TableCell className="text-right">{r.enviadas3}</TableCell>
                    <TableCell className="text-right">{r.enviadas4}</TableCell>
                    <TableCell className="text-right">{r.enviadas5}</TableCell>
                    <TableCell className="text-right font-semibold">{r.concluidas}</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {r.respostas}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PODIUM = ["bg-warning-soft", "bg-accent", "bg-linkedin-soft"];

function CompetitionBoard() {
  const fetchComp = useServerFn(getCompetition);
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState("geral");
  const [oficial, setOficial] = useState(true);
  const [grupo, setGrupo] = useState("todos");
  const [subgrupo, setSubgrupo] = useState("todos");
  const { data: periods } = useQuery({
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
  const grupos = [...new Set(baseRows.map((r) => r.grupo).filter(Boolean))].sort();
  const subgrupos = [
    ...new Set(
      baseRows
        .filter((r) => grupo === "todos" || r.grupo === grupo)
        .map((r) => r.subgrupo)
        .filter(Boolean),
    ),
  ].sort();
  const shown = baseRows.filter(
    (r) =>
      (grupo === "todos" || (grupo === "sem" ? !r.grupo : r.grupo === grupo)) &&
      (subgrupo === "todos" || r.subgrupo === subgrupo),
  );
  const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectCls}
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
        </select>
        {semanas.length > 0 && (
          <select
            className={selectCls}
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
          </select>
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
        <select
          className={selectCls}
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
        </select>
        {subgrupos.length > 0 && (
          <select
            className={selectCls}
            value={subgrupo}
            onChange={(e) => setSubgrupo(e.target.value)}
          >
            <option value="todos">Todos os subgrupos</option>
            {subgrupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Total do grupo: {grupo === "sem" ? "Sem grupo" : grupo}
              {subgrupo !== "todos" ? ` / ${subgrupo}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <p>
              <span className="block text-muted-foreground">Pontuação final (soma)</span>
              <b className="text-2xl">
                {shown
                  .reduce((a, r) => a + r.pontuacao_final, 0)
                  .toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              </b>
            </p>
            <p>
              <span className="block text-muted-foreground">Total de pontos (soma)</span>
              <b className="text-2xl">{shown.reduce((a, r) => a + r.total_pontos, 0)}</b>
            </p>
            <p>
              <span className="block text-muted-foreground">ATs</span>
              <b className="text-2xl">{shown.reduce((a, r) => a + r.ats, 0)}</b>
            </p>
            <p>
              <span className="block text-muted-foreground">Hunters</span>
              <b className="text-2xl">{shown.length}</b>
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto rounded-lg border">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Hunter</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">ATs</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Propostas</TableHead>
                  <TableHead className="text-right">Aprov. verbais</TableHead>
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Pontos funil</TableHead>
                  <TableHead className="text-right">Bônus 1º AT</TableHead>
                  <TableHead className="text-right">Bônus semanas</TableHead>
                  <TableHead className="text-right">Total pontos</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Pontuação final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={14} className="text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="text-muted-foreground">
                      Nenhum hunter neste filtro.
                    </TableCell>
                  </TableRow>
                )}
                {shown.map((r, i) => (
                  <TableRow
                    key={r.hunter_id}
                    className={cn(i < 3 && r.pontuacao_final > 0 && PODIUM[i])}
                  >
                    <TableCell className="font-semibold">
                      {i < 3 && r.pontuacao_final > 0 ? `${i + 1}º` : i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{r.hunter}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.grupo ? `${r.grupo}${r.subgrupo ? ` / ${r.subgrupo}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.ats}</TableCell>
                    <TableCell className="text-right">{r.leads}</TableCell>
                    <TableCell className="text-right">{r.propostas}</TableCell>
                    <TableCell className="text-right">{r.aprovacoes}</TableCell>
                    <TableCell className="text-right">{r.vendidos}</TableCell>
                    <TableCell className="text-right">{r.pontos_funil}</TableCell>
                    <TableCell className="text-right">{r.bonus_primeiro_at}</TableCell>
                    <TableCell className="text-right">
                      {r.bonus_semanas} ({r.semanas_vencidas} sem.)
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.total_pontos}</TableCell>
                    <TableCell className="text-right">
                      {r.taxa_conversao.toLocaleString("pt-BR")}%
                    </TableCell>
                    <TableCell className="text-right text-base font-bold">
                      {r.pontuacao_final.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {data && !semana && data.weeks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Semanas com mais ATs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.weeks.map((w) => (
              <p key={w.inicio}>
                {formatBR(w.inicio)} a {formatBR(w.fim)}
                {w.parcial && (
                  <span className="ml-1 rounded-full bg-muted px-2 text-[11px] font-semibold">
                    parcial
                  </span>
                )}
                {" — "}
                {w.vencedores.join(", ")} ({w.max} AT{w.max > 1 ? "s" : ""})
              </p>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como a pontuação é calculada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <b>Etapas do funil (cumulativas):</b> AT marcada +3 · Lead +5 · Proposta marcada +10 ·
            Aprovação verbal +25 · Projeto vendido +50. Um projeto vendido soma 93 pontos.
          </p>
          <p>
            <b>Data que conta para a AT:</b> o dia em que o hunter registrou a AT na plataforma (não
            o dia da reunião, que continua salvo para consulta).
          </p>
          <p>
            <b>1º AT do período:</b> +5 pontos, uma única vez, para quem registrou a primeira AT do
            período (não entra no ranking semanal).
          </p>
          <p>
            <b>Ciclo da equipe:</b> contam todos os contatos dos membros, pela data em que cada
            etapa foi registrada. O ranking de cada semana usa as mesmas regras, só com o que
            aconteceu naquela semana.
          </p>
          <p>
            <b>Mais ATs da semana:</b> +6 pontos para quem registrou mais ATs em cada semana
            (segunda a domingo, horário de São Paulo). Empatados ganham todos; semanas sem AT não
            dão bônus. A semana atual é parcial.
          </p>
          <p>
            <b>Taxa de conversão:</b> ATs ÷ contatos com LinkedIn 1 enviada (0 se não houver
            envios).
          </p>
          <p>
            <b>Pontuação final:</b> 0,7 × total de pontos + 0,3 × o número da taxa de conversão (7%
            conta como 7), com 1 casa decimal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
