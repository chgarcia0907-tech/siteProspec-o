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
import { formatBR } from "@/lib/cadencia";
import { rotuloSafra, semanasSugeridas, type Safra } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";

/** Cria de uma vez as semanas que faltam no ciclo, com prévia do que será criado. */
export function GerarSemanasDialog({
  periodId,
  nomeCiclo,
  inicioPadrao,
  atePadrao,
  safras,
  onGerar,
  onClose,
}: {
  periodId: string;
  nomeCiclo: string;
  inicioPadrao: string;
  atePadrao: string;
  /** Safras de todos os ciclos. */
  safras: readonly Safra[];
  onGerar: (inicio: string, ate: string) => Promise<number>;
  onClose: () => void;
}) {
  const [inicio, setInicio] = useState(inicioPadrao);
  const [ate, setAte] = useState(atePadrao);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const validas = !!inicio && !!ate && inicio <= ate;
  const previa = validas ? semanasSugeridas(inicio, ate, safras, periodId) : [];

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!validas) return setErro("Informe um início antes do fim.");
    if (previa.length === 0) return setErro("Todas as semanas desse intervalo já têm safra.");
    setSalvando(true);
    setErro(null);
    try {
      await onGerar(inicio, ate);
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }

  const primeira = previa.at(0);
  const ultima = previa.at(-1);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar semanas do {nomeCiclo}</DialogTitle>
          <DialogDescription>
            Cria uma safra por semana, de segunda a sexta, continuando a numeração. Semanas que já
            têm safra ficam como estão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gerar-inicio">A partir de</Label>
              <Input
                id="gerar-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gerar-ate">Até</Label>
              <Input
                id="gerar-ate"
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
            </div>
          </div>
          <p className="rounded-lg bg-surface-inset px-3 py-2 text-dense" aria-live="polite">
            {primeira && ultima
              ? previa.length === 1
                ? `Vai criar a ${rotuloSafra(primeira.numero)} (${formatBR(primeira.inicio)}).`
                : `Vai criar ${previa.length} safras: ${rotuloSafra(primeira.numero)} (${formatBR(primeira.inicio)}) a ${rotuloSafra(ultima.numero)} (${formatBR(ultima.inicio)}).`
              : "Nenhuma semana nova nesse intervalo."}
          </p>
          <p className="text-caption text-muted-foreground">
            As safras novas usam alocação. Desligue depois nas semanas anteriores ao esquema.
          </p>
          {erro && (
            <p role="alert" className="text-dense text-destructive-text">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || previa.length === 0}>
              {salvando ? "Gerando…" : "Gerar semanas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
