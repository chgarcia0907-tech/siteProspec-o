import { useState, type FormEvent } from "react";
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
import { addDaysISO, formatBR } from "@/lib/cadencia";
import { erroSafra, rotuloSafra, type Safra, type SafraForm } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";

/**
 * Criar ou editar uma safra. Os valores ficam no formulário quando o salvamento falha; o diálogo
 * só fecha depois de salvar.
 */
export function SafraDialog({
  periodId,
  inicial,
  editando,
  outras,
  onSalvar,
  onClose,
}: {
  periodId: string;
  inicial: SafraForm;
  /** Safra sendo editada (null = nova). */
  editando: Safra | null;
  /** Safras de todos os ciclos, sem a editada. */
  outras: readonly Safra[];
  onSalvar: (f: SafraForm) => Promise<void>;
  onClose: () => void;
}) {
  const [f, setF] = useState<SafraForm>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudaSemana = !!editando && !!f.inicio && f.inicio !== editando.inicio;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = erroSafra(f, periodId, outras);
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

  const semanasAteACadencia = f.inicio
    ? Math.max(
        0,
        Math.round(
          (Date.parse(f.cadencia_em || f.inicio) - Date.parse(f.inicio)) / (7 * 86_400_000),
        ),
      )
    : 1;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editando ? `Editar ${rotuloSafra(editando.numero)}` : "Nova safra"}
          </DialogTitle>
          <DialogDescription>
            A safra vai de segunda a sexta. Os contatos entram na safra pela data em que foram
            criados na plataforma, inclusive os de sábado e domingo daquela semana.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="safra-numero">Número</Label>
              <Input
                id="safra-numero"
                type="number"
                min={1}
                value={Number.isNaN(f.numero) ? "" : f.numero}
                onChange={(e) => setF({ ...f, numero: e.target.valueAsNumber })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="safra-inicio">Início (segunda)</Label>
              <Input
                id="safra-inicio"
                type="date"
                value={f.inicio}
                onChange={(e) => {
                  const inicio = e.target.value;
                  // Ao trocar o início, o fim (sexta) e a cadência acompanham.
                  setF({
                    ...f,
                    inicio,
                    fim: inicio ? addDaysISO(inicio, 4) : f.fim,
                    cadencia_em: inicio
                      ? addDaysISO(inicio, semanasAteACadencia * 7)
                      : f.cadencia_em,
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="safra-fim">Fim</Label>
              <Input
                id="safra-fim"
                type="date"
                value={f.fim}
                onChange={(e) => setF({ ...f, fim: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="safra-cadencia" className="block">
              Cadência
            </Label>
            <NativeSelect
              id="safra-cadencia"
              className="w-full"
              value={String(semanasAteACadencia)}
              onChange={(e) =>
                setF({ ...f, cadencia_em: addDaysISO(f.inicio, Number(e.target.value) * 7) })
              }
              aria-describedby="safra-cadencia-ajuda"
            >
              {[0, 1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k === 0
                    ? "Na mesma semana da prospecção"
                    : `${k === 1 ? "Semana seguinte" : `${k} semanas depois`}${f.inicio ? ` (${formatBR(addDaysISO(f.inicio, k * 7)).slice(0, 5)})` : ""}`}
                </option>
              ))}
            </NativeSelect>
            <p id="safra-cadencia-ajuda" className="text-caption text-muted-foreground">
              Depois de uma semana sem trabalho (ex.: provas), a cadência vai para a próxima semana
              de trabalho. A maturação conta da semana da prospecção (ou da cadência, se for na
              mesma semana).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="safra-alocacao"
              checked={f.usa_alocacao}
              onCheckedChange={(v) => setF({ ...f, usa_alocacao: v === true })}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="safra-alocacao">Usa alocação</Label>
              <p className="text-caption text-muted-foreground">
                Desligue nas semanas anteriores ao esquema de alocação: elas entram nas métricas por
                safra, mas não cobram meta de safra.
              </p>
            </div>
          </div>
          {mudaSemana && editando && (
            <p className="rounded-lg border border-warning-border bg-warning-soft/60 px-3 py-2 text-dense text-warning-text">
              Mudar a semana muda a safra dos contatos: os criados na semana de{" "}
              {formatBR(editando.inicio)} deixam a {rotuloSafra(editando.numero)}, e os da semana de{" "}
              {formatBR(f.inicio)} passam a fazer parte dela.
            </p>
          )}
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
              {salvando
                ? "Salvando…"
                : mudaSemana
                  ? "Mudar a semana e salvar"
                  : editando
                    ? "Salvar safra"
                    : "Criar safra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
