import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ENTRY_CHANNEL_LABEL,
  OUTRO_CANAL,
  needsResponseOrigin,
  responseOriginChoices,
  type Contact,
} from "@/lib/cadencia";

type Pending = { contact: Contact; patch: Partial<Contact>; apply: (p: Partial<Contact>) => void };

/**
 * Pergunta ao hunter qual mensagem gerou a resposta antes de gravar "respondeu" ou a AT.
 * `guard(contato, patch, aplicar)` aplica direto quando não precisa perguntar; senão abre o
 * diálogo e só aplica (com `resposta_etapa`) depois da escolha. Cancelar não grava nada.
 */
export function useResponseOrigin() {
  const [pending, setPending] = useState<Pending | null>(null);
  const guard = useCallback(
    (contact: Contact, patch: Partial<Contact>, apply: (p: Partial<Contact>) => void) => {
      if (needsResponseOrigin(contact, patch)) setPending({ contact, patch, apply });
      else apply(patch);
    },
    [],
  );
  const dialog = <ResponseOriginDialog pending={pending} onClose={() => setPending(null)} />;
  return { guard, dialog };
}

function ResponseOriginDialog({
  pending,
  onClose,
}: {
  pending: Pending | null;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState("");
  const choices = pending ? responseOriginChoices(pending.contact) : [];
  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) onClose();
        setChoice("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Qual mensagem gerou a resposta?</DialogTitle>
          <DialogDescription>
            {pending?.contact.name} respondeu. Escolha a mensagem que o lead respondeu: é assim que
            o painel mostra qual canal e qual mensagem trazem mais reuniões.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={choice}
          onValueChange={setChoice}
          aria-label="Mensagem que gerou a resposta"
        >
          {choices.map((s, i) => (
            <OriginOption
              key={s.n}
              value={String(s.n)}
              label={s.label}
              note={i === 0 ? "última enviada" : undefined}
            />
          ))}
          <OriginOption
            value={String(OUTRO_CANAL)}
            label={ENTRY_CHANNEL_LABEL.outro}
            note="ligação, e-mail, indicação…"
          />
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!choice}
            onClick={() => {
              if (!pending) return;
              pending.apply({ ...pending.patch, resposta_etapa: Number(choice) });
              onClose();
              setChoice("");
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OriginOption({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string | undefined;
}) {
  const id = `origem-${value}`;
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
        {note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
      </Label>
    </div>
  );
}

/** Troca a mensagem de origem de um contato que já tem a resposta registrada. */
export function ResponseOriginSelect({
  contact,
  onPatch,
}: {
  contact: Contact;
  onPatch: (p: Partial<Contact>) => void;
}) {
  if (contact.resposta_etapa == null) return null;
  const choices = responseOriginChoices(contact);
  const known = choices.some((s) => s.n === contact.resposta_etapa);
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      Resposta veio de
      <NativeSelect
        aria-label="Mensagem que gerou a resposta"
        className="h-7 text-xs"
        value={String(contact.resposta_etapa)}
        onChange={(e) => onPatch({ resposta_etapa: Number(e.target.value) })}
      >
        {choices.map((s) => (
          <option key={s.n} value={s.n}>
            {s.label}
          </option>
        ))}
        {!known && contact.resposta_etapa !== OUTRO_CANAL && (
          <option value={contact.resposta_etapa}>Etapa {contact.resposta_etapa}</option>
        )}
        <option value={OUTRO_CANAL}>{ENTRY_CHANNEL_LABEL.outro}</option>
      </NativeSelect>
    </label>
  );
}
