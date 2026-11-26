import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { VisaoDados } from "@/hooks/useDashboard";
import { rotuloSafra } from "@/lib/safras";
import { num } from "../format";
import { Section } from "../shared";

type Visao = VisaoDados["visao"];

const RITMO: ChartConfig = {
  marcadas: { label: "Marcadas", color: "var(--chart-1)" },
  realizadas: { label: "Realizadas", color: "var(--chart-2)" },
  avancaram: { label: "Avançaram", color: "var(--chart-3)" },
};

/** ATs marcadas, realizadas e que avançaram por semana, com as metas tracejadas. */
export function RitmoSemanal({ v, nomeCiclo }: { v: Visao; nomeCiclo: string }) {
  const dados = v.ritmo.map((w) => ({
    semana: rotuloSafra(w.numero),
    marcadas: w.futura ? null : w.marcadas,
    realizadas: w.futura ? null : w.realizadas,
    avancaram: w.futura ? null : w.avancaram,
  }));
  return (
    <Section
      title={`ATs por semana (${nomeCiclo})`}
      hint="Marcadas pela semana do registro, realizadas pela semana da AT, avançaram pela semana em que o card chegou à AT de Aprofundamento."
    >
      <figure>
        <ChartContainer
          config={RITMO}
          className="aspect-auto h-60 w-full"
          aria-label={`ATs por semana: ${v.ritmo
            .filter((w) => !w.futura)
            .map(
              (w) =>
                `${rotuloSafra(w.numero)} ${w.marcadas} marcadas, ${w.realizadas} realizadas, ${w.avancaram} avançaram`,
            )
            .join("; ")}`}
        >
          <LineChart data={dados} margin={{ left: -16, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            {v.metaSemanalAts !== null && (
              <ReferenceLine
                y={v.metaSemanalAts}
                stroke="var(--color-marcadas)"
                strokeDasharray="4 4"
                label={{
                  value: `meta de marcadas ${num(v.metaSemanalAts)}`,
                  position: "insideTopRight",
                  fontSize: 12,
                  fill: "var(--muted-foreground)",
                }}
              />
            )}
            {v.metaSemanalAvancaram !== null && (
              <ReferenceLine
                y={v.metaSemanalAvancaram}
                stroke="var(--color-avancaram)"
                strokeDasharray="4 4"
                label={{
                  value: `meta de avanços ${num(v.metaSemanalAvancaram)}`,
                  position: "insideBottomRight",
                  fontSize: 12,
                  fill: "var(--muted-foreground)",
                }}
              />
            )}
            {(["marcadas", "realizadas", "avancaram"] as const).map((k) => (
              <Line
                key={k}
                dataKey={k}
                stroke={`var(--color-${k})`}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
        <figcaption className="mt-2 text-caption text-subtle-foreground">
          Metas tracejadas: marcadas pela soma das metas semanais dos hunters; avanços pela meta do
          ciclo dividida pelas semanas. Fonte: ATs da plataforma e cópia do Pipedrive.
        </figcaption>
      </figure>
    </Section>
  );
}

const ORIGEM: ChartConfig = {
  mesma: { label: "Safra da semana", color: "var(--chart-1)" },
  anterior: { label: "Safra anterior", color: "var(--chart-2)" },
  antigas: { label: "Mais antigas", color: "var(--chart-3)" },
  fora: { label: "Fora de cadência", color: "var(--chart-muted)" },
};

/** ATs marcadas em cada semana, empilhadas pela safra de origem do contato. */
export function AtsPorOrigem({ v }: { v: Visao }) {
  const dados = v.ritmo
    .filter((w) => !w.futura)
    .map((w) => {
      const linha = { semana: rotuloSafra(w.numero), mesma: 0, anterior: 0, antigas: 0, fora: 0 };
      for (const [k, n] of Object.entries(w.porSafra)) {
        if (k === "fora") linha.fora += n;
        else if (Number(k) === w.numero) linha.mesma += n;
        else if (Number(k) === w.numero - 1) linha.anterior += n;
        else linha.antigas += n;
      }
      return linha;
    });
  return (
    <Section
      title="ATs marcadas por safra de origem"
      hint="De que safra vêm as ATs de cada semana. A cor diz a relação com a semana, não o número da safra."
    >
      <figure>
        <ChartContainer
          config={ORIGEM}
          className="aspect-auto h-60 w-full"
          aria-label={`ATs marcadas por safra de origem: ${dados
            .map(
              (d) =>
                `${d.semana}: ${d.mesma} da própria safra, ${d.anterior} da anterior, ${d.antigas} mais antigas, ${d.fora} fora de cadência`,
            )
            .join("; ")}`}
        >
          <BarChart data={dados} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            {(["mesma", "anterior", "antigas", "fora"] as const).map((k, i, todos) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="origem"
                isAnimationActive={false}
                fill={`var(--color-${k})`}
                radius={i === todos.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <figcaption className="mt-2 text-caption text-subtle-foreground">
          Fora de cadência: AT sem contato ligado ou de contato fora das safras. Fonte: ATs da
          plataforma.
        </figcaption>
      </figure>
    </Section>
  );
}
