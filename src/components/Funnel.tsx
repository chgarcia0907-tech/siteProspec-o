import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FUNNEL,
  advancePatch,
  formatBR,
  funnelIndex,
  todayISO,
  undoPatch,
  type Contact,
} from "@/lib/cadencia";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/useConfirm";
import { ResponseOriginSelect, useResponseOrigin } from "@/components/RespostaOrigem";

/** Azul que se intensifica a cada etapa do FUNNEL; a última (Projeto vendido) é verde sólido. */
const COLORS = [
  "bg-primary/15 text-primary",
  "bg-primary/25 text-primary-text-strong",
  "bg-primary/40 text-heading",
  "bg-primary/60 text-heading",
  "bg-success text-primary-foreground",
];

export function FunnelBadge({ contact }: { contact: Contact }) {
  const i = funnelIndex(contact);
  if (i < 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        COLORS[i],
      )}
    >
      {FUNNEL[i]!.label}
    </span>
  );
}

export function FunnelControl({
  contact,
  onPatch,
}: {
  contact: Contact;
  onPatch: (p: Partial<Contact>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const { ask, dialog } = useConfirm();
  const origin = useResponseOrigin();
  const idx = funnelIndex(contact);
  const next = FUNNEL[idx + 1];
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setDate(todayISO());
        }}
      >
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            Avançar no funil
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="text-xs text-muted-foreground">
            Etapa atual:{" "}
            {idx >= 0
              ? `${FUNNEL[idx]!.label} (${formatBR(contact[FUNNEL[idx]!.field])})`
              : "nenhuma"}
          </div>
          {next ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Próxima: {next.label} (+{next.points} pts)
              </p>
              <Input
                type="date"
                aria-label="Data da etapa"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!date}
                onClick={() => {
                  setOpen(false);
                  origin.guard(contact, advancePatch(contact, idx + 1, date), onPatch);
                }}
              >
                Marcar {next.label}
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium text-success">Projeto vendido — funil completo.</p>
          )}
          <ResponseOriginSelect contact={contact} onPatch={onPatch} />
          {idx >= 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-destructive-text"
              onClick={() => {
                setOpen(false);
                ask({
                  title: `Desfazer ${FUNNEL[idx]!.label}?`,
                  desc: `${contact.name} volta para a etapa anterior do funil e os pontos dessa etapa saem do placar.`,
                  action: "Desfazer",
                  reversible: true,
                  run: async () => {
                    const p = undoPatch(contact);
                    if (p) onPatch(p);
                  },
                });
              }}
            >
              Desfazer {FUNNEL[idx]!.label}
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {dialog}
      {origin.dialog}
    </>
  );
}
