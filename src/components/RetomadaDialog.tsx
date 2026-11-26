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
import { Textarea } from "@/components/ui/textarea";
import { addDaysISO, type Contact } from "@/lib/cadencia";
import {
  MOTIVO_MAX,
  desmarcarRetomada,
  erroRetomada,
  marcarRetomada,
  retomadaPendente,
  type RetomadaCampos,
} from "@/lib/retomada";

const ATALHOS: { rotulo: string; dias: number }[] = [
  { rotulo: "Em 1 semana", dias: 7 },
  { rotulo: "Em 2 semanas", dias: 14 },
  { rotulo: "Em 1 mês", dias: 30 },
  { rotulo: "Em 3 meses", dias: 91 },
];

/**
 * Marcar o contato para retomar depois (ou trocar a data, ou desmarcar). Usado em Contatos e em
 * Envios de hoje › Retomadas. Não muda a situação nem reinicia a cadência.
 */
export function RetomadaDialog({
  contato,
  hoje,
  onSalvar,
  onClose,
}: {
  contato: Pick<Contact, "name" | "retomar_em" | "retomar_motivo" | "retomado_em">;
  hoje: string;
  onSalvar: (patch: Partial<RetomadaCampos>, mensagem: string) => void;
  onClose: () => void;
}) {
  const pendente = retomadaPendente(contato);
  const [data, setData] = useState(
    pendente && contato.retomar_em! >= hoje ? contato.retomar_em! : "",
  );
  const [motivo, setMotivo] = useState(pendente ? (contato.retomar_motivo ?? "") : "");
  const [erro, setErro] = useState<string | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = erroRetomada(data, motivo, hoje);
    if (invalido) return setErro(invalido);
    onSalvar(
      marcarRetomada(data, motivo),
      pendente ? "Data da retomada trocada" : "Marcado para retomar",
    );
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pendente ? "Trocar a data da retomada" : "Retomar depois"}: {contato.name}
          </DialogTitle>
          <DialogDescription>
            A cadência não recomeça; o contato aparece em Envios de hoje › Retomadas no dia
            escolhido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="retomar-em">Quando retomar o contato?</Label>
            <Input
              id="retomar-em"
              type="date"
              min={hoje}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-44"
            />
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS.map((a) => (
                <Button
                  key={a.dias}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setData(addDaysISO(hoje, a.dias))}
                >
                  {a.rotulo}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="retomar-motivo">O que o prospect disse (opcional)</Label>
            <Textarea
              id="retomar-motivo"
              rows={3}
              maxLength={MOTIVO_MAX}
              placeholder="Ex.: pediu para falar depois do fechamento do ano"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {erro && (
            <p role="alert" className="text-dense text-destructive-text">
              {erro}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {pendente ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onSalvar(desmarcarRetomada(), "Retomada desmarcada");
                  onClose();
                }}
              >
                Desmarcar retomada
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">{pendente ? "Trocar a data" : "Marcar para retomar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
