import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useSemanas, useVisao, type VisaoDados } from "@/hooks/useDashboard";
import type { Alerta } from "@/lib/dashAlertas";
import type { Fator, Taxa } from "@/lib/dashRitmo";
import { cicloPadrao, rotuloSafra } from "@/lib/safras";
import { cn } from "@/lib/utils";
import { num } from "../format";
import { ErroCarga, Section } from "../shared";
import { taxa } from "../hunters/format";
import { SeloEsforco } from "../hunters/shared";
import { AtsPorOrigem, RitmoSemanal } from "./Graficos";

type Aba = "hunters" | "realizacao" | "semanas" | "conciliacao";
type Ir = (aba: Aba, ficha?: string) => void;
type Dados = VisaoDados;

/** Aba Visão geral (Módulo 1): estamos no ritmo para bater a meta do ciclo? */
export function VisaoTab({ onIr }: { onIr: Ir }) {
  const semanas = useSemanas();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const { data: d, isLoading, error, refetch } = useVisao(ciclo?.id ?? null);

  if (semanas.isLoading) return <p className="text-dense text-muted-foreground">Carregando…</p>;
  if (semanas.error)
    return (
      <ErroCarga oQue="os ciclos" erro={semanas.error} onRetry={() => void semanas.refetch()} />
    );
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
          Estamos no ritmo para bater a meta do ciclo?
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="visao-ciclo" className="text-dense text-muted-foreground">
            Ciclo
          </Label>
          <NativeSelect
            id="visao-ciclo"
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
          <ErroCarga oQue="a visão geral" erro={error} onRetry={() => void refetch()} />
        ) : (
          <p className="text-dense text-muted-foreground">Carregando a visão geral…</p>
        )
      ) : d.safras.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          O ciclo ainda não tem safras. Crie as semanas na aba Semanas.
        </p>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <CartaoCentral d={d} onIr={onIr} />
            <Alertas alertas={d.alertas} onIr={onIr} />
          </div>
          <Fatores fatores={d.visao.fatores} onIr={onIr} />
          <div className="grid gap-6 xl:grid-cols-2">
            <RitmoSemanal v={d.visao} nomeCiclo={ciclo.name} />
            <AtsPorOrigem v={d.visao} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Funil d={d} />
            <Semaforo d={d} onIr={onIr} />
          </div>
        </>
      )}
    </div>
  );
}

function CartaoCentral({ d, onIr }: { d: Dados; onIr: Ir }) {
  const c = d.visao.central;
  const atual = d.safras.find((s) => s.inicio === d.visao.semanaAtual);
  const noRitmo = c.esperado !== null ? c.totalCiclo >= c.esperado : null;
  return (
    <section
      aria-label="ATs que avançaram"
      className="rounded-xl border border-primary/35 bg-primary-soft p-6"
    >
      <p className="text-dense font-semibold text-primary-text-strong">
        ATs que avançaram
        {atual && <span className="font-normal"> · esta semana ({rotuloSafra(atual.numero)})</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="font-display text-big font-bold text-heading tabular-nums">{num(c.semana)}</p>
        <dl className="space-y-0.5 pb-2 text-dense">
          <div>
            <dt className="inline text-muted-foreground">Média do ciclo: </dt>
            <dd className="inline text-heading tabular-nums">
              {c.mediaCiclo === null ? "—" : `${num(c.mediaCiclo)} por semana`}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">No ciclo: </dt>
            <dd className="inline text-heading tabular-nums">
              {num(c.totalCiclo)}
              {c.meta !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  de {num(c.meta)} (esperado até agora: {num(c.esperado ?? 0)})
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
      {noRitmo === null ? (
        <p className="mt-3 text-dense text-muted-foreground">
          Sem meta do ciclo.{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => onIr("semanas")}
          >
            Definir em Semanas › Metas do ciclo
          </button>
        </p>
      ) : (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 text-dense font-semibold",
            noRitmo ? "text-success" : "text-destructive-text",
          )}
        >
          {noRitmo ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : (
            <XCircle className="size-4" aria-hidden />
          )}
          {noRitmo ? "No ritmo da meta" : "Abaixo do ritmo da meta"}
        </p>
      )}
      {c.semData > 0 && (
        <p className="mt-2 text-caption text-muted-foreground">
          {c.semData === 1
            ? "1 AT avançou sem data (card ainda fora da cópia do Pipedrive): conta nos totais por safra, fora da semana."
            : `${c.semData} ATs avançaram sem data (cards ainda fora da cópia do Pipedrive): contam nos totais por safra, fora da semana.`}
        </p>
      )}
    </section>
  );
}

const NIVEL: Record<Alerta["nivel"], { rotulo: string; cls: string }> = {
  alta: { rotulo: "Alta", cls: "bg-destructive-soft text-destructive-text" },
  media: { rotulo: "Média", cls: "bg-warning-soft text-warning-text" },
};

function Alertas({ alertas, onIr }: { alertas: readonly Alerta[]; onIr: Ir }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? alertas : alertas.slice(0, 5);
  return (
    <Section
      title={`Alertas (${alertas.length})`}
      hint="Calculados agora, com os limites da dashboard."
    >
      {alertas.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          Nenhum alerta. A equipe está dentro dos limites.
        </p>
      ) : (
        <ul className="divide-y">
          {lista.map((a) => (
            <li key={a.chave} className="flex items-start gap-3 py-2">
              <span
                className={cn(
                  "mt-0.5 w-14 shrink-0 rounded-sm text-center text-caption font-bold uppercase",
                  NIVEL[a.nivel].cls,
                )}
              >
                {NIVEL[a.nivel].rotulo}
              </span>
              <span className="flex-1 text-dense">{a.texto}</span>
              {a.aba !== "visao" && (
                <button
                  type="button"
                  className="shrink-0 rounded-sm text-dense font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => onIr(a.aba as Aba, a.hunterId)}
                  aria-label={`Ver: ${a.texto}`}
                >
                  Ver
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {alertas.length > 5 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setTodos((t) => !t)}>
          {todos ? "Mostrar só os 5 primeiros" : `Ver todos os ${alertas.length}`}
        </Button>
      )}
    </Section>
  );
}

const ehTaxa = (v: Taxa | number | null): v is Taxa => !!v && typeof v === "object";

function Fatores({ fatores, onIr }: { fatores: readonly Fator[]; onIr: Ir }) {
  return (
    <Section
      title="O que explica o resultado"
      hint="Contatos: safra da semana contra a anterior. Taxas: última safra madura contra a anterior madura."
    >
      <dl className="grid divide-x rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
        {fatores.map((f) => {
          const melhorou =
            f.variacao === null || f.variacao === 0
              ? null
              : f.subirEhBom
                ? f.variacao > 0
                : f.variacao < 0;
          const Seta = f.variacao !== null && f.variacao > 0 ? ArrowUpRight : ArrowDownRight;
          const unidade = f.chave === "contatos" ? "%" : " p.p.";
          return (
            <div key={f.chave} className="px-4 py-3">
              <dt className="text-dense text-muted-foreground">{f.rotulo}</dt>
              <dd className="mt-1 font-display text-section font-semibold text-heading tabular-nums">
                {f.atual === null
                  ? "—"
                  : ehTaxa(f.atual)
                    ? taxa(f.atual.n, f.atual.d)
                    : num(f.atual)}
              </dd>
              <dd className="mt-0.5 text-dense">
                {f.variacao === null ? (
                  <span className="text-muted-foreground">
                    {f.safras[0] === null
                      ? "Nenhuma safra madura ainda"
                      : "Sem safra anterior para comparar"}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 tabular-nums",
                      melhorou === null
                        ? "text-muted-foreground"
                        : melhorou
                          ? "text-success"
                          : "text-destructive-text",
                    )}
                  >
                    {f.variacao !== 0 && <Seta className="size-3.5" aria-hidden />}
                    {f.variacao > 0 ? "+" : ""}
                    {num(f.variacao)}
                    {unidade} vs {rotuloSafra(f.safras[1] ?? 0)}
                    {melhorou !== null && (
                      <span className="sr-only">{melhorou ? " (melhorou)" : " (piorou)"}</span>
                    )}
                  </span>
                )}
              </dd>
              <dd className="mt-0.5 text-caption text-subtle-foreground">
                {f.safras[0] !== null
                  ? f.chave === "contatos"
                    ? `safra ${rotuloSafra(f.safras[0])}`
                    : `safra madura ${rotuloSafra(f.safras[0])}`
                  : ""}
              </dd>
              {(f.chave === "contatos" || f.chave === "avanco") && (
                <dd className="mt-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-caption font-semibold text-primary underline-offset-4 hover:underline"
                    onClick={() => onIr("hunters")}
                  >
                    Ver por hunter <ArrowRight className="size-3" aria-hidden />
                  </button>
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function Funil({ d }: { d: Dados }) {
  const f = d.visao.funil;
  const max = Math.max(1, f[0]?.n ?? 1);
  return (
    <Section
      title="Funil do ciclo"
      hint="Contatos das safras do ciclo e as ATs deles, até a venda."
    >
      <dl className="space-y-2">
        {f.map((e, i) => {
          const anterior = i > 0 ? f[i - 1]! : null;
          return (
            <div key={e.rotulo} className="grid grid-cols-[7rem_1fr_9rem] items-center gap-3">
              <dt className="text-dense text-muted-foreground">{e.rotulo}</dt>
              <dd className="h-3 rounded-sm bg-surface-inset">
                <span
                  className="block h-3 rounded-sm bg-chart-1"
                  style={{ width: `${Math.max((e.n / max) * 100, e.n ? 1 : 0)}%` }}
                />
              </dd>
              <dd className="text-right text-dense tabular-nums">
                <span className="font-semibold text-heading">{num(e.n)}</span>
                {anterior && (
                  <span className="block text-caption text-muted-foreground">
                    {anterior.n
                      ? `${num(Math.round((e.n / anterior.n) * 1000) / 10)}% de ${anterior.rotulo.toLowerCase()}`
                      : "—"}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function Semaforo({ d, onIr }: { d: Dados; onIr: Ir }) {
  return (
    <Section
      title="Hunters abaixo da meta de esforço"
      hint={`Esta semana, abaixo de ${d.esforcoAlertaPct}% da meta (proporcional aos dias úteis passados).`}
    >
      {d.semaforo.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          Todos acima de {d.esforcoAlertaPct}% da meta (ou sem meta definida).
        </p>
      ) : (
        <ul className="divide-y">
          {d.semaforo.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2">
              <button
                type="button"
                className="font-semibold text-heading underline-offset-4 hover:underline"
                onClick={() => onIr("hunters", h.id)}
              >
                {h.nome}
              </button>
              <SeloEsforco esforco={h.esforco} alertaPct={d.esforcoAlertaPct} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
