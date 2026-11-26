import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useResultado, useSemanas, type ResultadoDados } from "@/hooks/useDashboard";
import { cicloPadrao } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { dm, num, reais } from "../format";
import { taxa } from "../hunters/format";
import { Section } from "../shared";

type Dados = ResultadoDados;
type R = Dados["resultado"];
type Linha = R["porPorte"][number];

/** Abaixo disto a taxa de higiene fica em alerta. */
const HIGIENE_OK = 0.8;

/** Aba Resultado e ciclos (Módulo 5): quanto a prospecção vira de negócio? */
export function ResultadoTab() {
  const semanas = useSemanas();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const { data: d, isLoading, error, refetch } = useResultado(ciclo?.id ?? null);

  if (semanas.isLoading) return <p className="text-dense text-muted-foreground">Carregando…</p>;
  if (!ciclo)
    return (
      <p className="rounded-xl border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
        Nenhum ciclo cadastrado. Crie um período do tipo ciclo em Painel Admin › Períodos.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-section font-semibold text-heading">
          Quanto a prospecção vira de negócio?
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="resultado-ciclo" className="text-dense text-muted-foreground">
            Ciclo
          </Label>
          <NativeSelect
            id="resultado-ciclo"
            value={ciclo.id}
            onChange={(e) => setCicloId(e.target.value)}
          >
            {semanas.data!.ciclos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "active" ? " (ativo)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isLoading || !d ? (
        error ? (
          <div className="rounded-xl border border-destructive-border bg-destructive-soft/40 p-5">
            <p className="text-dense text-destructive-text">
              Não foi possível carregar o resultado.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <p className="text-dense text-muted-foreground">Carregando o resultado…</p>
        )
      ) : (
        <>
          <Conversao r={d.resultado} />
          <div className="grid gap-6 xl:grid-cols-2">
            <Pipeline r={d.resultado} />
            <Higiene r={d.resultado} />
          </div>
          <TabelaValor
            titulo="Valor por AT realizada por porte"
            hint="Porte do card no Pipedrive; sem ele, o da empresa do contato."
            linhas={d.resultado.porPorte}
            rotulo="Porte"
            min={d.minAtsSegmento}
          />
          <TabelaValor
            titulo="Valor por AT realizada por setor"
            hint="Setor da empresa do contato. Ordenado pelo valor por AT."
            linhas={d.resultado.porSetor}
            rotulo="Setor"
            min={d.minAtsSegmento}
          />
          <Ciclos d={d} cicloId={ciclo.id} />
        </>
      )}
    </div>
  );
}

function Conversao({ r }: { r: R }) {
  const c = r.conversao;
  const itens = [
    { rotulo: "ATs realizadas", valor: num(c.realizadas), detalhe: "no ciclo" },
    {
      rotulo: "Vendas",
      valor: num(c.vendas),
      detalhe: taxa(c.vendas, c.realizadas),
      destaque: true,
    },
    {
      rotulo: "Ticket médio",
      valor: c.ticket === null ? "—" : reais(c.ticket),
      detalhe: "dos ganhos com valor",
    },
    {
      rotulo: "Dias até fechar",
      valor: c.diasAteFechar === null ? "—" : num(c.diasAteFechar),
      detalhe: "mediana, da AT ao ganho",
    },
    {
      rotulo: "Valor por AT realizada",
      valor: c.valorPorAt === null ? "—" : reais(c.valorPorAt),
      detalhe: "valor ganho ÷ realizadas",
    },
  ];
  return (
    <dl
      aria-label="Conversão até a venda"
      className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-5"
    >
      {itens.map((i) => (
        <div
          key={i.rotulo}
          className={cn("border-r px-5 py-4 last:border-r-0", i.destaque && "bg-primary-soft")}
        >
          <dt
            className={cn(
              "text-dense",
              i.destaque ? "font-semibold text-primary-text-strong" : "text-muted-foreground",
            )}
          >
            {i.rotulo}
          </dt>
          <dd className="mt-1 font-display text-section font-semibold text-heading tabular-nums">
            {i.valor}
          </dd>
          <dd className="mt-0.5 text-caption text-muted-foreground tabular-nums">{i.detalhe}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pipeline({ r }: { r: R }) {
  const max = Math.max(1, ...r.pipeline.map((p) => p.cards));
  return (
    <Section
      title="Pipeline do ciclo"
      hint="Cards abertos das ATs do ciclo, pela etapa atual no Pipedrive."
    >
      <dl className="space-y-2.5">
        {r.pipeline.map((p) => (
          <div key={p.stageId} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3">
            <dt className="text-dense text-muted-foreground">{p.nome}</dt>
            <dd className="h-3 rounded-sm bg-surface-inset">
              <span
                className="block h-3 rounded-sm bg-chart-1"
                style={{ width: `${p.cards ? Math.max((p.cards / max) * 100, 2) : 0}%` }}
              />
            </dd>
            <dd className="text-right text-dense tabular-nums">
              <span className="font-semibold text-heading">{num(p.cards)}</span>
              <span className="block text-caption text-muted-foreground">
                {reais(p.valor)}
                {p.semValor > 0 && ` · ${p.semValor} sem valor`}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t pt-3 text-dense">
        <span className="text-success">
          Ganhos: {num(r.ganhos.cards)} · {reais(r.ganhos.valor)}
        </span>
        <span className="text-muted-foreground"> · Perdidos: {num(r.perdidos)}</span>
      </p>
    </Section>
  );
}

function TabelaValor({
  titulo,
  hint,
  linhas,
  rotulo,
  min,
}: {
  titulo: string;
  hint: string;
  linhas: readonly Linha[];
  rotulo: string;
  min: number;
}) {
  const max = Math.max(1, ...linhas.filter((l) => !l.pequeno).map((l) => l.valorPorAt ?? 0));
  return (
    <Section title={titulo} hint={hint}>
      {linhas.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhuma AT realizada no ciclo.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-dense w-full">
              <caption className="sr-only">{titulo}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left">
                    {rotulo}
                  </th>
                  <th scope="col" className="text-right">
                    Realizadas
                  </th>
                  <th scope="col" className="text-right">
                    Vendas
                  </th>
                  <th scope="col" className="text-right">
                    Ticket
                  </th>
                  <th scope="col" className="text-right whitespace-nowrap">
                    Dias até fechar
                  </th>
                  <th scope="col" className="w-48 text-left">
                    Valor por AT
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.chave ?? "sem"} className={cn(l.pequeno && "text-muted-foreground")}>
                    <th
                      scope="row"
                      className={cn("text-left font-normal", !l.pequeno && "text-heading")}
                    >
                      {l.rotulo}
                    </th>
                    <td className="text-right tabular-nums">{num(l.realizadas)}</td>
                    <td className="text-right tabular-nums">
                      {num(l.vendas)}
                      <span className="block text-caption text-muted-foreground">
                        {taxa(l.vendas, l.realizadas)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {l.ticket === null ? "—" : reais(l.ticket)}
                    </td>
                    <td className="text-right tabular-nums">
                      {l.diasAteFechar === null ? "—" : num(l.diasAteFechar)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-2 flex-1 rounded-sm bg-surface-inset">
                          {!l.pequeno && l.valorPorAt !== null && (
                            <span
                              className="block h-2 rounded-sm bg-chart-1"
                              style={{ width: `${(l.valorPorAt / max) * 100}%` }}
                            />
                          )}
                        </span>
                        <span className="w-20 text-right tabular-nums">
                          {l.valorPorAt === null ? "—" : reais(l.valorPorAt)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-subtle-foreground">
            Em cinza: menos de {min} {min === 1 ? "AT realizada" : "ATs realizadas"} (amostra
            pequena). Fonte: ATs da plataforma e cópia do Pipedrive.
          </p>
        </>
      )}
    </Section>
  );
}

function Ciclos({ d, cicloId }: { d: Dados; cicloId: string }) {
  return (
    <Section
      title="Ciclos da plataforma"
      hint="Cada ciclo pelas datas dele e só com os membros: contatos cadastrados e ATs registradas no período."
    >
      {d.ciclos.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhum ciclo cadastrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Indicadores de cada ciclo</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Ciclo
                </th>
                <th scope="col" className="text-left">
                  Período
                </th>
                <th scope="col" className="text-right">
                  Contatos
                </th>
                <th scope="col" className="text-right">
                  ATs
                </th>
                <th scope="col" className="text-right">
                  Prospect → AT
                </th>
                <th scope="col" className="text-right">
                  Realizadas
                </th>
                <th scope="col" className="text-right">
                  Avançaram
                </th>
                <th scope="col" className="text-right">
                  Vendas
                </th>
                <th scope="col" className="text-right">
                  Valor ganho
                </th>
              </tr>
            </thead>
            <tbody>
              {d.ciclos.map((c) => (
                <tr key={c.id} className={cn(c.id === cicloId && "bg-primary-soft/40")}>
                  <th scope="row" className="text-left font-semibold text-heading">
                    {c.nome}
                    {c.ativo && <span className="ml-2 text-caption text-success">ativo</span>}
                  </th>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {dm(c.inicio)} a {c.ativo ? "hoje" : dm(c.fim)}
                  </td>
                  <td className="text-right tabular-nums">{num(c.contatos)}</td>
                  <td className="text-right tabular-nums">{num(c.ats)}</td>
                  <td className="text-right tabular-nums">
                    {taxa(c.prospectAt.n, c.prospectAt.d)}
                  </td>
                  <td className="text-right tabular-nums">{num(c.realizadas)}</td>
                  <td className="text-right tabular-nums">{num(c.avancaram)}</td>
                  <td className="text-right tabular-nums">{num(c.vendas)}</td>
                  <td className="text-right tabular-nums">{reais(c.valorGanho)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Higiene({ r }: { r: R }) {
  return (
    <Section
      title="Higiene dos dados"
      hint={`Quanto da base tem o dado de que as métricas dependem. Abaixo de ${HIGIENE_OK * 100}% fica em alerta.`}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {r.higiene.map((h) => {
          const baixo = h.taxa.d > 0 && h.taxa.n / h.taxa.d < HIGIENE_OK;
          return (
            <div key={h.chave} className="rounded-lg border bg-surface-inset p-3">
              <dt className="text-caption text-muted-foreground">{h.rotulo}</dt>
              <dd
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-dense font-semibold tabular-nums",
                  baixo ? "text-warning-text" : "text-heading",
                )}
              >
                {baixo && <AlertTriangle className="size-3.5" aria-hidden />}
                {taxa(h.taxa.n, h.taxa.d)}
                {baixo && <span className="sr-only"> (abaixo do esperado)</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}
