import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Ask } from "@/components/useConfirm";
import { useSegmentos, useTestesAbAcoes, type SegmentosDados } from "@/hooks/useDashboard";
import { erroTesteAb, opcoesDaDimensao, type AbForm } from "@/lib/abTestes";
import { DIMENSOES, DIMENSAO_LABEL, type Dimensao } from "@/lib/dashSegmentos";
import { rotuloSafra } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";
import { Section } from "../shared";

type Dados = SegmentosDados;
type Item = Dados["testes"][number];
type Aberto = { tipo: "novo" } | { tipo: "editar"; item: Item } | { tipo: "encerrar"; item: Item };

const ROTULOS = ["A", "B", "C", "D", "E", "F"];
const MAX_VERSOES = ROTULOS.length;

/** Testes A/B do ciclo (aba Semanas): lista, cadastro, encerramento e exclusão. */
export function TestesAbCard({ periodId, ask }: { periodId: string; ask: Ask }) {
  const { data: d, isLoading } = useSegmentos(periodId);
  const acoes = useTestesAbAcoes();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const safra = (id: string) => d?.safras.find((s) => s.id === id);

  return (
    <Section
      title="Testes A/B do ciclo"
      hint="Compare versões de uma propriedade da prospecção (porte, setor, persona…) nas safras do teste. O resultado fica na aba Segmentos."
      action={
        <Button
          size="sm"
          variant="secondary"
          disabled={!d || d.safras.length === 0}
          onClick={() => setAberto({ tipo: "novo" })}
        >
          <Plus className="size-4" aria-hidden /> Novo teste
        </Button>
      }
    >
      {isLoading || !d ? (
        <p className="text-dense text-muted-foreground">Carregando os testes…</p>
      ) : d.testes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input p-5 text-center text-dense text-muted-foreground">
          Nenhum teste A/B neste ciclo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dense w-full">
            <caption className="sr-only">Testes A/B do ciclo</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  Nome
                </th>
                <th scope="col" className="text-left">
                  Dimensão
                </th>
                <th scope="col" className="text-left">
                  Safras
                </th>
                <th scope="col" className="text-left">
                  Versões
                </th>
                <th scope="col" className="text-left">
                  Situação
                </th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.testes.map((item) => {
                const { teste: t } = item;
                const nomes = new Map(
                  opcoesDaDimensao(t.dimensao, d.setores).map((o) => [o.valor, o.rotulo]),
                );
                const ini = safra(t.safra_inicial_id);
                const fim = safra(t.safra_final_id);
                return (
                  <tr key={t.id}>
                    <th scope="row" className="text-left font-semibold text-heading">
                      {t.nome}
                    </th>
                    <td>{DIMENSAO_LABEL[t.dimensao]}</td>
                    <td className="whitespace-nowrap">
                      {ini && fim ? `${rotuloSafra(ini.numero)} a ${rotuloSafra(fim.numero)}` : "—"}
                    </td>
                    <td className="text-muted-foreground">
                      {t.versoes
                        .map(
                          (v) =>
                            `${v.rotulo}: ${v.valores.map((x) => nomes.get(x) ?? x).join(", ")}`,
                        )
                        .join(" · ")}
                    </td>
                    <td>
                      {t.status === "encerrado" ? (
                        <span className="text-muted-foreground" title={t.conclusao ?? undefined}>
                          Encerrado
                        </span>
                      ) : (
                        <span className="text-success">Ativo</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Editar ${t.nome}`}
                        onClick={() => setAberto({ tipo: "editar", item })}
                      >
                        Editar
                      </Button>
                      {t.status === "ativo" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Encerrar ${t.nome}`}
                          onClick={() => setAberto({ tipo: "encerrar", item })}
                        >
                          Encerrar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Reabrir ${t.nome}`}
                          onClick={async () => {
                            try {
                              await acoes.encerrar(t.id, false);
                              toast.success(`${t.nome} reaberto`);
                            } catch (e) {
                              toast.error(errorMessage(e));
                            }
                          }}
                        >
                          Reabrir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Excluir ${t.nome}`}
                        onClick={() =>
                          ask({
                            title: `Excluir o teste "${t.nome}"?`,
                            desc: "O teste e as versões somem; os contatos e as ATs não mudam.",
                            action: "Excluir teste",
                            run: async () => {
                              await acoes.excluir(t.id);
                              toast.success("Teste excluído");
                            },
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {d && (aberto?.tipo === "novo" || aberto?.tipo === "editar") && (
        <TesteAbDialog
          d={d}
          inicial={aberto.tipo === "editar" ? aberto.item.teste : null}
          onSalvar={async (f) => {
            await acoes.salvar(periodId, aberto.tipo === "editar" ? aberto.item.teste.id : null, f);
            toast.success(aberto.tipo === "editar" ? "Teste salvo" : "Teste criado");
          }}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "encerrar" && (
        <EncerrarDialog
          nome={aberto.item.teste.nome}
          onSalvar={async (conclusao) => {
            await acoes.encerrar(aberto.item.teste.id, true, conclusao);
            toast.success(`${aberto.item.teste.nome} encerrado`);
          }}
          onClose={() => setAberto(null)}
        />
      )}
    </Section>
  );
}

function TesteAbDialog({
  d,
  inicial,
  onSalvar,
  onClose,
}: {
  d: Dados;
  inicial: Item["teste"] | null;
  onSalvar: (f: AbForm) => Promise<void>;
  onClose: () => void;
}) {
  const safras = [...d.safras].sort((a, b) => a.numero - b.numero);
  const [f, setF] = useState<AbForm>(() =>
    inicial
      ? {
          nome: inicial.nome,
          dimensao: inicial.dimensao,
          descricao: inicial.descricao ?? "",
          safra_inicial_id: inicial.safra_inicial_id,
          safra_final_id: inicial.safra_final_id,
          versoes: inicial.versoes.map((v) => ({ rotulo: v.rotulo, valores: [...v.valores] })),
        }
      : {
          nome: "",
          dimensao: "porte",
          descricao: "",
          safra_inicial_id: safras.at(-1)?.id ?? "",
          safra_final_id: safras.at(-1)?.id ?? "",
          versoes: [
            { rotulo: "A", valores: [] },
            { rotulo: "B", valores: [] },
          ],
        },
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const opcoes = opcoesDaDimensao(f.dimensao, d.setores);

  const marcar = (i: number, valor: string, on: boolean) =>
    setF({
      ...f,
      versoes: f.versoes.map((v, j) =>
        j === i
          ? { ...v, valores: on ? [...v.valores, valor] : v.valores.filter((x) => x !== valor) }
          : v,
      ),
    });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = erroTesteAb(f, safras);
    if (invalido) return setErro(invalido);
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(f);
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar teste A/B" : "Novo teste A/B"}</DialogTitle>
          <DialogDescription>
            Cada contato das safras do teste cai na versão do seu valor na dimensão. Um valor só
            pode estar em uma versão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ab-nome" className="block">
                Nome
              </Label>
              <Input
                id="ab-nome"
                value={f.nome}
                maxLength={120}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-dimensao" className="block">
                Dimensão
              </Label>
              <NativeSelect
                id="ab-dimensao"
                className="w-full"
                value={f.dimensao}
                onChange={(e) =>
                  // Trocar a dimensão zera os valores das versões (as opções mudam).
                  setF({
                    ...f,
                    dimensao: e.target.value as Dimensao,
                    versoes: f.versoes.map((v) => ({ ...v, valores: [] })),
                  })
                }
              >
                {DIMENSOES.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-ini" className="block">
                Safra inicial
              </Label>
              <NativeSelect
                id="ab-ini"
                className="w-full"
                value={f.safra_inicial_id}
                onChange={(e) => setF({ ...f, safra_inicial_id: e.target.value })}
              >
                {safras.map((s) => (
                  <option key={s.id} value={s.id}>
                    {rotuloSafra(s.numero)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-fim" className="block">
                Safra final
              </Label>
              <NativeSelect
                id="ab-fim"
                className="w-full"
                value={f.safra_final_id}
                onChange={(e) => setF({ ...f, safra_final_id: e.target.value })}
              >
                {safras.map((s) => (
                  <option key={s.id} value={s.id}>
                    {rotuloSafra(s.numero)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab-descricao" className="block">
              Descrição (opcional)
            </Label>
            <Textarea
              id="ab-descricao"
              rows={2}
              value={f.descricao}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            {f.versoes.map((v, i) => {
              const usadosEmOutras = new Set(
                f.versoes.flatMap((o, j) => (j === i ? [] : o.valores)),
              );
              return (
                <fieldset key={i} className="rounded-lg border p-3">
                  <legend className="sr-only">Versão {v.rotulo || i + 1}</legend>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ab-rotulo-${i}`} className="text-dense">
                      Versão
                    </Label>
                    <Input
                      id={`ab-rotulo-${i}`}
                      className="h-8 w-24"
                      value={v.rotulo}
                      maxLength={40}
                      onChange={(e) =>
                        setF({
                          ...f,
                          versoes: f.versoes.map((x, j) =>
                            j === i ? { ...x, rotulo: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    {f.versoes.length > 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        aria-label={`Remover a versão ${v.rotulo}`}
                        onClick={() => setF({ ...f, versoes: f.versoes.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {opcoes.map((o) => {
                      const id = `ab-${i}-${o.valor}`;
                      const emOutra = usadosEmOutras.has(o.valor);
                      return (
                        <div key={o.valor} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={v.valores.includes(o.valor)}
                            disabled={emOutra}
                            onCheckedChange={(on) => marcar(i, o.valor, on === true)}
                          />
                          <Label
                            htmlFor={id}
                            className={emOutra ? "text-dense text-subtle-foreground" : "text-dense"}
                          >
                            {o.rotulo}
                            {emOutra && <span className="sr-only"> (já em outra versão)</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
            {f.versoes.length < MAX_VERSOES && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setF({
                    ...f,
                    versoes: [
                      ...f.versoes,
                      {
                        rotulo: ROTULOS.find((r) => !f.versoes.some((v) => v.rotulo === r)) ?? "",
                        valores: [],
                      },
                    ],
                  })
                }
              >
                <Plus className="size-4" aria-hidden /> Versão
              </Button>
            )}
          </div>

          {erro && (
            <p role="alert" className="text-dense text-destructive-text">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar teste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EncerrarDialog({
  nome,
  onSalvar,
  onClose,
}: {
  nome: string;
  onSalvar: (conclusao: string) => Promise<void>;
  onClose: () => void;
}) {
  const [conclusao, setConclusao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encerrar “{nome}”</DialogTitle>
          <DialogDescription>
            Registre a decisão tomada com o resultado. Dá para reabrir depois.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSalvando(true);
            setErro(null);
            try {
              await onSalvar(conclusao);
              onClose();
            } catch (err) {
              setErro(errorMessage(err));
            } finally {
              setSalvando(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ab-conclusao">Decisão</Label>
            <Textarea
              id="ab-conclusao"
              rows={3}
              value={conclusao}
              placeholder="Ex.: seguir com empresas de 51 a 200 funcionários na próxima safra."
              onChange={(e) => setConclusao(e.target.value)}
            />
          </div>
          {erro && (
            <p role="alert" className="text-dense text-destructive-text">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Encerrando…" : "Encerrar teste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
