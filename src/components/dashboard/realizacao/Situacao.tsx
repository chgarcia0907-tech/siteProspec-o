import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RealizacaoDados } from "@/hooks/useDashboard";
import { rotuloSafra } from "@/lib/safras";
import { num } from "../format";
import { Section } from "../shared";

type R = RealizacaoDados["realizacao"];

// Cores da situação da AT (DESIGN.md, 6c): realizada success, no-show destructive,
// agendada/sem desfecho warning (agendada só com contorno), cancelada chart-muted.
const SITUACAO: ChartConfig = {
  realizada: { label: "Realizada", color: "var(--success)" },
  noShow: { label: "No-show", color: "var(--destructive)" },
  cancelada: { label: "Cancelada", color: "var(--chart-muted)" },
  semDesfecho: { label: "Sem desfecho", color: "var(--warning)" },
  // Agendada: tom claro do warning (o mesmo da faixa), com contorno tracejado na barra.
  agendada: { label: "Agendada", color: "color-mix(in oklch, var(--warning) 35%, var(--card))" },
};
const ORDEM = ["realizada", "noShow", "cancelada", "semDesfecho", "agendada"] as const;

/** Eixo com a semana e, embaixo, quantas ATs dela foram remarcadas. */
function TickSemana({
  x,
  y,
  payload,
  remarcadas,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  remarcadas: Record<string, number>;
}) {
  const n = payload ? (remarcadas[payload.value] ?? 0) : 0;
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
      <tspan x={x} dy={12}>
        {payload?.value}
      </tspan>
      <tspan x={x} dy={16} fill="var(--subtle-foreground)">
        {n ? `↻ ${n} remarcada${n > 1 ? "s" : ""}` : ""}
      </tspan>
    </text>
  );
}

/** ATs de cada semana (pela data da AT), empilhadas pela situação. */
export function SituacaoSemanal({ r, nomeCiclo }: { r: R; nomeCiclo: string }) {
  const dados = r.situacao.map((s) => ({
    semana: rotuloSafra(s.numero),
    realizada: s.realizada,
    noShow: s.noShow,
    cancelada: s.cancelada,
    semDesfecho: s.semDesfecho,
    agendada: s.agendada,
  }));
  const remarcadas = Object.fromEntries(
    r.situacao.map((s) => [rotuloSafra(s.numero), s.remarcadas]),
  );
  return (
    <Section
      title={`Situação das ATs por semana (${nomeCiclo})`}
      hint="Semana da data da AT. Sem desfecho: a data passou e a AT segue agendada (remarcar)."
    >
      <figure>
        <ChartContainer
          config={SITUACAO}
          className="aspect-auto h-64 w-full"
          aria-label={`Situação das ATs por semana: ${r.situacao
            .map(
              (s) =>
                `${rotuloSafra(s.numero)}: ${s.realizada} realizadas, ${s.noShow} no-show, ${s.cancelada} canceladas, ${s.semDesfecho} sem desfecho, ${s.agendada} agendadas, ${s.remarcadas} remarcadas`,
            )
            .join("; ")}`}
        >
          <BarChart data={dados} margin={{ left: -16, right: 8, top: 8, bottom: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="semana"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={<TickSemana remarcadas={remarcadas} />}
            />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            {ORDEM.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="situacao"
                fill={`var(--color-${k})`}
                stroke={k === "agendada" ? "var(--warning)" : undefined}
                strokeDasharray={k === "agendada" ? "3 2" : undefined}
                radius={i === ORDEM.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <figcaption className="mt-2 text-caption text-subtle-foreground">
          {num(r.totais.ats)} ATs no recorte. Cancelada conta como não realizada. Fonte: ATs da
          plataforma e log de eventos.
        </figcaption>
      </figure>
    </Section>
  );
}
