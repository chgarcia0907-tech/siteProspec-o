import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useSegmentos, useSemanas, type SegmentosDados } from "@/hooks/useDashboard";
import { opcoesDaDimensao } from "@/lib/abTestes";
import { DIMENSOES, chaveSetor, type Dimensao } from "@/lib/dashSegmentos";
import { cicloPadrao, rotuloSafra } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { num } from "../format";
import { taxa } from "../hunters/format";
import { Section } from "../shared";
import { Matriz } from "./Matriz";

type Dados = SegmentosDados;
type S = Dados["segmentos"];

/** Aba Segmentos (Módulo 3): onde a prospecção converte? */
export function SegmentosTab({
  dimensao,
  onDimensao,
  onIr,
}: {
  dimensao: Dimensao;
  onDimensao: (d: Dimensao) => void;
  onIr: (aba: "semanas") => void;
}) {
  const semanas = useSemanas();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const { data: d, isLoading, error, refetch } = useSegmentos(ciclo?.id ?? null);

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
        <div className="space-y-1">
          <h2 className="text-section font-semibold text-heading">Onde a prospecção converte?</h2>
          {d && (
            <p className="text-dense text-muted-foreground">
              {d.segmentos.maduras.length
                ? `Safras maduras: ${d.segmentos.maduras.map(rotuloSafra).join(", ")}`
                : "Nenhuma safra madura ainda"}{" "}
              · mínimo de {d.parametros.minAtsSegmento}{" "}
              {d.parametros.minAtsSegmento === 1 ? "AT realizada" : "ATs realizadas"} · fica ≥{" "}
              {d.parametros.avancoFicaPct}% · troca &lt; {d.parametros.avancoTrocaPct}%
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="segmentos-ciclo" className="text-dense text-muted-foreground">
            Ciclo
          </Label>
          <NativeSelect
            id="segmentos-ciclo"
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
              Não foi possível carregar os segmentos.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <p className="text-dense text-muted-foreground">Carregando os segmentos…</p>
        )
      ) : d.safras.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          O ciclo ainda não tem safras. Crie as semanas na aba Semanas.
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Dimensão"
            className="inline-flex flex-wrap rounded-lg border bg-surface-inset p-[3px]"
          >
            {DIMENSOES.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-pressed={x.key === dimensao}
                onClick={() => onDimensao(x.key)}
                className={cn(
                  "h-8 rounded-md px-3 text-dense font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  x.key === dimensao
                    ? "bg-primary-soft text-heading"
                    : "text-muted-foreground hover:text-heading",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <Matriz dim={d.segmentos.dimensoes.find((x) => x.chave === dimensao)!} p={d.parametros} />
          <TestesAb d={d} onIr={onIr} />
          <div className="grid gap-6 xl:grid-cols-3">
            <PorEmpresa s={d.segmentos} />
            <TabelaAts
              titulo="Canal da AT"
              hint="Por onde a AT foi marcada, nas safras maduras."
              linhas={d.segmentos.canais}
            />
            <TabelaAts
              titulo="Mensagem que gerou a resposta"
              hint="Etapa da cadência informada ao marcar a AT."
              linhas={d.segmentos.mensagens}
            />
          </div>
          <SafraSetor s={d.segmentos} />
        </>
      )}
    </div>
  );
}

function TestesAb({ d, onIr }: { d: Dados; onIr: (aba: "semanas") => void }) {
  const safra = (id: string) => d.safras.find((s) => s.id === id);
  return (
    <Section
      title="Testes A/B do ciclo"
      hint="Versões de uma propriedade da prospecção. Conclusivo só com a amostra mínima em cada versão e as safras maduras."
      action={
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 text-dense font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => onIr("semanas")}
        >
          Gerenciar em Semanas <ArrowRight className="size-3.5" aria-hidden />
        </button>
      }
    >
      {d.testes.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          Nenhum teste A/B neste ciclo. Crie um na aba Semanas.
        </p>
      ) : (
        <div className="space-y-5">
          {d.testes.map(({ teste: t, resultado: r }) => {
            const opcoes = new Map(
              opcoesDaDimensao(t.dimensao, d.setores).map((o) => [o.valor, o.rotulo]),
            );
            const ini = safra(t.safra_inicial_id);
            const fim = safra(t.safra_final_id);
            return (
              <article key={t.id} aria-label={`Teste ${t.nome}`} className="rounded-lg border p-4">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold text-heading">{t.nome}</h3>
                  <span className="text-dense text-muted-foreground">
                    {DIMENSOES.find((x) => x.key === t.dimensao)?.label} ·{" "}
                    {ini && fim ? `${rotuloSafra(ini.numero)} a ${rotuloSafra(fim.numero)}` : "—"}
                  </span>
                  {t.status === "encerrado" ? (
                    <span className="rounded-sm bg-surface-inset px-1.5 py-0.5 text-caption text-muted-foreground">
                      Encerrado
                    </span>
                  ) : r.conclusivo ? (
                    <span className="rounded-sm bg-success-soft px-1.5 py-0.5 text-caption font-semibold text-success">
                      Conclusivo
                    </span>
                  ) : (
                    <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-caption font-semibold text-warning-text">
                      Parcial: {r.pendencia}
                    </span>
                  )}
                </header>
                {t.descricao && (
                  <p className="mt-1 text-dense text-muted-foreground">{t.descricao}</p>
                )}
                <table className="table-dense mt-3 w-full">
                  <caption className="sr-only">Resultado das versões de {t.nome}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        Versão
                      </th>
                      <th scope="col" className="text-left">
                        Valores
                      </th>
                      <th scope="col" className="text-right">
                        Contatos
                      </th>
                      <th scope="col" className="text-right">
                        Prospect → AT
                      </th>
                      <th scope="col" className="text-right">
                        % avanço
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.versoes.map((v, i) => (
                      <tr key={v.rotulo}>
                        <th scope="row" className="text-left font-semibold text-heading">
                          <span
                            aria-hidden
                            className="mr-2 inline-block size-2 rounded-[2px]"
                            style={{ background: i % 2 ? "var(--chart-3)" : "var(--chart-1)" }}
                          />
                          {v.rotulo}
                          {r.lider === v.rotulo && (
                            <span className="ml-2 text-caption font-normal text-success">
                              líder
                            </span>
                          )}
                        </th>
                        <td className="text-dense text-muted-foreground">
                          {v.valores.map((x) => opcoes.get(x) ?? x).join(", ")}
                        </td>
                        <td className="text-right tabular-nums">{num(v.contatos)}</td>
                        <td className="text-right tabular-nums">
                          {taxa(v.prospectAt.n, v.prospectAt.d)}
                        </td>
                        <td className="text-right tabular-nums">{taxa(v.avanco.n, v.avanco.d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-caption text-subtle-foreground">
                  {r.lider
                    ? `Líder: ${r.lider}, +${num(r.diferencaPp ?? 0)} p.p. em Prospect → AT (${r.significativo ? "significativo" : "não significativo"} a 95%). `
                    : ""}
                  {r.fora
                    ? `${num(r.fora)} contato${r.fora > 1 ? "s" : ""} das safras do teste fora das versões.`
                    : ""}
                  {t.conclusao ? ` Decisão: ${t.conclusao}` : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function PorEmpresa({ s }: { s: S }) {
  return (
    <Section
      title="Contatos por empresa"
      hint="Empresas que chegaram à AT, pelo número de contatos prospectados nelas."
    >
      <dl className="space-y-3">
        {s.porEmpresa.map((f) => {
          const pct = f.empresas ? (f.comAt / f.empresas) * 100 : 0;
          return (
            <div key={f.faixa} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3">
              <dt className="text-dense text-muted-foreground">{f.faixa}</dt>
              <dd className="h-3 rounded-sm bg-surface-inset">
                <span
                  className="block h-3 rounded-sm bg-chart-1"
                  style={{ width: `${f.empresas ? Math.max(pct, f.comAt ? 1 : 0) : 0}%` }}
                />
              </dd>
              <dd className="text-right text-dense tabular-nums">
                {f.empresas ? (
                  <>
                    <span className="font-semibold text-heading">{num(Math.round(pct))}%</span>
                    <span className="block text-caption text-muted-foreground">
                      {f.comAt} de {f.empresas}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {s.semEmpresa > 0 && (
        <p className="mt-3 text-caption text-subtle-foreground">
          {num(s.semEmpresa)} contato{s.semEmpresa > 1 ? "s" : ""} sem empresa cadastrada fora da
          conta.
        </p>
      )}
    </Section>
  );
}

function TabelaAts({
  titulo,
  hint,
  linhas,
}: {
  titulo: string;
  hint: string;
  linhas: S["canais"];
}) {
  return (
    <Section title={titulo} hint={hint}>
      {linhas.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhuma AT nas safras maduras.</p>
      ) : (
        <table className="table-dense w-full">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left">
                <span className="sr-only">Origem</span>
              </th>
              <th scope="col" className="text-right">
                ATs
              </th>
              <th scope="col" className="text-right">
                Realizadas
              </th>
              <th scope="col" className="text-right">
                % avanço
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row" className="text-left font-normal">
                  {l.rotulo}
                </th>
                <td className="text-right tabular-nums">{num(l.ats)}</td>
                <td className="text-right tabular-nums">{num(l.realizadas)}</td>
                <td className="text-right tabular-nums">
                  {l.avanco.d ? `${num(Math.round((l.avanco.n / l.avanco.d) * 100))}%` : "—"}
                  <span className="block text-caption text-muted-foreground">
                    {l.avanco.d ? `${l.avanco.n} de ${l.avanco.d}` : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function SafraSetor({ s }: { s: S }) {
  const { setores, linhas } = s.safraSetor;
  return (
    <Section
      title="Safra × setor alocado"
      hint="Contatos de cada safra pelo setor da alocação do hunter, e quantos chegaram à AT."
    >
      {setores.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhum contato nas safras do ciclo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Contatos e % com AT por safra e setor alocado</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Safra
                </th>
                {setores.map((x) => (
                  <th key={x.id ?? "sem"} scope="col" className="text-right">
                    {x.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.numero} className={cn(!l.madura && "text-muted-foreground")}>
                  <th scope="row" className="text-left font-normal">
                    {rotuloSafra(l.numero)}
                    {!l.madura && (
                      <span className="ml-2 rounded-sm bg-surface-inset px-1.5 py-0.5 text-caption">
                        imatura
                      </span>
                    )}
                  </th>
                  {setores.map((x) => {
                    const c = l.celulas[chaveSetor(x.id)];
                    return (
                      <td key={x.id ?? "sem"} className="text-right tabular-nums">
                        {c ? (
                          <>
                            {num(c.contatos)}
                            <span className="block text-caption text-muted-foreground">
                              {taxa(c.comAt, c.contatos)}
                            </span>
                          </>
                        ) : (
                          <span className="text-subtle-foreground">—</span>
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
      <p className="mt-2 text-caption text-subtle-foreground">
        Taxa = contatos com AT ÷ contatos. Safra imatura ainda pode ganhar ATs.
      </p>
    </Section>
  );
}
