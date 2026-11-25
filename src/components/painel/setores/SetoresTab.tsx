import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSectorCadences, useSectorTree } from "@/hooks/useCadencia";
import { STEPS } from "@/lib/cadencia";
import { personaFilled, subsectorsOf, topSectors, type Sector } from "@/lib/empresas";
import { sectorSave, sectorUsage } from "@/lib/setores.functions";
import { cn, errorMessage } from "@/lib/utils";
import type { Ask } from "@/components/useConfirm";
import { SectorEditor } from "./SectorEditor";

/** Aba "Setores e cadências": ramos de atuação das empresas e as mensagens de cada um. */
export function SetoresTab({ ask }: { ask: Ask }) {
  const qc = useQueryClient();
  const { data: sectors } = useSectorTree();
  const { data: cadences, isError: cadencesError } = useSectorCadences();
  const usageFn = useServerFn(sectorUsage);
  const { data: usage } = useQuery({ queryKey: ["sector_usage"], queryFn: () => usageFn() });
  const save = useServerFn(sectorSave);
  const [selected, setSelected] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [novoSub, setNovoSub] = useState("");

  const list = sectors ?? [];
  const current = list.find((s) => s.id === selected) ?? null;
  // Setor de primeiro nível do item aberto: é nele que o novo subsetor nasce.
  const parent = current ? (list.find((s) => s.id === current.parent_id) ?? current) : null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.trim()) return;
    try {
      const sort = topSectors(list).reduce((m, s) => Math.max(m, s.sort), -1) + 1;
      const r = await save({ data: { name: novo.trim(), active: true, sort } });
      await qc.invalidateQueries({ queryKey: ["sectors"] });
      setNovo("");
      setSelected(r.id);
      toast.success("Setor criado — agora escreva a cadência");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function createSub(e: React.FormEvent) {
    e.preventDefault();
    if (!parent || !novoSub.trim()) return;
    try {
      const sort = subsectorsOf(list, parent.id).reduce((m, s) => Math.max(m, s.sort), -1) + 1;
      const r = await save({
        data: { name: novoSub.trim(), active: true, sort, parentId: parent.id },
      });
      await qc.invalidateQueries({ queryKey: ["sectors"] });
      setNovoSub("");
      setSelected(r.id);
      toast.success("Subsetor criado — agora escreva a cadência");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  /** Linha da lista: setor ou subsetor (recuado), com empresas e etapas "qualquer persona". */
  function row(s: Sector, sub: boolean) {
    const filled = personaFilled(cadences, s.id, "");
    return (
      <li key={s.id} className={cn(sub && "ml-4")}>
        <button
          type="button"
          onClick={() => {
            setSelected(s.id);
            setNovoSub("");
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-dense transition-colors hover:bg-control",
            sub && "border-l pl-3",
            s.id === selected && "bg-primary-soft text-heading",
            !s.active && "text-muted-foreground",
          )}
        >
          <span className="flex-1 truncate">
            {s.name}
            {!s.active && " (inativo)"}
          </span>
          <span className="text-caption text-muted-foreground">{usage?.[s.id] ?? 0} emp.</span>
          <span
            className={cn(
              "rounded-full px-1.5 text-caption font-semibold",
              filled === STEPS.length
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning-text",
            )}
            title="Etapas com mensagem própria para qualquer persona"
          >
            {filled}/{STEPS.length}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-6">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle>Setores</CardTitle>
          <p className="text-dense text-muted-foreground">
            Ramos de atuação das empresas e seus subsetores.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={create}>
            <Input
              aria-label="Nome do novo setor"
              placeholder="Ex.: Varejo"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
            />
            <Button size="sm" type="submit" disabled={!novo.trim()}>
              Criar
            </Button>
          </form>
          {list.length === 0 && (
            <p className="text-dense text-muted-foreground">Nenhum setor cadastrado.</p>
          )}
          <ul className="space-y-1">
            {topSectors(list).flatMap((top) => [
              row(top, false),
              ...subsectorsOf(list, top.id).map((sub) => row(sub, true)),
            ])}
          </ul>
          {parent && (
            <form className="space-y-1.5 border-t pt-3" onSubmit={createSub}>
              <p className="text-caption text-muted-foreground">Subsetor de {parent.name}</p>
              <div className="flex gap-2">
                <Input
                  aria-label="Nome do novo subsetor"
                  placeholder="Novo subsetor"
                  value={novoSub}
                  onChange={(e) => setNovoSub(e.target.value)}
                />
                <Button size="sm" type="submit" variant="secondary" disabled={!novoSub.trim()}>
                  Criar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      {current && !cadences ? (
        <p className="text-dense text-muted-foreground">
          {cadencesError ? "Não foi possível carregar a cadência." : "Carregando cadência…"}
        </p>
      ) : current ? (
        <SectorEditor
          key={current.id}
          sector={current}
          sectors={list}
          cadences={cadences}
          companies={usage?.[current.id] ?? 0}
          ask={ask}
          onDeleted={() => setSelected(null)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
          <p className="text-card-title font-semibold text-heading">Escolha um setor</p>
          <p className="text-dense text-muted-foreground">
            Etapas sem mensagem própria usam o modelo padrão da equipe.
          </p>
        </div>
      )}
    </div>
  );
}
