import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSectorTemplates, useSectors } from "@/hooks/useCadencia";
import { STEPS } from "@/lib/cadencia";
import { missingSteps } from "@/lib/empresas";
import { sectorSave, sectorUsage } from "@/lib/setores.functions";
import { cn, errorMessage } from "@/lib/utils";
import type { Ask } from "../useConfirm";
import { SectorEditor } from "./SectorEditor";

/** Aba "Setores e cadências": ramos de atuação das empresas e as mensagens de cada um. */
export function SetoresTab({ ask }: { ask: Ask }) {
  const qc = useQueryClient();
  const { data: sectors } = useSectors();
  const { data: templates } = useSectorTemplates();
  const usageFn = useServerFn(sectorUsage);
  const { data: usage } = useQuery({ queryKey: ["sector_usage"], queryFn: () => usageFn() });
  const save = useServerFn(sectorSave);
  const [selected, setSelected] = useState<string | null>(null);
  const [novo, setNovo] = useState("");

  const list = sectors ?? [];
  const current = list.find((s) => s.id === selected) ?? null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.trim()) return;
    try {
      const sort = list.reduce((m, s) => Math.max(m, s.sort), -1) + 1;
      const r = await save({ data: { name: novo.trim(), active: true, sort } });
      await qc.invalidateQueries({ queryKey: ["sectors"] });
      setNovo("");
      setSelected(r.id);
      toast.success("Setor criado — agora escreva a cadência");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Setores (ramos de atuação)</CardTitle>
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
            <p className="text-xs text-muted-foreground">Nenhum setor cadastrado.</p>
          )}
          <ul className="space-y-1">
            {list.map((s) => {
              const faltam = missingSteps(templates?.[s.id], STEPS).length;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      s.id === selected && "bg-accent",
                      !s.active && "text-muted-foreground",
                    )}
                  >
                    <span className="flex-1 truncate">
                      {s.name}
                      {!s.active && " (inativo)"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {usage?.[s.id] ?? 0} emp.
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[11px] font-medium",
                        faltam === 0
                          ? "bg-whatsapp-soft text-whatsapp"
                          : "bg-warning-soft text-warning",
                      )}
                      title="Etapas com mensagem própria do setor"
                    >
                      {STEPS.length - faltam}/{STEPS.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      {current ? (
        <SectorEditor
          key={current.id}
          sector={current}
          templates={templates?.[current.id]}
          companies={usage?.[current.id] ?? 0}
          ask={ask}
          onDeleted={() => setSelected(null)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Escolha um setor para editar a cadência. Etapas sem mensagem própria usam o modelo padrão
          da equipe.
        </p>
      )}
    </div>
  );
}
