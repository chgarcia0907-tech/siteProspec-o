import { AlertCircle, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { pct } from "@/lib/dashboard";
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
      <figcaption className="mb-1 text-xs font-medium">{title}</figcaption>
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
        <p className="text-sm text-muted-foreground">Nenhum LinkedIn 1 nas últimas 12 semanas.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
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
      {pctText(pct(n, of))} <span className="text-xs">({n})</span>
      {!mature && <span className="ml-1 text-[11px]">parcial</span>}
    </td>
  );
}

/** Lista do que precisa de ação hoje, mais urgente primeiro. */
export function Alertas({ d }: { d: Dash }) {
  return (
    <Section title={`Alertas (${d.alerts.length})`} hint="O que precisa de ação hoje.">
      {d.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada pendente. 🎉</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {d.alerts.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              {a.level === "alta" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              <span>
                <span
                  className={cn(
                    "mr-1 rounded px-1 text-[11px] font-medium",
                    a.level === "alta"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {a.level === "alta" ? "Alta" : "Média"}
                </span>
                {a.hunter && <strong>{a.hunter}: </strong>}
                {a.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
