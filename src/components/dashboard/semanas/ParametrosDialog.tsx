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
import { PARAMETROS_INFO, erroParametros, type Parametros } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";

const GRUPOS: { titulo: string; chaves: (keyof Parametros)[] }[] = [
  { titulo: "Maturação", chaves: ["maturacao_semanas"] },
  {
    titulo: "Alertas",
    chaves: [
      "esforco_alerta_pct",
      "dias_contato_parado",
      "concentracao_ats_pct",
      "nao_realizadas_pct",
      "semanas_seguidas",
    ],
  },
  {
    titulo: "Segmentos e teste A/B",
    chaves: ["min_ats_segmento", "avanco_fica_pct", "avanco_troca_pct", "amostra_minima_ab"],
  },
];
const INFO = new Map(PARAMETROS_INFO.map((i) => [i.key, i]));

/** Parâmetros da dashboard: janela de maturação e limites dos alertas e das regras. */
export function ParametrosDialog({
  inicial,
  onSalvar,
  onClose,
}: {
  inicial: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  onClose: () => void;
}) {
  const [p, setP] = useState<Parametros>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = erroParametros(p);
    if (invalido) return setErro(invalido);
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(p);
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar dashboard</DialogTitle>
          <DialogDescription>
            Valem para todos os ciclos. A janela de maturação define quando uma safra entra nas
            comparações e nas regras de decisão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-5" noValidate>
          {GRUPOS.map((g) => (
            <fieldset key={g.titulo} className="space-y-3">
              <legend className="mb-2 text-dense font-semibold text-heading">{g.titulo}</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {g.chaves.map((k) => {
                  const info = INFO.get(k)!;
                  const id = `param-${k}`;
                  return (
                    <div key={k} className="space-y-1.5">
                      <Label htmlFor={id}>{info.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={id}
                          type="number"
                          min={info.min}
                          max={info.max}
                          className="w-24 tabular-nums"
                          value={Number.isNaN(p[k]) ? "" : p[k]}
                          onChange={(e) => setP({ ...p, [k]: e.target.valueAsNumber })}
                          aria-describedby={`${id}-unidade`}
                        />
                        <span id={`${id}-unidade`} className="text-caption text-muted-foreground">
                          {info.unidade}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
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
              {salvando ? "Salvando…" : "Salvar parâmetros"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
