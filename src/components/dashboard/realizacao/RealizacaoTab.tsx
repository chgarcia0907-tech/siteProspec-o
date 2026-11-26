import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  useRealizacao,
  useSalvarTempoEtapas,
  useSemanas,
  type RealizacaoDados,
} from "@/hooks/useDashboard";
import { cicloPadrao } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { num } from "../format";
import { taxa } from "../hunters/format";
import { Section } from "../shared";
import { SituacaoSemanal } from "./Situacao";
import { TempoEtapasDialog } from "./TempoEtapasDialog";

type Dados = RealizacaoDados;
type R = Dados["realizacao"];

/** Aba Realização e avanço (Módulo 4): as ATs marcadas acontecem e avançam? */
export function RealizacaoTab() {
  const semanas = useSemanas();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const { data: d, isLoading, error, refetch } = useRealizacao(ciclo?.id ?? null);

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
          As ATs marcadas acontecem e avançam?
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="realizacao-ciclo" className="text-dense text-muted-foreground">
            Ciclo
          </Label>
          <NativeSelect
            id="realizacao-ciclo"
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
              Não foi possível carregar a realização das ATs.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <p className="text-dense text-muted-foreground">Carregando a realização…</p>
        )
      ) : d.safras.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          O ciclo ainda não tem safras. Crie as semanas na aba Semanas.
        </p>
      ) : (
        <>
          <Totais r={d.realizacao} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <SituacaoSemanal r={d.realizacao} nomeCiclo={ciclo.name} />
            <Horarios r={d.realizacao} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Antecedencia r={d.realizacao} />
            <Tempos d={d} />
          </div>
          <FunilSetores r={d.realizacao} />
          <Perdas r={d.realizacao} />
        </>
      )}
    </div>
  );
}

function Totais({ r }: { r: R }) {
  const t = r.totais;
  const itens = [
    { rotulo: "ATs do ciclo", valor: num(t.ats), detalhe: "data ou contato no ciclo" },
    { rotulo: "Realizadas", valor: num(t.realizadas), detalhe: taxa(t.realizadas, t.ats) },
    {
      rotulo: "Não realizadas",
      valor: num(t.naoRealizadas),
      detalhe: taxa(t.naoRealizadas, t.ats),
    },
    {
      rotulo: "Avançaram",
      valor: num(t.avancaram),
      detalhe: `${taxa(t.avancaram, t.realizadas)} das realizadas`,
    },
  ];
  return (
    <dl
      aria-label="Totais do ciclo"
      className="grid divide-x rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4"
    >
      {itens.map((i) => (
        <div key={i.rotulo} className="px-5 py-4">
          <dt className="text-dense text-muted-foreground">{i.rotulo}</dt>
          <dd className="mt-1 font-display text-section font-semibold text-heading tabular-nums">
            {i.valor}
          </dd>
          <dd className="mt-0.5 text-caption text-muted-foreground tabular-nums">{i.detalhe}</dd>
        </div>
      ))}
    </dl>
  );
}

const DIAS = ["seg", "ter", "qua", "qui", "sex"];
const DIAS_LONGOS = ["segunda", "terça", "quarta", "quinta", "sexta"];
/** Com menos horários que isto, a célula fica apagada (amostra pequena). */
const MIN_HORARIOS = 3;

function Horarios({ r }: { r: R }) {
  const horas = [...new Set(r.horarios.map((c) => c.hora))].sort((a, b) => a - b);
  const celula = new Map(r.horarios.map((c) => [`${c.dia}-${c.hora}`, c]));
  return (
    <Section
      title="No-show e remarcação por horário"
      hint="Cada horário que uma AT teve (o original e cada remarcação). Célula: % que deu no-show ou foi remarcado."
    >
      {horas.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhuma AT com desfecho no ciclo ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-dense w-full table-fixed">
              <caption className="sr-only">No-show e remarcação por hora e dia da semana</caption>
              <colgroup>
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-1 text-left">
                    <span className="sr-only">Hora</span>
                  </th>
                  {DIAS.map((dia) => (
                    <th
                      key={dia}
                      scope="col"
                      className="px-1 py-1 text-center text-caption font-semibold text-muted-foreground"
                    >
                      {dia}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horas.map((h) => (
                  <tr key={h}>
                    <th
                      scope="row"
                      className="px-2 py-1 text-left text-caption font-normal text-muted-foreground tabular-nums"
                    >
                      {h}h
                    </th>
                    {DIAS.map((_, i) => {
                      const c = celula.get(`${i + 1}-${h}`);
                      const falhas = c ? c.noShow + c.remarcadas : 0;
                      const pequena = !c || c.total < MIN_HORARIOS;
                      const fracao = c ? falhas / c.total : 0;
                      return (
                        <td key={i} className="px-0.5 py-0.5">
                          <span
                            className={cn(
                              "block rounded-sm px-1 py-1 text-center text-caption tabular-nums",
                              !c
                                ? "text-subtle-foreground"
                                : pequena
                                  ? "text-muted-foreground"
                                  : "text-heading",
                            )}
                            style={{
                              backgroundColor:
                                !c || pequena || falhas === 0
                                  ? "var(--surface-inset)"
                                  : `color-mix(in oklch, var(--chart-1) ${15 + 55 * fracao}%, var(--surface-inset))`,
                            }}
                            title={
                              c
                                ? `${DIAS_LONGOS[i]}, ${h}h: ${c.noShow} no-show e ${c.remarcadas} remarcação(ões) em ${c.total} horário(s)`
                                : undefined
                            }
                          >
                            {c ? (
                              <>
                                {num(Math.round(fracao * 100))}%
                                <span className="block text-subtle-foreground">
                                  {falhas} de {c.total}
                                </span>
                              </>
                            ) : (
                              "·"
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-subtle-foreground">
            Horário de São Paulo, só dias úteis. Com menos de {MIN_HORARIOS} horários a célula fica
            sem cor (amostra pequena).
          </p>
        </>
      )}
    </Section>
  );
}

function Antecedencia({ r }: { r: R }) {
  return (
    <Section
      title="Antecedência × % realizada"
      hint="Dias entre o registro da AT e a data marcada. Só ATs com a data já passada."
    >
      <dl className="space-y-3">
        {r.antecedencia.map((f) => {
          const pct = f.ats ? (f.realizadas / f.ats) * 100 : 0;
          return (
            <div key={f.faixa} className="grid grid-cols-[7.5rem_1fr_8rem] items-center gap-3">
              <dt className="text-dense text-muted-foreground">{f.faixa}</dt>
              <dd className="h-3 rounded-sm bg-surface-inset">
                <span
                  className="block h-3 rounded-sm bg-chart-1"
                  style={{ width: `${f.ats ? Math.max(pct, f.realizadas ? 1 : 0) : 0}%` }}
                />
              </dd>
              <dd className="text-right text-dense tabular-nums">
                {f.ats ? (
                  <>
                    <span className="font-semibold text-heading">{num(Math.round(pct))}%</span>
                    <span className="block text-caption text-muted-foreground">
                      {f.realizadas} de {f.ats}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">sem ATs</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function Tempos({ d }: { d: Dados }) {
  const [editando, setEditando] = useState(false);
  const salvar = useSalvarTempoEtapas();
  return (
    <Section
      title="Tempo por etapa × meta"
      hint="Dias corridos de cada passagem do card pela etapa, nos cards das ATs do ciclo."
      action={
        <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
          Editar metas
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-dense w-full">
          <caption className="sr-only">Tempo em cada etapa do funil contra a meta</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left">
                Etapa
              </th>
              <th scope="col" className="text-right">
                Meta
              </th>
              <th scope="col" className="text-right">
                Mediana
              </th>
              <th scope="col" className="text-right">
                No prazo
              </th>
              <th scope="col" className="text-right">
                Na etapa agora
              </th>
            </tr>
          </thead>
          <tbody>
            {d.realizacao.tempos.map((t) => {
              const acima = t.meta !== null && t.mediana !== null && t.mediana > t.meta;
              return (
                <tr key={t.stageId}>
                  <th scope="row" className="text-left font-normal">
                    {t.nome}
                  </th>
                  <td className="text-right tabular-nums">
                    {t.meta === null ? "—" : `${t.meta} d`}
                  </td>
                  <td
                    className={cn(
                      "text-right tabular-nums",
                      acima && "font-semibold text-destructive-text",
                    )}
                  >
                    {t.mediana === null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {acima && <AlertTriangle className="size-3.5" aria-hidden />}
                        {num(t.mediana)} d
                        {acima && <span className="sr-only"> (acima da meta)</span>}
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {t.meta === null ? "—" : taxa(t.dentroDaMeta, t.passagens)}
                  </td>
                  <td className="text-right tabular-nums">
                    {num(t.abertos)}
                    {t.abertosAcima > 0 && (
                      <span className="block text-caption text-warning-text">
                        {t.abertosAcima} acima da meta
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-caption text-subtle-foreground">
        Fonte: histórico de etapas da cópia do Pipedrive. Metas iniciais = “apodrecer” de cada etapa
        no Pipedrive.
      </p>
      {editando && (
        <TempoEtapasDialog
          inicial={d.metasTempo}
          onSalvar={salvar}
          onClose={() => setEditando(false)}
        />
      )}
    </Section>
  );
}

function FunilSetores({ r }: { r: R }) {
  const etapas = [
    { k: "ats", rotulo: "ATs", base: "contatos" },
    { k: "realizadas", rotulo: "Realizadas", base: "ats" },
    { k: "avancaram", rotulo: "Avançaram", base: "realizadas" },
    { k: "proposta", rotulo: "Proposta", base: "avancaram" },
    { k: "venda", rotulo: "Venda", base: "proposta" },
  ] as const;
  return (
    <Section
      title="Funil por setor alocado"
      hint="Setor da alocação do hunter quando o contato entrou. Cada taxa é sobre a etapa anterior."
    >
      {r.setores.length === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhum contato nas safras do ciclo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Funil de cada setor alocado</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Setor
                </th>
                <th scope="col" className="text-right">
                  Contatos
                </th>
                {etapas.map((e) => (
                  <th key={e.k} scope="col" className="text-right">
                    {e.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.setores.map((s) => (
                <tr key={s.setorId ?? "sem"}>
                  <th
                    scope="row"
                    className={cn(
                      "text-left font-normal",
                      s.setorId === null && "text-muted-foreground",
                    )}
                  >
                    {s.setor}
                    {s.imaturo && (
                      <span className="ml-2 rounded-sm bg-surface-inset px-1.5 py-0.5 text-caption text-muted-foreground">
                        imatura
                      </span>
                    )}
                  </th>
                  <td className="text-right tabular-nums">{num(s.contatos)}</td>
                  {etapas.map((e) => (
                    <td key={e.k} className="text-right tabular-nums">
                      {num(s[e.k])}
                      <span className="block text-caption text-muted-foreground">
                        {taxa(s[e.k], s[e.base])}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-caption text-subtle-foreground">
        Imatura: o setor tem safra que ainda não amadureceu, então as taxas podem subir. Avanço,
        proposta e venda pela cópia do Pipedrive.
      </p>
    </Section>
  );
}

function Perdas({ r }: { r: R }) {
  const p = r.perdas;
  return (
    <Section
      title="Perdas: motivo × etapa"
      hint="Cards perdidos das ATs do ciclo, pela etapa em que pararam e o motivo informado no Pipedrive."
    >
      {p.total === 0 ? (
        <p className="text-dense text-muted-foreground">Nenhum card perdido no ciclo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Cards perdidos por motivo e etapa</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Motivo
                </th>
                {p.etapas.map((e) => (
                  <th key={e.stageId} scope="col" className="text-right">
                    {e.nome}
                  </th>
                ))}
                <th scope="col" className="text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {p.linhas.map((l) => (
                <tr key={l.motivo}>
                  <th scope="row" className="text-left font-normal">
                    {l.motivo}
                  </th>
                  {p.etapas.map((e) => (
                    <td
                      key={e.stageId}
                      className={cn(
                        "text-right tabular-nums",
                        !l.porEtapa[e.stageId] && "text-subtle-foreground",
                      )}
                    >
                      {l.porEtapa[e.stageId] ?? 0}
                    </td>
                  ))}
                  <td className="text-right font-semibold text-heading tabular-nums">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
