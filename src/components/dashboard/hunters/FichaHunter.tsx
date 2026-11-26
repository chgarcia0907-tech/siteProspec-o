import { X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatBR } from "@/lib/cadencia";
import { sectorPath, type SectorNode } from "@/lib/empresas";
import { STATUS_SAFRA_LABEL, rotuloSafra } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { num } from "../format";
import { Section } from "../shared";
import { SeloEsforco } from "./shared";
import { taxa, type Dados, type Hunter } from "./format";

const ddmm = (iso: string) => formatBR(iso).slice(0, 5);

function Numero({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string | undefined;
}) {
  return (
    <div>
      <dt className="text-dense text-muted-foreground">{rotulo}</dt>
      <dd className="font-display text-card-title font-semibold text-heading tabular-nums">
        {valor}
        {detalhe && (
          <span className="ml-1 font-sans text-dense font-normal text-muted-foreground">
            {detalhe}
          </span>
        )}
      </dd>
    </div>
  );
}

const ESFORCO: ChartConfig = {
  real: { label: "Feito", color: "var(--chart-1)" },
  meta: { label: "Meta", color: "var(--chart-goal)" },
};

/** Ficha do hunter: as duas filas, esforço por semana, funil, canais, histórico e dupla. */
export function FichaHunter({
  d,
  h,
  setores,
  onFechar,
  onAbrir,
}: {
  d: Dados;
  h: Hunter;
  setores: readonly SectorNode[];
  onFechar: () => void;
  onAbrir: (id: string) => void;
}) {
  const p = h.prospeccao;
  const c = h.cadencia;
  const parceiro = h.parceiro ? d.hunters.find((x) => x.id === h.parceiro) : undefined;
  const esforco = d.esforcoSemanas.map((s) => {
    const e = s.porHunter[h.id];
    return { semana: rotuloSafra(s.numero), real: e?.real ?? null, meta: e?.meta ?? null };
  });
  const temEsforco = esforco.some((e) => e.meta !== null);

  return (
    <Section
      id="ficha"
      title={`Ficha de ${h.nome}`}
      hint={
        parceiro
          ? `Dupla ${h.dupla} com ${parceiro.nome}. Métricas individuais.`
          : "Prospecção da semana, cadência da semana anterior e resultado no ciclo."
      }
      action={
        <Button variant="ghost" size="icon" aria-label="Fechar a ficha" onClick={onFechar}>
          <X />
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Fila de prospecção" className="rounded-lg border p-4">
            <h3 className="text-dense font-semibold text-heading">
              Fila de prospecção
              {d.safraN && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {rotuloSafra(d.safraN.numero)} ({ddmm(d.safraN.inicio)} a {ddmm(d.safraN.fim)})
                </span>
              )}
            </h3>
            <p className="mt-1 text-dense text-muted-foreground">
              {p.semMeta
                ? `Sem prospecção: ${p.alocacao?.motivo_meta_zero}`
                : p.alocacao
                  ? `${sectorPath(setores, p.alocacao.sector_id, p.alocacao.subsector_id)} · metas: ${num(p.metaEmpresas ?? 0)} empresas, ${num(p.metaContatos ?? 0)} contatos`
                  : "Sem alocação nesta safra."}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Numero
                rotulo="Empresas"
                valor={num(p.empresas)}
                detalhe={
                  p.metaEmpresas !== null && !p.semMeta ? `de ${num(p.metaEmpresas)}` : undefined
                }
              />
              <Numero
                rotulo="Contatos"
                valor={num(p.contatos)}
                detalhe={
                  p.metaContatos !== null && !p.semMeta ? `de ${num(p.metaContatos)}` : undefined
                }
              />
              <Numero
                rotulo="Contatos por empresa"
                valor={p.contatosPorEmpresa === null ? "—" : num(p.contatosPorEmpresa)}
              />
              <Numero rotulo="Conexões aceitas" valor={num(p.conexoes)} />
            </dl>
          </section>

          <section aria-label="Fila de cadência" className="rounded-lg border p-4">
            <h3 className="text-dense font-semibold text-heading">
              Fila de cadência
              {d.safraAnterior && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {rotuloSafra(d.safraAnterior.numero)} ({ddmm(d.safraAnterior.inicio)} a{" "}
                  {ddmm(d.safraAnterior.fim)})
                </span>
              )}
            </h3>
            {!d.safraAnterior && (
              <p className="mt-1 text-dense text-muted-foreground">Primeira safra do ciclo.</p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Numero rotulo="Em cadência" valor={num(c.emCadencia)} />
              <Numero
                rotulo="Passos previstos"
                valor={num(c.previstosHoje)}
                detalhe={`hoje · ${num(c.previstosSemana)} na semana`}
              />
              <Numero rotulo="No prazo" valor={taxa(c.noPrazo, c.devidos)} />
            </dl>
            <h4 className="mt-4 text-dense font-semibold text-heading">
              Contatos parados ({c.parados.length})
            </h4>
            {c.parados.length === 0 ? (
              <p className="text-dense text-muted-foreground">Nenhum contato parado.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-dense">
                {c.parados.slice(0, 8).map((x) => (
                  <li key={x.id} className="flex justify-between gap-3">
                    <span>
                      {x.nome}
                      {x.empresa && <span className="text-muted-foreground"> · {x.empresa}</span>}
                    </span>
                    <span className="whitespace-nowrap text-warning-text tabular-nums">
                      {x.diasUteis} dias úteis
                    </span>
                  </li>
                ))}
                {c.parados.length > 8 && (
                  <li className="text-muted-foreground">e mais {c.parados.length - 8}</li>
                )}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <figure>
            <figcaption className="mb-1 text-dense font-semibold text-heading">
              Esforço por semana (contatos + passos)
            </figcaption>
            {temEsforco ? (
              <ChartContainer
                config={ESFORCO}
                className="aspect-auto h-48 w-full"
                aria-label={`Esforço por semana: ${esforco.map((e) => `${e.semana} ${e.real ?? "sem meta"} de ${e.meta ?? "—"}`).join("; ")}`}
              >
                <ComposedChart
                  data={esforco}
                  margin={{ left: -16, right: 8, top: 8 }}
                  barGap="-100%"
                >
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    xAxisId="meta"
                    dataKey="semana"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  {/* Mesmo eixo, invisível: a barra do feito fica sobre o contorno da meta. */}
                  <XAxis xAxisId="real" dataKey="semana" hide />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {/* Meta: contorno tracejado atrás da barra do que foi feito. */}
                  <Bar
                    xAxisId="meta"
                    dataKey="meta"
                    fill="transparent"
                    stroke="var(--color-meta)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    xAxisId="real"
                    dataKey="real"
                    fill="var(--color-real)"
                    radius={[4, 4, 0, 0]}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <p className="text-dense text-muted-foreground">Sem meta de esforço no ciclo.</p>
            )}
            <p className="mt-1 text-caption text-subtle-foreground">
              Semana atual:{" "}
              <SeloEsforco
                esforco={h.disciplina.esforco}
                alertaPct={d.esforcoAlertaPct}
                semMeta={p.semMeta}
              />
              . Meta: contorno tracejado.
            </p>
          </figure>

          <figure>
            <figcaption className="mb-2 text-dense font-semibold text-heading">
              Funil do ciclo, com a média da equipe
            </figcaption>
            <Funil h={h} d={d} />
          </figure>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-dense font-semibold text-heading">Taxa de resposta por canal</h3>
            <dl className="mt-2 grid grid-cols-3 gap-3">
              {h.ciclo.canais.map((ch) => (
                <Numero
                  key={ch.canal}
                  rotulo={ch.canal === "linkedin" ? "LinkedIn" : "WhatsApp"}
                  valor={taxa(ch.respostas, ch.contatos)}
                />
              ))}
              <Numero rotulo="Conexões aceitas na semana" valor={num(p.conexoes)} />
            </dl>
          </div>
          {parceiro && <Dupla h={h} parceiro={parceiro} onAbrir={onAbrir} />}
        </div>

        <Historico h={h} setores={setores} />
      </div>
    </Section>
  );
}

function Funil({ h, d }: { h: Hunter; d: Dados }) {
  const etapas = [
    { rotulo: "Contatos", meu: h.ciclo.contatos, media: d.media.contatos },
    { rotulo: "ATs", meu: h.ciclo.ats, media: d.media.ats },
    { rotulo: "Realizadas", meu: h.ciclo.realizadas, media: d.media.realizadas },
    { rotulo: "Avançaram", meu: h.ciclo.avancaram, media: d.media.avancaram },
  ];
  const max = Math.max(1, ...etapas.flatMap((e) => [e.meu, e.media]));
  return (
    <dl className="space-y-2">
      {etapas.map((e) => (
        <div key={e.rotulo} className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <dt className="text-dense text-muted-foreground">{e.rotulo}</dt>
          <dd className="space-y-0.5">
            {(
              [
                [h.nome.split(" ")[0], e.meu, "bg-chart-1"],
                ["Média", e.media, "bg-chart-muted"],
              ] as const
            ).map(([quem, v, cor]) => (
              <div key={quem} className="flex items-center gap-2 text-caption">
                <span className="w-14 truncate text-muted-foreground">{quem}</span>
                <span className="h-2 flex-1 rounded-sm bg-surface-inset">
                  <span
                    className={cn("block h-2 rounded-sm", cor)}
                    style={{ width: `${(v / max) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right tabular-nums text-heading">{num(v)}</span>
              </div>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Dupla({
  h,
  parceiro,
  onAbrir,
}: {
  h: Hunter;
  parceiro: Hunter;
  onAbrir: (id: string) => void;
}) {
  const linhas: [string, (x: Hunter) => string][] = [
    ["Contatos na semana", (x) => num(x.prospeccao.contatos)],
    ["Passos na semana", (x) => num(x.disciplina.passos)],
    ["No prazo", (x) => taxa(x.disciplina.noPrazo, x.disciplina.devidos)],
    ["ATs no ciclo", (x) => num(x.ciclo.ats)],
    [
      "ATs por 100 contatos",
      (x) =>
        x.ciclo.contatos ? num(Math.round((x.ciclo.ats / x.ciclo.contatos) * 1000) / 10) : "—",
    ],
    ["Avanço (maduras)", (x) => taxa(x.ciclo.avancaramMaduras, x.ciclo.realizadasMaduras)],
  ];
  return (
    <div>
      <h3 className="text-dense font-semibold text-heading">Dupla {h.dupla}</h3>
      <table className="table-dense mt-2 w-full">
        <caption className="sr-only">
          Comparação de {h.nome} e {parceiro.nome}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left">
              <span className="sr-only">Métrica</span>
            </th>
            <th scope="col" className="px-2 py-1 text-right">
              {h.nome}
            </th>
            <th scope="col" className="px-2 py-1 text-right">
              <button
                type="button"
                className="underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => onAbrir(parceiro.id)}
              >
                {parceiro.nome}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([rotulo, f]) => (
            <tr key={rotulo} className="border-t">
              <th scope="row" className="px-2 py-1 text-left font-normal text-muted-foreground">
                {rotulo}
              </th>
              <td className="px-2 py-1 text-right tabular-nums">{f(h)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{f(parceiro)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Historico({ h, setores }: { h: Hunter; setores: readonly SectorNode[] }) {
  return (
    <div>
      <h3 className="text-dense font-semibold text-heading">Histórico por safra</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border">
        <table className="table-dense w-full">
          <caption className="sr-only">Histórico de {h.nome} por safra</caption>
          <thead className="bg-surface-inset">
            <tr>
              {[
                "Safra",
                "Situação",
                "Setor alocado",
                "Contatos",
                "ATs por 100 contatos",
                "Avanço",
              ].map((t, i) => (
                <th
                  key={t}
                  scope="col"
                  className={i >= 3 ? "px-3 py-2 text-right" : "px-3 py-2 text-left"}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {h.historico.map((s) => (
              <tr key={s.safraId} className={cn("border-t", !s.madura && "text-muted-foreground")}>
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  {rotuloSafra(s.numero)}
                </th>
                <td className="px-3 py-2">
                  {STATUS_SAFRA_LABEL[s.status]}
                  {!s.madura && (
                    <span className="ml-1.5 rounded-sm bg-surface-inset px-1 text-caption">
                      imatura
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {s.setor ? sectorPath(setores, s.setor.sector_id, s.setor.subsector_id) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{num(s.contatos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.contatos
                    ? `${num(Math.round((s.ats / s.contatos) * 1000) / 10)} (${num(s.ats)} ATs)`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {taxa(s.avancaram, s.realizadas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-caption text-subtle-foreground">
        Safras imaturas em cinza: ainda podem ganhar ATs e avanços. Avanço = ATs realizadas que
        chegaram à AT de Aprofundamento (etapa atual do card).
      </p>
    </div>
  );
}
