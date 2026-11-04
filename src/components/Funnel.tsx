import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FUNNEL, formatBR, funnelIndex, todayISO, type Contact } from "@/lib/cadencia";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-linkedin-soft text-linkedin",
  "bg-whatsapp-soft text-whatsapp",
  "bg-warning-soft text-warning",
  "bg-accent text-accent-foreground",
  "bg-success-soft text-success",
];

export function FunnelBadge({ contact }: { contact: Contact }) {
  const i = funnelIndex(contact);
  if (i < 0) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", COLORS[i])}>
      {FUNNEL[i]!.label}
    </span>
  );
}

/** Campo que guarda o momento do registro na plataforma (usado na pontuação). */
export const REG_FIELD = {
  at_marcada_em: "at_registrado_em",
  lead_em: "lead_registrado_em",
  proposta_em: "proposta_registrado_em",
  aprovacao_em: "aprovacao_registrado_em",
  vendido_em: "vendido_registrado_em",
} as const;

/** Patch para marcar a etapa `idx` na data `date`, preenchendo etapas anteriores vazias. */
export function advancePatch(contact: Contact, idx: number, date: string): Partial<Contact> {
  const patch: Partial<Contact> = {};
  const now = new Date().toISOString();
  for (let i = 0; i <= idx; i++) {
    const f = FUNNEL[i]!.field;
    if (!contact[f]) {
      patch[f] = date;
      patch[REG_FIELD[f]] = now;
    }
  }
  return patch;
}

export function undoPatch(contact: Contact): Partial<Contact> | null {
  const i = funnelIndex(contact);
  if (i < 0) return null;
  const f = FUNNEL[i]!.field;
  return { [f]: null, [REG_FIELD[f]]: null };
}

export function FunnelControl({ contact, onPatch }: { contact: Contact; onPatch: (p: Partial<Contact>) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const idx = funnelIndex(contact);
  const next = FUNNEL[idx + 1];
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDate(todayISO()); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Avançar no funil</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="text-xs text-muted-foreground">
          Etapa atual: {idx >= 0 ? `${FUNNEL[idx]!.label} (${formatBR(contact[FUNNEL[idx]!.field])})` : "nenhuma"}
        </div>
        {next ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Próxima: {next.label} (+{next.points} pts)</p>
            <Input type="date" aria-label="Data da etapa" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
            <Button size="sm" className="w-full" disabled={!date} onClick={() => { onPatch(advancePatch(contact, idx + 1, date)); setOpen(false); }}>
              Marcar {next.label}
            </Button>
          </div>
        ) : (
          <p className="text-sm font-medium text-success">Projeto vendido — funil completo.</p>
        )}
        {idx >= 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-destructive"
            onClick={() => {
              if (!confirm(`Desfazer "${FUNNEL[idx]!.label}" de ${contact.name}?`)) return;
              const p = undoPatch(contact);
              if (p) onPatch(p);
              setOpen(false);
            }}
          >
            Desfazer {FUNNEL[idx]!.label}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
