import type { StepDef } from "@/lib/cadencia";
import type { QueueItem } from "@/lib/fila";
import { QueueCard } from "./QueueCard";
import type { QueueActions } from "./useQueueActions";

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
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nada na fila de {step.label} para esta data.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <QueueCard key={item.contact.id} step={step} item={item} actions={actions} />
      ))}
    </div>
  );
}
