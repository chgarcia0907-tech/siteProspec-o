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
  RESPOSTA_TIPO_LABEL,
  needsResponseKind,
  needsResponseOrigin,
  responseOriginChoices,
  type Contact,
  type RespostaTipo,
} from "@/lib/cadencia";

type Pending = { contact: Contact; patch: Partial<Contact>; apply: (p: Partial<Contact>) => void };

/**
 * Pergunta ao hunter qual mensagem gerou a resposta antes de gravar "respondeu" ou a AT e, ao
 * marcar "respondeu", se a resposta foi positiva ou negativa.
 * `guard(contato, patch, aplicar)` aplica direto quando não precisa perguntar; senão abre o
 * diálogo e só aplica (com `resposta_etapa` e/ou `resposta_tipo`) depois da escolha. Cancelar
 * não grava nada.
 */
export function useResponseOrigin() {
  const [pending, setPending] = useState<Pending | null>(null);
  const guard = useCallback(
    (contact: Contact, patch: Partial<Contact>, apply: (p: Partial<Contact>) => void) => {
      if (needsResponseOrigin(contact, patch) || needsResponseKind(contact, patch))
        setPending({ contact, patch, apply });
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
  const [kind, setKind] = useState<RespostaTipo | "">("");
  const askOrigin = !!pending && needsResponseOrigin(pending.contact, pending.patch);
  const askKind = !!pending && needsResponseKind(pending.contact, pending.patch);
  const choices = pending ? responseOriginChoices(pending.contact) : [];
  const reset = () => {
    setChoice("");
    setKind("");
  };
  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) onClose();
        reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {askOrigin ? "Qual mensagem gerou a resposta?" : "Como foi a resposta?"}
          </DialogTitle>
          <DialogDescription>
            {pending?.contact.name} respondeu.{" "}
            {askOrigin
              ? "Escolha a mensagem que o lead respondeu: é assim que o painel mostra qual canal e qual mensagem trazem mais reuniões."
              : "Diga se o lead respondeu com interesse ou recusou."}
          </DialogDescription>
        </DialogHeader>
        {askKind && (
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as RespostaTipo)}
            aria-label="Tipo de resposta"
            className="flex gap-4"
          >
            {(Object.keys(RESPOSTA_TIPO_LABEL) as RespostaTipo[]).map((t) => (
              <OriginOption key={t} id={`tipo-${t}`} value={t} label={RESPOSTA_TIPO_LABEL[t]} />
            ))}
          </RadioGroup>
        )}
        {askOrigin && (
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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={(askOrigin && !choice) || (askKind && !kind)}
            onClick={() => {
              if (!pending) return;
              pending.apply({
                ...pending.patch,
                ...(askOrigin ? { resposta_etapa: Number(choice) } : {}),
                ...(askKind && kind ? { resposta_tipo: kind } : {}),
              });
              onClose();
              reset();
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
  id = undefined,
  value,
  label,
  note,
}: {
  id?: string | undefined;
  value: string;
  label: string;
  note?: string | undefined;
}) {
  id ??= `origem-${value}`;
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

/** Troca entre resposta positiva e negativa de um contato que respondeu. */
export function ResponseKindSelect({
  contact,
  onPatch,
}: {
  contact: Contact;
  onPatch: (p: Partial<Contact>) => void;
}) {
  if (contact.status !== "respondeu") return null;
  return (
    <NativeSelect
      aria-label="Tipo de resposta"
      className="h-8 w-36"
      value={contact.resposta_tipo ?? ""}
      onChange={(e) => onPatch({ resposta_tipo: e.target.value as RespostaTipo })}
    >
      {!contact.resposta_tipo && (
        <option value="" disabled>
          Positiva ou negativa?
        </option>
      )}
      {(Object.keys(RESPOSTA_TIPO_LABEL) as RespostaTipo[]).map((t) => (
        <option key={t} value={t}>
          {RESPOSTA_TIPO_LABEL[t]}
        </option>
      ))}
    </NativeSelect>
  );
}
