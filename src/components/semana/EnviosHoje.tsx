import { Link } from "@tanstack/react-router";
import { STEPS } from "@/lib/cadencia";
import type { DayProgress, Queues } from "@/lib/fila";
import { cn } from "@/lib/utils";

const CHANNEL_BG = { linkedin: "bg-linkedin", whatsapp: "bg-whatsapp" } as const;
const CHANNEL_TEXT = { linkedin: "text-linkedin", whatsapp: "text-whatsapp" } as const;

/** Envios de hoje: quantos leads esperam envio e quantos envios há em cada etapa. */
export function EnviosHoje({
  queues,
  progress,
  undated,
}: {
  queues: Queues | undefined;
  progress: DayProgress | undefined;
  undated: number;
}) {
  const counts = STEPS.map((s) => queues?.[s.n].length ?? 0);
  const anyItem = counts.some((n) => n > 0);
  return (
    <section
      aria-labelledby="hoje-titulo"
      aria-busy={!progress}
      className="flex flex-col gap-6 rounded-xl bg-card p-8"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="hoje-titulo" className="text-section font-semibold">
            Envios de hoje
          </h2>
          <p className="text-body text-muted-foreground">
            {!progress
              ? "Carregando a fila…"
              : progress.pending === 0
                ? `Fila em dia. ${progress.done} enviados hoje.`
                : `${progress.done} já enviados hoje.${undated ? ` ${undated} ${STEPS[0]!.label} ainda sem data entram aqui.` : ""}`}
          </p>
        </div>
        <p className="font-display text-big font-bold text-heading tabular-nums">
          {progress?.pending ?? "–"}
          <span className="sr-only"> leads na fila</span>
        </p>
      </div>
      {anyItem && (
        <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-md">
          {STEPS.map((s, i) =>
            counts[i] ? (
              <div
                key={s.n}
                className={cn("min-w-2.5", CHANNEL_BG[s.channel])}
                style={{ flex: counts[i] }}
              />
            ) : null,
          )}
        </div>
      )}
      <ul className="grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.n}>
            <Link
              to="/hoje"
              className="flex flex-col gap-0.5 rounded-lg bg-surface-inset p-3.5 transition-colors hover:bg-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="font-display text-title font-bold text-heading tabular-nums">
                {queues ? counts[i] : "–"}
              </span>
              <span className={cn("text-dense font-bold", CHANNEL_TEXT[s.channel])}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
