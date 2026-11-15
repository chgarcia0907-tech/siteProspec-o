import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StepDef } from "@/lib/cadencia";
import type { QueueItem } from "@/lib/fila";
import { QueueCard } from "./QueueCard";
import type { QueueActions } from "./useQueueActions";

/** Cartões exibidos por vez: filas longas (ex.: LinkedIn 1 sem data) crescem sob demanda. */
const BATCH = 50;

/** Fila de uma etapa: um cartão por lead, ou o estado de fila vazia. */
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
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
        <CircleCheck className="size-6 text-success" strokeWidth={1.75} aria-hidden />
        <p className="text-card-title font-semibold text-heading">Fila em dia</p>
        <p className="text-dense text-muted-foreground">
          Nada na fila de {step.label} para esta data.
        </p>
      </div>
    );
  }
  const rest = items.length - visible;
  return (
    <div className="space-y-3">
      {items.slice(0, visible).map((item) => (
        <QueueCard key={item.contact.id} step={step} item={item} actions={actions} />
      ))}
      {rest > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-dense text-muted-foreground">
          <span>
            Mostrando {visible} de {items.length}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setVisible((v) => v + BATCH)}>
            Mostrar mais {Math.min(rest, BATCH)}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Fila carregando: esqueletos no formato dos cartões. */
export function QueueLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <p className="text-dense text-muted-foreground">Carregando a fila…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-xl border bg-card p-4">
          <div className="h-4 w-48 rounded-sm bg-divider" />
          <div className="h-3 w-72 rounded-sm bg-divider" />
        </div>
      ))}
    </div>
  );
}

/** Erro ao carregar os contatos, com a ação de tentar de novo. */
export function QueueError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive-border bg-destructive-soft/40 px-4 py-3">
      <p className="text-dense text-destructive-text">Não foi possível carregar os contatos.</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
