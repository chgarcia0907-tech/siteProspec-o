import { Link } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { pct } from "@/lib/dashboard";
import type { IndicadoresBusca } from "@/lib/indicadores";
import { cn } from "@/lib/utils";
import { Section } from "./shared";
import { dm, num, pctText, type Dash } from "./format";

type Metric = "envios" | "respostas" | "ats" | "importados" | "conversao";
const CONFIG: Record<Metric, ChartConfig> = {
  envios: { value: { label: "Mensagens", color: "var(--chart-1)" } },
  ats: { value: { label: "ATs", color: "var(--chart-1)" } },
  importados: { value: { label: "Importados", color: "var(--chart-1)" } },
  respostas: { value: { label: "Respostas", color: "var(--chart-1)" } },
  conversao: { value: { label: "Conversão (%)", color: "var(--chart-1)" } },
};

/** Últimas 12 semanas: uma medida por gráfico (escalas diferentes não dividem eixo). */
export function Tendencia({ d }: { d: Dash }) {
  const data = d.trend.map((w) => ({
    semana: dm(w.inicio),
    envios: w.envios,
    ats: w.ats,
    importados: w.importados,
    respostas: w.respostas,
    // Semana sem LinkedIn 1 não tem conversão: fica em branco no gráfico, não em 0%.
    conversao: pct(w.ats, w.l1),
  }));
  return (
    <Section
      title="Tendência das últimas 12 semanas"
      hint="Semanas de segunda a domingo, terminando na semana do fim do intervalo."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Mini title="Mensagens enviadas" metric="envios" data={data} kind="bar" />
        <Mini title="ATs marcadas" metric="ats" data={data} kind="bar" />
        <Mini title="Conversão LinkedIn 1 → AT (%)" metric="conversao" data={data} kind="line" />
        <Mini title="Respostas" metric="respostas" data={data} kind="bar" />
        <Mini title="Contatos importados" metric="importados" data={data} kind="bar" />
      </div>
    </Section>
  );
}

function Mini({
  title,
  metric,
  data,
  kind,
}: {
  title: string;
  metric: Metric;
  data: ({ semana: string } & Record<Metric, number | null>)[];
  kind: "bar" | "line";
}) {
  const rows = data.map((r) => ({ semana: r.semana, value: r[metric] }));
  return (
    <figure>
      <figcaption className="mb-1 text-caption font-medium">{title}</figcaption>
      <ChartContainer config={CONFIG[metric]} className="aspect-auto h-40 w-full">
        {kind === "bar" ? (
          <BarChart data={rows} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="linear"
              connectNulls={false}
            />
          </LineChart>
        )}
      </ChartContainer>
    </figure>
  );
}

/** Coortes: dos que receberam LinkedIn 1 na semana, quantos viraram AT em 14 e 28 dias. */
export function Coortes({ d }: { d: Dash }) {
  const rows = [...d.cohorts].reverse().filter((c) => c.l1 > 0);
  return (
    <Section
      title="Coortes de LinkedIn 1"
      hint="Conversão sem misturar contatos novos e antigos. “parcial” = ainda não passaram 14/28 dias do fim da semana."
    >
      {rows.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          Nenhum LinkedIn 1 nas últimas 12 semanas.
        </p>
      ) : (
        <table className="w-full text-dense">
          <thead className="text-left text-caption text-muted-foreground">
            <tr>
              <th className="py-1">Semana</th>
              <th className="py-1 text-right">LinkedIn 1</th>
              <th className="py-1 text-right">Resposta em 14 dias</th>
              <th className="py-1 text-right">AT em 14 dias</th>
              <th className="py-1 text-right">AT em 28 dias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.inicio} className="border-t">
                <td className="py-1">{dm(c.inicio)}</td>
                <td className="py-1 text-right tabular-nums">{num(c.l1)}</td>
                <Rate n={c.resp14} of={c.l1} mature={c.mature14} />
                <Rate n={c.at14} of={c.l1} mature={c.mature14} />
                <Rate n={c.at28} of={c.l1} mature={c.mature28} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function Rate({ n, of, mature }: { n: number; of: number; mature: boolean }) {
  return (
    <td className={cn("py-1 text-right tabular-nums", !mature && "text-muted-foreground")}>
      {pctText(pct(n, of))} <span className="text-caption">({n})</span>
      {!mature && <span className="ml-1 text-caption">parcial</span>}
    </td>
  );
}

const ALERTS_SHOWN = 5;

/** Lista do que precisa de ação hoje, mais urgente primeiro (os 5 primeiros; o resto abre sob demanda). */
export function Alertas({
  d,
  linkFor,
}: {
  d: Dash;
  /** Busca do atalho para a Execução do hunter; nulo quando o nome não leva a um hunter só. */
  linkFor: (name: string) => IndicadoresBusca | null;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? d.alerts : d.alerts.slice(0, ALERTS_SHOWN);
  return (
    <Section
      title={`Quem precisa de ajuda (${d.alerts.length})`}
      hint="O que precisa de ação hoje."
    >
      {d.alerts.length === 0 ? (
        <p className="text-dense text-muted-foreground">Ninguém precisa de ajuda agora.</p>
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((a, i) => {
              const to = a.hunter ? linkFor(a.hunter) : null;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 py-2.5 text-dense first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "mt-px w-14 shrink-0 rounded-sm py-0.5 text-center text-caption font-bold uppercase",
                      a.level === "alta"
                        ? "bg-destructive-soft text-destructive-text"
                        : "bg-warning-soft text-warning-text",
                    )}
                  >
                    {a.level === "alta" ? "Alta" : "Média"}
                  </span>
                  <span>
                    {a.hunter &&
                      (to ? (
                        <>
                          <Link
                            to="/dashboard"
                            search={{ ...to, aba: "indicadores" }}
                            hash="execucao"
                            className="font-semibold text-heading underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {a.hunter}
                          </Link>
                          {": "}
                        </>
                      ) : (
                        <strong className="text-heading">{a.hunter}: </strong>
                      ))}
                    {a.text}
                  </span>
                </li>
              );
            })}
          </ul>
          {d.alerts.length > ALERTS_SHOWN && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3 -ml-2.5"
              aria-expanded={all}
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Mostrar só os mais urgentes" : `Ver todos os ${d.alerts.length}`}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}
