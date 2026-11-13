import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { spParts } from "@/lib/cadencia";
import { createPeriod } from "@/lib/periodos.functions";
import { errorMessage } from "@/lib/utils";

type Kind = "competicao" | "ciclo";

/** Botão e diálogo de criação de período (só um período ativo por vez). */
export function NewPeriodButton({
  disabledReason,
  onCreated,
}: {
  disabledReason: string | null;
  onCreated: (id: string) => void;
}) {
  const fn = useServerFn(createPeriod);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(spParts().iso);
  const [kind, setKind] = useState<Kind>("ciclo");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!!disabledReason}
        title={disabledReason ?? ""}
        onClick={() => setOpen(true)}
      >
        Novo período
      </Button>
      {disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo período</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="np-name">Nome</Label>
              <Input
                id="np-name"
                placeholder="Ex.: Hunters 26.2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-start">Início</Label>
              <Input
                id="np-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-kind">Tipo</Label>
              <NativeSelect
                id="np-kind"
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
              >
                <option value="ciclo">Ciclo da equipe (ranking semanal e geral)</option>
                <option value="competicao">Competição (estilo Hacka)</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {kind === "ciclo"
                  ? "Só os membros entram no ranking, e contam todos os contatos deles pela data de cada etapa (leads antigos que avançam também pontuam)."
                  : "Contam só os contatos importados durante o período."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Novos cadastros entram automaticamente neste período, sem grupo. Membros já existentes
              você adiciona depois.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !name.trim() || !start}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fn({ data: { name: name.trim(), start, kind } });
                  toast.success("Período criado");
                  await qc.invalidateQueries();
                  onCreated(r.id);
                  setOpen(false);
                  setName("");
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Criar período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
