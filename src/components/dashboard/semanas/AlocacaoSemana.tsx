import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Ask } from "@/components/useConfirm";
import { useAlocacao, useAlocacaoAcoes } from "@/hooks/useDashboard";
import {
  MODO_EDICAO_TEXTO,
  alocacaoVazia,
  diasParaTroca,
  duplasSugeridas,
  linhasDaAlocacao,
  modoEdicao,
  safraPadraoDaAlocacao,
  semMeta,
  type Alocacao,
  type AlocacaoForm,
} from "@/lib/alocacao";
import { addDaysISO, formatBR } from "@/lib/cadencia";
import { sectorPath } from "@/lib/empresas";
import { rotuloSafra, safraAnterior } from "@/lib/safras";
import { Section } from "../shared";
import { num } from "../format";
import { AlocacaoDialog, TrocaSetorDialog } from "./AlocacaoDialog";

type Aberto =
  | { tipo: "alocar"; inicial: AlocacaoForm }
  | { tipo: "editar"; alocacao: Alocacao }
  | { tipo: "trocar"; alocacao: Alocacao }
  | null;

const ddmm = (iso: string) => formatBR(iso).slice(0, 5);

/** Alocação da semana: hunter × setor, dupla e metas de cada safra do ciclo. */
export function AlocacaoSemana({ periodId, ask }: { periodId: string; ask: Ask }) {
  const { data, isLoading, error, refetch } = useAlocacao(periodId);
  const acoes = useAlocacaoAcoes();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);

  const titulo = "Alocação da semana";
  if (isLoading)
    return (
      <Section title={titulo}>
        <p className="text-dense text-muted-foreground">Carregando alocação…</p>
      </Section>
    );
  if (error || !data)
    return (
      <Section title={titulo}>
        <p className="text-dense text-destructive-text">Não foi possível carregar a alocação.</p>
        <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
          Tentar de novo
        </Button>
      </Section>
    );

  const safra =
    data.safras.find((s) => s.id === escolhida) ?? safraPadraoDaAlocacao(data.safras, data.hoje);
  if (!safra)
    return (
      <Section title={titulo}>
        <p className="text-dense text-muted-foreground">
          Crie as safras do ciclo no calendário acima para alocar os hunters.
        </p>
      </Section>
    );

  const modo = modoEdicao(safra, data.hoje);
  const doSafra = data.alocacoes.filter((a) => a.safra_id === safra.id);
  const linhas = linhasDaAlocacao(
    doSafra,
    safra.id,
    data.hunters.map((h) => h.id),
  );
  const nomeDe = (id: string) => data.hunters.find((h) => h.id === id)?.name ?? "Hunter";
  const setorDe = (a: Pick<Alocacao, "sector_id" | "subsector_id">) =>
    sectorPath(data.setores, a.sector_id, a.subsector_id) || "Setor removido";
  const anterior = safraAnterior(safra, data.safras);
  const salvar = async (id: string | null, f: AlocacaoForm) => {
    await acoes.salvar(safra.id, id, f);
    toast.success(id ? "Alocação salva" : `${nomeDe(f.user_id)} alocado`);
  };

  function excluir(a: Alocacao) {
    ask({
      title: `Excluir a alocação de ${nomeDe(a.user_id)} na ${rotuloSafra(safra!.numero)}?`,
      desc: "O hunter fica sem setor e sem meta nesta safra até ser alocado de novo.",
      action: "Excluir alocação",
      reversible: true,
      run: async () => {
        await acoes.excluir(a.id);
        toast.success("Alocação excluída");
      },
    });
  }

  async function copiar() {
    try {
      const n = await acoes.copiar(safra!.id);
      toast.success(
        n === 0
          ? "Nada para copiar: todos já estão alocados"
          : n === 1
            ? "1 alocação copiada"
            : `${n} alocações copiadas`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao copiar a alocação");
    }
  }

  const seletor = (
    <div className="flex items-center gap-2">
      <Label htmlFor="aloc-safra" className="text-dense text-muted-foreground">
        Safra
      </Label>
      <NativeSelect
        id="aloc-safra"
        className="w-56"
        value={safra.id}
        onChange={(e) => {
          setEscolhida(e.target.value);
          setAberto(null);
        }}
      >
        {[...data.safras]
          .sort((a, b) => a.numero - b.numero)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {rotuloSafra(s.numero)} · {ddmm(s.inicio)} a {ddmm(s.fim)}
              {s.usa_alocacao ? "" : " (sem alocação)"}
            </option>
          ))}
      </NativeSelect>
    </div>
  );

  const livre = modo === "livre" && safra.usa_alocacao;
  return (
    <Section
      title={titulo}
      hint="Qual setor cada hunter prospecta na safra, com as metas de empresas e contatos."
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {seletor}
          {livre && anterior && (
            <Button variant="secondary" onClick={() => void copiar()}>
              Copiar da {rotuloSafra(anterior.numero)}
            </Button>
          )}
          {livre && (
            <Button
              onClick={() => setAberto({ tipo: "alocar", inicial: alocacaoVazia("", safra) })}
            >
              Alocar hunter
            </Button>
          )}
        </div>
      }
    >
      {!safra.usa_alocacao ? (
        <p className="rounded-lg border border-dashed border-input p-4 text-dense text-muted-foreground">
          A {rotuloSafra(safra.numero)} não usa alocação. Para alocar, ligue "Usa alocação" em
          Editar safra, no calendário acima.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-surface-inset px-3 py-2 text-dense text-muted-foreground">
            {MODO_EDICAO_TEXTO[modo]}
          </p>
          {linhas.length === 0 ? (
            <p className="text-dense text-muted-foreground">
              O ciclo ainda não tem membros. Adicione os hunters em Painel Admin › Períodos.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="table-dense w-full">
                <caption className="sr-only">
                  Alocação da {rotuloSafra(safra.numero)}: setor, dupla e metas de cada hunter
                </caption>
                <thead className="bg-surface-inset">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">
                      Hunter
                    </th>
                    <th scope="col" className="px-3 py-2 text-left">
                      Setor › Subsetor
                    </th>
                    <th scope="col" className="px-3 py-2 text-left">
                      Dupla
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Meta de empresas
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Meta de contatos
                    </th>
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ userId, atual, anteriores }) => {
                    const nome = nomeDe(userId);
                    const todas = atual ? [...anteriores, atual] : [];
                    return (
                      <tr key={userId} className="border-t align-top">
                        <th scope="row" className="px-3 py-2 text-left font-semibold text-heading">
                          {nome}
                        </th>
                        <td className="px-3 py-2">
                          {atual ? (
                            <>
                              <span className="text-heading">{setorDe(atual)}</span>
                              {anteriores.length > 0 && (
                                <span className="block text-caption text-muted-foreground">
                                  desde {ddmm(atual.vigente_desde)};{" "}
                                  {anteriores
                                    .map((a, i) => {
                                      const ate = addDaysISO(todas[i + 1]!.vigente_desde, -1);
                                      return `antes: ${setorDe(a)} (${ddmm(a.vigente_desde)} a ${ddmm(ate)})`;
                                    })
                                    .join("; ")}
                                </span>
                              )}
                              {semMeta(atual) && (
                                <span className="block text-caption text-muted-foreground">
                                  Sem prospecção: {atual.motivo_meta_zero}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-caption font-semibold text-warning-text">
                              Não alocado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{atual?.dupla ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {atual ? num(atual.meta_empresas) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {atual ? num(atual.meta_contatos) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {modo === "livre" && atual && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Editar alocação de ${nome}`}
                                onClick={() => setAberto({ tipo: "editar", alocacao: atual })}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="destructive-ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Excluir alocação de ${nome}`}
                                onClick={() => excluir(atual)}
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                          {modo === "livre" && !atual && (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Alocar ${nome}`}
                              onClick={() =>
                                setAberto({ tipo: "alocar", inicial: alocacaoVazia(userId, safra) })
                              }
                            >
                              Alocar
                            </Button>
                          )}
                          {modo === "troca_setor" && atual && (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Trocar setor de ${nome}`}
                              onClick={() => setAberto({ tipo: "trocar", alocacao: atual })}
                            >
                              Trocar setor
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(aberto?.tipo === "alocar" || aberto?.tipo === "editar") && (
        <AlocacaoDialog
          safra={safra}
          setores={data.setores}
          alocacoes={doSafra}
          hunters={data.hunters}
          duplas={duplasSugeridas(doSafra, safra.id)}
          inicial={
            aberto.tipo === "alocar"
              ? aberto.inicial
              : {
                  user_id: aberto.alocacao.user_id,
                  sector_id: aberto.alocacao.sector_id,
                  subsector_id: aberto.alocacao.subsector_id,
                  dupla: aberto.alocacao.dupla,
                  meta_empresas: aberto.alocacao.meta_empresas,
                  meta_contatos: aberto.alocacao.meta_contatos,
                  motivo_meta_zero: aberto.alocacao.motivo_meta_zero,
                  vigente_desde: aberto.alocacao.vigente_desde,
                }
          }
          editando={aberto.tipo === "editar" ? aberto.alocacao : null}
          onSalvar={salvar}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "trocar" && (
        <TrocaSetorDialog
          safra={safra}
          setores={data.setores}
          alocacoes={doSafra}
          atual={aberto.alocacao}
          nomeHunter={nomeDe(aberto.alocacao.user_id)}
          dias={diasParaTroca(safra, data.hoje)}
          onSalvar={salvar}
          onClose={() => setAberto(null)}
        />
      )}
    </Section>
  );
}
