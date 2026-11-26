import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { SegmentosDados } from "@/hooks/useDashboard";
import { mediasDaDimensao, type Decisao, type Segmento } from "@/lib/dashSegmentos";
import { cn } from "@/lib/utils";
import { num } from "../format";
import { taxa } from "../hunters/format";
import { Section } from "../shared";

type Dim = SegmentosDados["segmentos"]["dimensoes"][number];
type Params = SegmentosDados["parametros"];

const DECISAO: Record<Decisao, { rotulo: string; icon: typeof CheckCircle2; cls: string }> = {
  fica: { rotulo: "Fica", icon: CheckCircle2, cls: "text-success" },
  ajusta: { rotulo: "Ajusta", icon: MinusCircle, cls: "text-warning-text" },
  troca: { rotulo: "Troca", icon: XCircle, cls: "text-destructive-text" },
};

const CONFIG: ChartConfig = {
  ok: { label: "Segmento", color: "var(--chart-1)" },
  pequeno: { label: "Amostra pequena", color: "var(--chart-muted)" },
};
const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;

/** Prospect → AT × % avanço de cada segmento da dimensão, com a tabela e a decisão. */
export function Matriz({ dim, p }: { dim: Dim; p: Params }) {
  const medias = mediasDaDimensao(dim.segmentos);
  // Na dispersão só entram segmentos com ATs realizadas (sem % avanço não há ponto).
  const pontos = dim.segmentos
    .filter((s) => s.valor !== null && s.realizadas > 0)
    .map((s) => ({
      nome: s.rotulo,
      x: pct(s.prospectAt.n, s.prospectAt.d),
      y: pct(s.avanco.n, s.avanco.d),
      pequeno: s.pequeno,
    }));
  const titulo = `Prospect → AT × % avanço por ${dim.rotulo.toLowerCase()}`;
  return (
    <Section
      title={titulo}
      hint="Quem converte em AT e quem avança depois da AT. Amostra pequena fica em cinza e sem decisão."
    >
      {dim.segmentos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          Nenhum contato em safra madura ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {pontos.length > 0 && (
            <figure>
              <ChartContainer
                config={CONFIG}
                className="aspect-auto h-72 w-full"
                aria-label={`${titulo}: ${pontos.map((x) => `${x.nome} ${num(x.x)}% e ${num(x.y)}%${x.pequeno ? " (amostra pequena)" : ""}`).join("; ")}`}
              >
                <ScatterChart margin={{ left: 0, right: 24, top: 16, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Prospect → AT"
                    unit="%"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    domain={[0, "auto"]}
                    label={{
                      value: "Prospect → AT (%)",
                      position: "insideBottom",
                      offset: -4,
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="% avanço"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    domain={[0, 100]}
                    label={{ value: "% avanço", angle: -90, position: "insideLeft", fontSize: 12 }}
                  />
                  <ZAxis range={[70, 70]} />
                  {medias.prospectAt !== null && (
                    <ReferenceLine
                      x={medias.prospectAt}
                      stroke="var(--chart-goal)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {medias.avanco !== null && (
                    <ReferenceLine
                      y={medias.avanco}
                      stroke="var(--chart-goal)"
                      strokeDasharray="4 4"
                    />
                  )}
                  <ChartTooltip
                    cursor={false}
                    content={({ payload }) => {
                      const x = payload?.[0]?.payload as (typeof pontos)[number] | undefined;
                      return x ? (
                        <div className="rounded-md border bg-popover px-2.5 py-1.5 text-caption">
                          <p className="font-semibold text-heading">{x.nome}</p>
                          <p>Prospect → AT: {num(x.x)}%</p>
                          <p>% avanço: {num(x.y)}%</p>
                          {x.pequeno && <p className="text-muted-foreground">Amostra pequena</p>}
                        </div>
                      ) : null;
                    }}
                  />
                  {(["ok", "pequeno"] as const).map((k) => (
                    <Scatter
                      key={k}
                      data={pontos.filter((x) => x.pequeno === (k === "pequeno"))}
                      fill={`var(--color-${k})`}
                      fillOpacity={0.7}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="nome"
                        position="top"
                        fontSize={12}
                        fill={k === "ok" ? "var(--foreground)" : "var(--muted-foreground)"}
                      />
                    </Scatter>
                  ))}
                </ScatterChart>
              </ChartContainer>
              <figcaption className="mt-2 text-caption text-subtle-foreground">
                Linhas tracejadas: taxas da base inteira ({num(medias.prospectAt ?? 0)}% e{" "}
                {num(medias.avanco ?? 0)}%). Acima e à direita: converte e avança; abaixo e à
                direita: marca AT, mas não avança (rever a qualificação).
              </figcaption>
            </figure>
          )}
          <TabelaSegmentos segmentos={dim.segmentos} rotulo={dim.rotulo} p={p} />
        </div>
      )}
    </Section>
  );
}

function TabelaSegmentos({
  segmentos,
  rotulo,
  p,
}: {
  segmentos: readonly Segmento[];
  rotulo: string;
  p: Params;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-dense w-full">
        <caption className="sr-only">{rotulo}: conversão e avanço de cada segmento</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left">
              Segmento
            </th>
            <th scope="col" className="text-right">
              Contatos
            </th>
            <th scope="col" className="text-right">
              Prospect → AT
            </th>
            <th scope="col" className="text-right">
              Realizadas
            </th>
            <th scope="col" className="text-right">
              % avanço
            </th>
            <th scope="col" className="text-left">
              Decisão
            </th>
          </tr>
        </thead>
        <tbody>
          {segmentos.map((s) => {
            const d = s.decisao ? DECISAO[s.decisao] : null;
            return (
              <tr key={s.valor ?? "sem"} className={cn(s.pequeno && "text-muted-foreground")}>
                <th
                  scope="row"
                  className={cn("text-left font-normal", !s.pequeno && "text-heading")}
                >
                  {s.rotulo}
                </th>
                <td className="text-right tabular-nums">{num(s.contatos)}</td>
                <td className="text-right tabular-nums">{taxa(s.prospectAt.n, s.prospectAt.d)}</td>
                <td className="text-right tabular-nums">{num(s.realizadas)}</td>
                <td className="text-right tabular-nums">{taxa(s.avanco.n, s.avanco.d)}</td>
                <td>
                  {d ? (
                    <span className={cn("inline-flex items-center gap-1 font-semibold", d.cls)}>
                      <d.icon className="size-3.5" aria-hidden />
                      {d.rotulo}
                    </span>
                  ) : (
                    <span className="text-caption">
                      {s.valor === null ? "sem a informação" : "amostra pequena"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-subtle-foreground">
        Decisão pela % avanço: fica a partir de {p.avancoFicaPct}%, ajusta a partir de{" "}
        {p.avancoTrocaPct}%, troca abaixo disso. Amostra pequena: menos de {p.minAtsSegmento}{" "}
        {p.minAtsSegmento === 1 ? "AT realizada" : "ATs realizadas"}.
      </p>
    </div>
  );
}
