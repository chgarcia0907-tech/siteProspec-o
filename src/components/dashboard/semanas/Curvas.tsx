import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useCurvas, type CurvasDados } from "@/hooks/useDashboard";
import { spParts } from "@/lib/cadencia";
import { filtrosDaBusca } from "@/lib/indicadores";
import { painelDashboard } from "@/lib/painel.functions";
import { rotuloSafra } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { Abastecimento } from "../Funil";
import { dm, num } from "../format";
import { Section } from "../shared";

type C = CurvasDados["curvas"];
const diasTexto = (n: number) => `${num(n)} ${n === 1 ? "dia" : "dias"}`;
const CORES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

/** Curvas de safra, dias até a primeira AT e mapa safra × semana do ciclo. */
export function CurvasDoCiclo({
  periodId,
  onUsarMaturacao,
}: {
  periodId: string;
  onUsarMaturacao: (semanas: number) => void;
}) {
  const { data: d, isLoading, error } = useCurvas(periodId);
  if (isLoading) return <p className="text-dense text-muted-foreground">Carregando as curvas…</p>;
  if (error || !d)
    return <p className="text-dense text-destructive-text">Não foi possível carregar as curvas.</p>;
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <CurvasSafra c={d.curvas} />
        <Distribuicao c={d.curvas} atual={d.maturacaoAtual} onUsar={onUsarMaturacao} />
      </div>
      <MapaSafras c={d.curvas} />
    </>
  );
}

function CurvasSafra({ c }: { c: C }) {
  const curvas = c.curvas.filter((x) => x.contatos > 0);
  const semanas = Math.max(0, ...curvas.map((x) => x.pontos.length));
  // Uma linha por safra; a semana parcial (a de hoje) vai numa série tracejada à parte.
  const dados = Array.from({ length: semanas }, (_, k) => {
    const linha: Record<string, number | string | null> = { semana: `${k}` };
    for (const x of curvas) {
      const p = x.pontos[k];
      linha[`s${x.numero}`] = p && !p.parcial ? p.pct : null;
      // A série parcial liga o último ponto fechado ao ponto da semana de hoje.
      linha[`p${x.numero}`] = p && (p.parcial || x.pontos[k + 1]?.parcial) ? p.pct : null;
    }
    return linha;
  });
  const config: ChartConfig = Object.fromEntries(
    curvas.flatMap((x, i) => [
      [`s${x.numero}`, { label: rotuloSafra(x.numero), color: `var(${CORES[i % CORES.length]})` }],
    ]),
  );
  return (
    <Section
      title="Curvas de safra"
      hint="% acumulada dos contatos de cada safra que já chegaram à AT, semana a semana desde o início da safra."
    >
      {curvas.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhuma safra com contatos ainda.</p>
      ) : (
        <figure>
          <ChartContainer
            config={config}
            className="aspect-auto h-64 w-full"
            aria-label={`Curvas de safra: ${curvas
              .map(
                (x) =>
                  `${rotuloSafra(x.numero)} (${x.contatos} contatos): ${x.pontos.map((p) => `semana ${p.semana} ${num(p.pct)}%`).join(", ")}`,
              )
              .join("; ")}`}
          >
            <LineChart data={dados} margin={{ left: -8, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="semana"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                label={{
                  value: "Semanas desde o início da safra",
                  position: "insideBottom",
                  offset: -4,
                  fontSize: 12,
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                unit="%"
                domain={[0, "auto"]}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
              {curvas.map((x, i) => {
                const cor = `var(${CORES[i % CORES.length]})`;
                return [
                  <Line
                    key={`s${x.numero}`}
                    dataKey={`s${x.numero}`}
                    stroke={cor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />,
                  <Line
                    key={`p${x.numero}`}
                    dataKey={`p${x.numero}`}
                    stroke={cor}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fillOpacity: 0.4 }}
                    legendType="none"
                    tooltipType="none"
                    isAnimationActive={false}
                  />,
                ];
              })}
            </LineChart>
          </ChartContainer>
          <figcaption className="mt-2 text-caption text-subtle-foreground">
            Trecho tracejado: a semana de hoje, ainda em andamento. Base: primeira AT registrada de
            cada contato da safra.
          </figcaption>
        </figure>
      )}
    </Section>
  );
}

function Distribuicao({
  c,
  atual,
  onUsar,
}: {
  c: C;
  atual: number;
  onUsar: (semanas: number) => void;
}) {
  const d = c.distribuicao;
  const max = Math.max(1, ...d.faixas.map((f) => f.n));
  const sugerida = d.maturacaoSugerida;
  return (
    <Section
      title="Dias do cadastro à primeira AT"
      hint="Quanto tempo um contato leva para virar AT. O P90 calibra a janela de maturação."
    >
      {d.total === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhum contato das safras com AT ainda.</p>
      ) : (
        <>
          <dl className="space-y-2">
            {d.faixas.map((f) => (
              <div key={f.faixa} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-3">
                <dt className="text-dense text-muted-foreground">{f.faixa}</dt>
                <dd className="h-3 rounded-sm bg-surface-inset">
                  <span
                    className="block h-3 rounded-sm bg-chart-1"
                    style={{ width: `${f.n ? Math.max((f.n / max) * 100, 2) : 0}%` }}
                  />
                </dd>
                <dd className="text-right text-dense tabular-nums">{num(f.n)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-dense">
            <span className="text-muted-foreground">P50:</span>{" "}
            <span className="font-semibold text-heading tabular-nums">{diasTexto(d.p50 ?? 0)}</span>
            <span className="text-muted-foreground"> · P90:</span>{" "}
            <span className="font-semibold text-heading tabular-nums">{diasTexto(d.p90 ?? 0)}</span>
            <span className="text-muted-foreground"> · {num(d.total)} contatos</span>
          </p>
          {sugerida !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-surface-inset px-3 py-2">
              <p className="text-dense">
                Maturação sugerida:{" "}
                <span className="font-semibold text-heading">
                  {sugerida} {sugerida === 1 ? "semana" : "semanas"}
                </span>{" "}
                <span className="text-muted-foreground">(atual: {atual})</span>
              </p>
              {sugerida !== atual && (
                <Button size="sm" variant="secondary" onClick={() => onUsar(sugerida)}>
                  Usar {sugerida} {sugerida === 1 ? "semana" : "semanas"}
                </Button>
              )}
            </div>
          )}
          <p className="mt-2 text-caption text-subtle-foreground">
            Sugestão para o contato cadastrado na sexta ter até o P90 antes de a safra amadurecer.
          </p>
        </>
      )}
    </Section>
  );
}

function MapaSafras({ c }: { c: C }) {
  const { semanas, linhas } = c.mapa;
  const max = Math.max(1, ...linhas.flatMap((l) => l.ats));
  return (
    <Section
      title="Mapa safra × semana"
      hint="ATs registradas em cada semana, pela safra de origem do contato."
    >
      {linhas.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhuma safra começou ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">ATs registradas por safra e semana</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Safra
                </th>
                {semanas.map((w) => (
                  <th
                    key={w}
                    scope="col"
                    className="px-1 text-center text-caption font-semibold text-muted-foreground"
                  >
                    {dm(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.numero}>
                  <th scope="row" className="text-left font-normal whitespace-nowrap">
                    {rotuloSafra(l.numero)}
                  </th>
                  {l.ats.map((v, i) => (
                    <td key={semanas[i]} className="px-0.5 py-0.5">
                      <span
                        className={cn(
                          "block rounded-sm py-1.5 text-center text-caption tabular-nums",
                          v === 0 ? "text-subtle-foreground" : "text-heading",
                        )}
                        style={{
                          backgroundColor:
                            v === 0
                              ? "var(--surface-inset)"
                              : `color-mix(in oklch, var(--chart-1) ${15 + (55 * v) / max}%, var(--surface-inset))`,
                        }}
                      >
                        {v === 0 ? "·" : num(v)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** Abastecimento da fila e qualidade dos dados (o mesmo cálculo dos Indicadores, semana atual). */
export function AbastecimentoSemana({ periodId }: { periodId: string }) {
  const today = spParts().iso;
  const fn = useServerFn(painelDashboard);
  const { preset: _preset, ...input } = { ...filtrosDaBusca({}, today), periodId };
  const q = useQuery({
    queryKey: ["painel_dashboard", input, today],
    queryFn: () => fn({ data: { ...input, today } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  if (!q.data)
    return q.isError ? (
      <p className="text-dense text-destructive-text">Não foi possível carregar o abastecimento.</p>
    ) : null;
  return <Abastecimento d={q.data.dashboard} />;
}
