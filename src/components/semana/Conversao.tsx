import { STEPS } from "@/lib/cadencia";
import type { Conversion } from "@/lib/inicio";
import { cn } from "@/lib/utils";

const fmt = (c: Conversion) => (c.pct === null ? "—" : `${c.pct}%`);

/** Conversão do hunter: ATs ÷ LinkedIn 1 enviados, nesta semana e na anterior. */
export function Conversao({
  now,
  prev,
}: {
  now: Conversion | undefined;
  prev: Conversion | undefined;
}) {
  const l1 = STEPS[0]!.label;
  return (
    <section
      aria-labelledby="conversao-titulo"
      aria-busy={!now}
      className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-12 py-2"
    >
      <div className="flex flex-col gap-2">
        <h2 id="conversao-titulo" className="text-section font-semibold">
          Sua conversão na semana
        </h2>
        {now?.pct === null ? (
          <p className="py-6 font-display text-title font-bold text-subtle-foreground">
            Sem {l1} na semana
          </p>
        ) : (
          <p className="font-display text-numeral font-bold text-primary tabular-nums">
            {now ? fmt(now) : "–"}
          </p>
        )}
        <p className="text-body text-muted-foreground">
          {!now
            ? "Carregando…"
            : now.l1 === 0
              ? `Você ainda não enviou ${l1} nesta semana.`
              : `Nesta semana: ${now.ats} ${now.ats === 1 ? "AT" : "ATs"} para ${now.l1} ${l1} enviados.`}
          {prev && prev.pct !== null ? ` Na semana passada foram ${prev.pct}%.` : ""}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <Barra label="Esta semana" c={now} strong />
        <Barra label="Semana passada" c={prev} />
        <p className="text-dense text-subtle-foreground">
          Conversão = ATs ÷ contatos com {l1} enviado na semana.
        </p>
      </div>
    </section>
  );
}

function Barra({
  label,
  c,
  strong,
}: {
  label: string;
  c: Conversion | undefined;
  strong?: boolean;
}) {
  const pct = Math.min(c?.pct ?? 0, 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-body">
        <span className={strong ? "font-bold text-heading" : "text-muted-foreground"}>{label}</span>
        <span className={strong ? "font-bold text-primary" : "text-muted-foreground"}>
          {c ? fmt(c) : "–"}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`Conversão: ${label.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={c?.pct ?? 0}
        className="h-3.5 rounded-full bg-surface-inset"
      >
        <div
          className={cn("h-full rounded-full", strong ? "bg-primary" : "bg-primary-soft")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
