import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StepDef } from "@/lib/cadencia";
import type { QueueItem } from "@/lib/fila";
import { QueueCard } from "./QueueCard";
import type { QueueActions } from "./useQueueActions";

/** Cartões exibidos por vez: filas longas (ex.: LinkedIn 1 sem data) crescem sob demanda. */
const BATCH = 50;

/** Fila de uma etapa: um cartão por lead, ou aviso de fila vazia. */
export function QueueList({
  step,
  items,
  actions,
}: {
  step: StepDef;
  items: QueueItem[];
  actions: QueueActions;
}) {
  const [visible, setVisible] = useState(BATCH);
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nada na fila de {step.label} para esta data.
      </div>
    );
  }
  const rest = items.length - visible;
  return (
    <div className="space-y-2">
      {items.slice(0, visible).map((item) => (
        <QueueCard key={item.contact.id} step={step} item={item} actions={actions} />
      ))}
      {rest > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-sm text-muted-foreground">
          <span>
            Mostrando {visible} de {items.length}
          </span>
          <Button size="sm" variant="outline" onClick={() => setVisible((v) => v + BATCH)}>
            Mostrar mais {Math.min(rest, BATCH)}
          </Button>
        </div>
      )}
    </div>
  );
}
