import { Link } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useConciliacao, useConciliacaoAcoes, useSemanas } from "@/hooks/useDashboard";
import { linkDoCard } from "@/lib/ats";
import { formatBR } from "@/lib/cadencia";
import { pendencias, type AtPendente, type CCard } from "@/lib/conciliacao";
import { NOME_ETAPA } from "@/lib/pipedrive";
import { cicloPadrao, diaSP, rotuloSafra } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";
import { num } from "../format";
import { ErroCarga, Section } from "../shared";
import { taxa } from "../hunters/format";
import { EscolherCardDialog } from "./EscolherCardDialog";

const ddmm = (ts: string) => formatBR(diaSP(ts)).slice(0, 5);

/** Hora da última cópia: "hoje, 09:37" ou "25/11, 09:37". */
function quando(ts: string | null): string {
  if (!ts) return "ainda não copiado";
  const d = new Date(ts);
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dia = diaSP(ts);
  const hoje = diaSP(new Date().toISOString());
  return `${dia === hoje ? "hoje" : formatBR(dia).slice(0, 5)}, ${hora}`;
}

function Bloco({
  titulo,
  hint,
  vazio,
  n,
  children,
}: {
  titulo: string;
  hint: string;
  vazio: string;
  n: number;
  children: ReactNode;
}) {
  if (n === 0)
    return (
      <p
        className="rounded-xl border border-dashed border-input px-5 py-3 text-dense text-muted-foreground"
        aria-label={titulo}
      >
        <span className="font-semibold text-heading">{titulo}:</span> {vazio}
      </p>
    );
  return (
    <Section title={`${titulo} (${n})`} hint={hint}>
      <div className="overflow-x-auto rounded-xl border">{children}</div>
    </Section>
  );
}

function Cabecalho({ colunas }: { colunas: string[] }) {
  return (
    <thead className="bg-surface-inset">
      <tr>
        {colunas.map((c, i) => (
          <th key={c || i} scope="col" className="px-3 py-2 text-left">
            {c || <span className="sr-only">Ações</span>}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function AbrirCard({ dealId }: { dealId: number }) {
  return (
    <a
      href={linkDoCard(dealId)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
    >
      Abrir no Pipedrive
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

/** Aba Conciliação: o que está desencontrado entre a plataforma e o Pipedrive. */
export function ConciliacaoTab() {
  const semanas = useSemanas();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const { data: d, isLoading, error, refetch } = useConciliacao(ciclo?.id ?? null);
  const acoes = useConciliacaoAcoes();
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState<AtPendente | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function rodar(id: string, f: () => Promise<string | null | void>, ok: string) {
    setOcupado(id);
    try {
      const aviso = await f();
      if (aviso) toast.warning(aviso);
      else toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setOcupado(null);
    }
  }

  async function sincronizar() {
    setSincronizando("Copiando os cards…");
    try {
      const r = await acoes.sincronizar((feitos, restantes) =>
        setSincronizando(
          restantes ? `${num(feitos)} cards copiados, faltam ${num(restantes)}…` : "Terminando…",
        ),
      );
      if (r.erros.length)
        toast.warning(`${num(r.feitos)} cards copiados; ${r.erros.length} com erro no Pipedrive`);
      else
        toast.success(
          r.feitos === 0
            ? "A cópia já estava em dia"
            : r.feitos === 1
              ? "1 card copiado"
              : `${num(r.feitos)} cards copiados`,
        );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSincronizando(null);
    }
  }

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

  const nome = (id: string | null) => (id && d?.nomes[id]) || "—";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-section font-semibold text-heading">Conciliação</h2>
          <p className="text-dense text-muted-foreground">
            O que está desencontrado entre a plataforma e o Pipedrive
            {d ? `, desde ${formatBR(d.desde)} (início do ciclo)` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="conc-ciclo" className="text-dense text-muted-foreground">
              Ciclo
            </Label>
            <NativeSelect
              id="conc-ciclo"
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
          <span className="text-dense text-muted-foreground" aria-live="polite">
            {sincronizando ?? `Cópia do Pipedrive: ${quando(d?.ultimaCopia ?? null)}`}
          </span>
          <Button variant="secondary" disabled={!!sincronizando} onClick={() => void sincronizar()}>
            <RefreshCw className={sincronizando ? "animate-spin" : undefined} aria-hidden />
            Sincronizar agora
          </Button>
        </div>
      </div>

      {isLoading || !d ? (
        error ? (
          <ErroCarga oQue="a conciliação" erro={error} onRetry={() => void refetch()} />
        ) : (
          <p className="text-dense text-muted-foreground">Carregando a conciliação…</p>
        )
      ) : (
        <>
          <Section title="Higiene dos dados" hint="Meta: nenhuma AT sem card.">
            <dl className="grid grid-cols-3 divide-x rounded-lg border">
              {[
                ["ATs sem card", taxa(d.atsSemCard.length, d.totais.ats)],
                ["Negócios sem cargo", taxa(d.semCargo.length, d.totais.cards)],
                ["Pendências na fila", num(pendencias(d))],
              ].map(([r, v]) => (
                <div key={r} className="px-4 py-3">
                  <dt className="text-dense text-muted-foreground">{r}</dt>
                  <dd className="mt-1 font-display text-section font-semibold text-heading tabular-nums">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Bloco
            titulo="ATs sem card"
            hint="O status da AT só passa a vir do Pipedrive depois de ligar ao card."
            vazio="nenhuma AT sem card."
            n={d.atsSemCard.length}
          >
            <table className="table-dense w-full">
              <caption className="sr-only">ATs sem card no Pipedrive</caption>
              <Cabecalho colunas={["Registrada", "Hunter", "Prospect · Empresa", "Sugestão", ""]} />
              <tbody>
                {d.atsSemCard.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{ddmm(a.registrada_em)}</td>
                    <td className="px-3 py-2">{nome(a.user_id)}</td>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {a.prospect} · {a.empresa}
                    </th>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.sugestao ? `#${a.sugestao.id} "${a.sugestao.rotulo}"` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {a.sugestao ? (
                        <Button
                          size="sm"
                          disabled={ocupado === a.id}
                          aria-label={`Ligar a AT de ${a.prospect} ao card ${a.sugestao.id}`}
                          onClick={() =>
                            void rodar(
                              a.id,
                              () => acoes.ligarCard(a.id, Number(a.sugestao!.id)),
                              "AT ligada ao card",
                            )
                          }
                        >
                          Ligar a este card
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Escolher o card da AT de ${a.prospect}`}
                          onClick={() => setEscolhendo(a)}
                        >
                          Escolher card…
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>

          <Bloco
            titulo="ATs sem contato"
            hint='Contam como "fora de cadência" até serem ligadas ao contato do hunter.'
            vazio="nenhuma AT sem contato."
            n={d.atsSemContato.length}
          >
            <table className="table-dense w-full">
              <caption className="sr-only">ATs sem contato ligado</caption>
              <Cabecalho colunas={["Registrada", "Hunter", "Prospect · Empresa", "Sugestão", ""]} />
              <tbody>
                {d.atsSemContato.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{ddmm(a.registrada_em)}</td>
                    <td className="px-3 py-2">{nome(a.user_id)}</td>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {a.prospect} · {a.empresa}
                    </th>
                    <td className="px-3 py-2 text-muted-foreground">{a.sugestao?.rotulo ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {a.sugestao ? (
                        <Button
                          size="sm"
                          disabled={ocupado === a.id}
                          aria-label={`Ligar a AT de ${a.prospect} ao contato ${a.sugestao.rotulo}`}
                          onClick={() =>
                            void rodar(
                              a.id,
                              () => acoes.ligarContato(a.id, a.sugestao!.id),
                              "AT ligada ao contato",
                            )
                          }
                        >
                          Ligar a este contato
                        </Button>
                      ) : (
                        <Link
                          to="/ats"
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Abrir em ATs
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>

          <Bloco
            titulo="Cards do outbound sem AT"
            hint="Card do funil 6 com etiqueta NTec e Canal de Entrada Outbound que nenhuma AT da plataforma referencia. O hunter registra a AT em ATs."
            vazio="todo card do outbound tem AT."
            n={d.cardsSemAt.length}
          >
            <TabelaCards cards={d.cardsSemAt} legenda="Cards do outbound sem AT" comEtapa />
          </Bloco>

          <Bloco
            titulo="Contatos sem alocação"
            hint="Hunter com contatos numa safra que usa alocação, sem alocação nela."
            vazio="todos os hunters com contatos estão alocados."
            n={d.semAlocacao.length}
          >
            <table className="table-dense w-full">
              <caption className="sr-only">Hunters com contatos sem alocação</caption>
              <Cabecalho colunas={["Hunter", "Safra", "Contatos", ""]} />
              <tbody>
                {d.semAlocacao.map((x) => (
                  <tr key={`${x.safraId}-${x.userId}`} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {nome(x.userId)}
                    </th>
                    <td className="px-3 py-2">{rotuloSafra(x.numero)}</td>
                    <td className="px-3 py-2 tabular-nums">{num(x.contatos)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/dashboard"
                        search={{ aba: "semanas" }}
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Alocar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>

          <Bloco
            titulo="Negócios sem cargo"
            hint="Card do outbound sem o campo Cargo da pessoa: fica fora da análise por cargo."
            vazio="todo card do outbound tem o cargo da pessoa."
            n={d.semCargo.length}
          >
            <TabelaCards cards={d.semCargo} legenda="Negócios sem cargo" />
          </Bloco>
        </>
      )}

      {escolhendo && d && (
        <EscolherCardDialog
          at={escolhendo}
          cards={d.cardsSemAt}
          nomeHunter={nome(escolhendo.user_id)}
          onLigar={(dealId) =>
            rodar(escolhendo.id, () => acoes.ligarCard(escolhendo.id, dealId), "AT ligada ao card")
          }
          onClose={() => setEscolhendo(null)}
        />
      )}
    </div>
  );
}

function TabelaCards({
  cards,
  legenda,
  comEtapa,
}: {
  cards: readonly CCard[];
  legenda: string;
  comEtapa?: boolean;
}) {
  return (
    <table className="table-dense w-full">
      <caption className="sr-only">{legenda}</caption>
      <Cabecalho
        colunas={comEtapa ? ["Card", "Hunter", "Etapa", "Criado em", ""] : ["Card", "Hunter", ""]}
      />
      <tbody>
        {cards.map((c) => (
          <tr key={c.deal_id} className="border-t">
            <th scope="row" className="px-3 py-2 text-left font-normal">
              {c.titulo || `#${c.deal_id}`}
            </th>
            <td className="px-3 py-2">{c.hunter_login ?? "—"}</td>
            {comEtapa && (
              <>
                <td className="px-3 py-2">
                  {(c.stage_id !== null && NOME_ETAPA[c.stage_id]) || "—"}
                  {c.status !== "open" && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {c.status === "won" ? "ganho" : "perdido"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{c.add_time ? ddmm(c.add_time) : "—"}</td>
              </>
            )}
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <AbrirCard dealId={c.deal_id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
