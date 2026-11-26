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
import { METAS_CICLO_INFO, erroMetasCiclo, type MetasCiclo } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";
import { Section } from "../shared";
import { num } from "../format";

/** Cartão com as metas do ciclo escolhido e o atalho para editá-las. */
export function MetasCicloCard({
  nomeCiclo,
  metas,
  onEditar,
}: {
  nomeCiclo: string;
  metas: MetasCiclo;
  onEditar: () => void;
}) {
  const vazias = METAS_CICLO_INFO.every((i) => metas[i.key] === null);
  return (
    <Section
      title={`Metas do ciclo ${nomeCiclo}`}
      hint="A meta de ATs que avançaram é a métrica central da Visão geral."
      action={
        <Button variant="secondary" onClick={onEditar}>
          Editar metas
        </Button>
      }
    >
      <dl className="grid grid-cols-5 divide-x rounded-lg border">
        {METAS_CICLO_INFO.map((i) => (
          <div key={i.key} className="px-4 py-3">
            <dt className="text-dense text-muted-foreground">{i.label}</dt>
            <dd className="mt-1 font-display text-section font-semibold text-heading tabular-nums">
              {metas[i.key] === null ? "—" : num(metas[i.key]!)}
            </dd>
          </div>
        ))}
      </dl>
      {vazias && (
        <p className="mt-3 text-dense text-muted-foreground">
          Sem metas definidas. Defina para acompanhar o ritmo do ciclo.
        </p>
      )}
    </Section>
  );
}

/** Editor das metas do ciclo; campo vazio = sem meta. */
export function MetasCicloDialog({
  nomeCiclo,
  inicial,
  onSalvar,
  onClose,
}: {
  nomeCiclo: string;
  inicial: MetasCiclo;
  onSalvar: (m: MetasCiclo) => Promise<void>;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState<Record<keyof MetasCiclo, string>>(
    () =>
      Object.fromEntries(
        METAS_CICLO_INFO.map((i) => [i.key, inicial[i.key] === null ? "" : String(inicial[i.key])]),
      ) as Record<keyof MetasCiclo, string>,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const metas = Object.fromEntries(
      METAS_CICLO_INFO.map((i) => {
        const t = texto[i.key].trim();
        return [i.key, t === "" ? null : Number(t)];
      }),
    ) as MetasCiclo;
    const invalido = erroMetasCiclo(metas);
    if (invalido) return setErro(invalido);
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(metas);
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Metas do ciclo {nomeCiclo}</DialogTitle>
          <DialogDescription>
            Totais para o ciclo inteiro. Deixe em branco o que ainda não tem meta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            {METAS_CICLO_INFO.map((i) => (
              <div key={i.key} className="space-y-1.5">
                <Label htmlFor={`meta-${i.key}`}>{i.label}</Label>
                <Input
                  id={`meta-${i.key}`}
                  inputMode="numeric"
                  className="tabular-nums"
                  value={texto[i.key]}
                  onChange={(e) => setTexto({ ...texto, [i.key]: e.target.value })}
                />
              </div>
            ))}
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
