import type { DayProgress } from "@/lib/fila";

/** Barra de progresso do dia: feitos / total, atrasados e leads com dados faltando. */
export function DayProgressBar({
  progress,
  missing,
}: {
  progress: DayProgress | undefined;
  /** Leads nas filas do dia que não podem gerar a mensagem por falta de dado. */
  missing: number;
}) {
  const { done = 0, total = 0, late = 0 } = progress ?? {};
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <section
      aria-label="Progresso do dia"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card px-5 py-4"
    >
      <p className="text-card-title font-semibold text-heading">
        {progress ? `${done} de ${total} envios feitos` : "Carregando…"}
      </p>
      <div
        className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-divider"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Envios feitos hoje"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-dense text-destructive-text">
        {late} {late === 1 ? "atrasado" : "atrasados"}
      </span>
      <span className="text-dense text-warning-text">{missing} com dados faltando</span>
    </section>
  );
}
