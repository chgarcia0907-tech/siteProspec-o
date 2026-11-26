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
import { formatBR } from "@/lib/cadencia";
import { concentracao, dispersoes, type Dispersao } from "@/lib/dashHunters";
import { rotuloSafra } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { dm, num } from "../format";
import { Section } from "../shared";
import { taxa, type Dados } from "./format";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Mapa de calor hunter × dia: contatos adicionados + passos enviados, com o valor na célula. */
export function CalorSemana({ d }: { d: Dados }) {
  const max = Math.max(1, ...d.hunters.flatMap((h) => h.calor));
  return (
    <Section
      title="Atividade por dia"
      hint="Contatos adicionados + passos enviados em cada dia da semana."
    >
      <div className="overflow-x-auto">
        <table className="table-dense w-full">
          <caption className="sr-only">Atividade de cada hunter por dia da semana</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left">
                Hunter
              </th>
              {d.dias.map((dia, i) => (
                <th
                  key={dia}
                  scope="col"
                  className="px-1 py-1 text-center text-caption font-semibold text-muted-foreground"
                  title={formatBR(dia)}
                >
                  {DIAS[i]}
                  <span className="block font-normal">{dm(dia)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.hunters.map((h) => (
              <tr key={h.id}>
                <th scope="row" className="px-2 py-1 text-left font-normal whitespace-nowrap">
                  {h.nome}
                </th>
                {h.calor.map((v, i) => (
                  <td key={d.dias[i]} className="px-0.5 py-0.5">
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
    </Section>
  );
}

/**
 * Participação nas ATs por semana: hunters nas linhas, semanas das safras nas colunas, a fatia de
 * cada um ("40% (2 de 5)") e selo quando passa do limite de concentração. Hunters não ganham cor
 * própria (DESIGN.md 6c): a intensidade do fundo acompanha a fatia.
 */
export function ParticipacaoAts({ d }: { d: Dados }) {
  const semanas = d.participacao;
  const altos = new Map(
    semanas.map((s) => [s.semana, new Set(concentracao(s, d.concentracaoAtsPct))]),
  );
  const numero = new Map(d.safras.map((s) => [s.inicio, s.numero]));
  return (
    <Section
      title="Participação nas ATs por semana"
      hint={`Fatia de cada hunter nas ATs marcadas da equipe. Acima de ${d.concentracaoAtsPct}% aparece o alerta de concentração.`}
    >
      {semanas.every((s) => s.total === 0) ? (
        <p className="text-dense text-muted-foreground">Nenhuma AT marcada nas semanas do ciclo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Participação de cada hunter nas ATs por semana</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Hunter
                </th>
                {semanas.map((s) => (
                  <th
                    key={s.semana}
                    scope="col"
                    className="px-1 py-1 text-center text-caption font-semibold text-muted-foreground"
                  >
                    {rotuloSafra(numero.get(s.semana) ?? 0)}
                    <span className="block font-normal">
                      {num(s.total)} {s.total === 1 ? "AT" : "ATs"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.hunters.map((h) => (
                <tr key={h.id}>
                  <th scope="row" className="px-2 py-1 text-left font-normal whitespace-nowrap">
                    {h.nome}
                  </th>
                  {semanas.map((s) => {
                    const n = s.porHunter[h.id] ?? 0;
                    const alto = altos.get(s.semana)?.has(h.id);
                    const frac = s.total ? n / s.total : 0;
                    return (
                      <td key={s.semana} className="px-0.5 py-0.5">
                        <span
                          className="block rounded-sm px-1 py-1.5 text-center text-caption tabular-nums"
                          style={{
                            backgroundColor:
                              n === 0
                                ? "var(--surface-inset)"
                                : `color-mix(in oklch, var(--chart-1) ${15 + 55 * frac}%, var(--surface-inset))`,
                          }}
                        >
                          {s.total === 0 ? "—" : taxa(n, s.total)}
                        </span>
                        {alto && (
                          <span className="mt-0.5 block text-center text-caption font-semibold text-warning-text">
                            concentração
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const CONFIG: ChartConfig = { y: { label: "Hunter", color: "var(--chart-1)" } };

function GraficoDispersao({
  titulo,
  hint,
  dados,
  rotuloX,
  rotuloY,
  sufixoX,
  vazio,
  fonte,
}: {
  titulo: string;
  hint: string;
  dados: Dispersao;
  rotuloX: string;
  rotuloY: string;
  sufixoX: string;
  vazio: string;
  fonte: string;
}) {
  return (
    <Section title={titulo} hint={hint}>
      {dados.pontos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <figure>
          <ChartContainer
            config={CONFIG}
            className="aspect-auto h-64 w-full"
            aria-label={`${titulo}: ${dados.pontos.map((p) => `${p.nome} ${num(p.x)}${sufixoX} e ${num(p.y)}`).join("; ")}`}
          >
            <ScatterChart margin={{ left: 0, right: 16, top: 12, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                type="number"
                dataKey="x"
                name={rotuloX}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                label={{ value: rotuloX, position: "insideBottom", offset: -4, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={rotuloY}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                domain={[0, "auto"]}
                label={{ value: rotuloY, angle: -90, position: "insideLeft", fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="n" range={[60, 60]} />
              {dados.mediaX !== null && (
                <ReferenceLine x={dados.mediaX} stroke="var(--chart-goal)" strokeDasharray="4 4" />
              )}
              {dados.mediaY !== null && (
                <ReferenceLine y={dados.mediaY} stroke="var(--chart-goal)" strokeDasharray="4 4" />
              )}
              <ChartTooltip
                cursor={false}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as Dispersao["pontos"][number] | undefined;
                  return p ? (
                    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-caption">
                      <p className="font-semibold text-heading">{p.nome}</p>
                      <p>
                        {rotuloX}: {num(p.x)}
                        {sufixoX}
                      </p>
                      <p>
                        {rotuloY}: {num(p.y)}
                      </p>
                    </div>
                  ) : null;
                }}
              />
              <Scatter
                data={dados.pontos.map((p) => ({ ...p, rotulo: p.nome.split(" ")[0] }))}
                fill="var(--color-y)"
                fillOpacity={0.7}
              >
                <LabelList dataKey="rotulo" position="top" fontSize={12} fill="var(--foreground)" />
              </Scatter>
            </ScatterChart>
          </ChartContainer>
          <figcaption className="mt-2 text-caption text-subtle-foreground">
            Linhas tracejadas: média dos hunters ({num(dados.mediaX ?? 0)}
            {sufixoX} e {num(dados.mediaY ?? 0)}). {fonte}
          </figcaption>
        </figure>
      )}
    </Section>
  );
}

/** As duas dispersões da Visão Equipe. */
export function Dispersoes({ d }: { d: Dados }) {
  const { volumeAvanco, disciplinaResultado } = dispersoes(d.hunters);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <GraficoDispersao
        titulo="Avanço por ATs realizadas (safras maduras)"
        hint="Quem realiza muitas ATs e avança pouco precisa de ajuda na qualificação."
        dados={volumeAvanco}
        rotuloX="ATs realizadas"
        rotuloY="% avanço"
        sufixoX=""
        vazio="Nenhuma safra madura ainda: o avanço só é comparado depois da janela de maturação."
        fonte="Fonte: ATs da plataforma e etapa do card no Pipedrive."
      />
      <GraficoDispersao
        titulo="ATs por 100 contatos por % no prazo (ciclo)"
        hint="Disciplina na cadência vira resultado? Quem está no prazo e marca pouco revê a mensagem."
        dados={disciplinaResultado}
        rotuloX="% de passos no prazo"
        rotuloY="ATs por 100 contatos"
        sufixoX="%"
        vazio="Ainda sem passos devidos no ciclo."
        fonte="Fonte: contatos e ATs da plataforma."
      />
    </div>
  );
}
