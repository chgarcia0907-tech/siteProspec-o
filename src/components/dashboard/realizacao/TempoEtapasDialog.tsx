import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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
import { ETAPAS_FUNIL, erroMetasTempo } from "@/lib/dashRealizacao";
import { NOME_ETAPA } from "@/lib/pipedrive";
import { errorMessage } from "@/lib/utils";

/** Meta de dias corridos em cada etapa do funil do outbound. */
export function TempoEtapasDialog({
  inicial,
  onSalvar,
  onClose,
}: {
  inicial: Readonly<Record<number, number>>;
  onSalvar: (metas: { stage_id: number; meta_dias: number }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [metas, setMetas] = useState<Record<number, number>>(() =>
    Object.fromEntries(ETAPAS_FUNIL.map((s) => [s, inicial[s] ?? 7])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = erroMetasTempo(metas);
    if (invalido) return setErro(invalido);
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(ETAPAS_FUNIL.map((s) => ({ stage_id: s, meta_dias: metas[s]! })));
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Metas de tempo por etapa</DialogTitle>
          <DialogDescription>
            Dias corridos que um card pode ficar em cada etapa do funil, como o “apodrecer” do
            Pipedrive. Valem para todos os ciclos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {ETAPAS_FUNIL.map((s) => {
              const id = `tempo-${s}`;
              return (
                <div key={s} className="space-y-1.5">
                  <Label htmlFor={id}>{NOME_ETAPA[s]}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      max={365}
                      className="w-24 tabular-nums"
                      value={Number.isNaN(metas[s]) ? "" : metas[s]}
                      onChange={(e) => setMetas({ ...metas, [s]: e.target.valueAsNumber })}
                    />
                    <span className="text-caption text-muted-foreground">dias</span>
                  </div>
                </div>
              );
            })}
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
              {salvando ? "Salvando…" : "Salvar metas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
