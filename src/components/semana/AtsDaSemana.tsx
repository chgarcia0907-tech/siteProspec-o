import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { atSlots, shortWeekday, type AtSlot, type WeekAt } from "@/lib/inicio";
import { cn } from "@/lib/utils";

/** Vagas por linha: a meta da equipe costuma caber numa linha; acima disso, quebra. */
const COLS = 15;

const VIEWS = [
  { mine: false, label: "Equipe" },
  { mine: true, label: "Só as minhas" },
] as const;

function slotLabel(s: AtSlot): string {
  if (s.kind === "livre") return "Vaga livre da meta";
  return s.mine
    ? `Sua AT · ${s.company ?? "sem empresa"} · ${shortWeekday(s.day)}`
    : `AT da equipe · ${shortWeekday(s.day)}`;
}

/**
 * "ATs marcadas pela equipe": o total contra a meta e uma vaga por AT da meta. As do hunter
 * aparecem com a empresa; as do resto da equipe, só com o dia.
 */
export function AtsDaSemana({
  ats,
  goal,
  state,
  onRetry,
}: {
  ats: readonly WeekAt[];
  goal: number | null;
  state: "ok" | "loading" | "error";
  onRetry: () => void;
}) {
  const [onlyMine, setOnlyMine] = useState(false);
  const slots = atSlots(ats, goal);
  const mine = ats.filter((a) => a.mine).length;

  return (
    <section
      aria-labelledby="ats-titulo"
      aria-busy={state === "loading"}
      className="flex flex-col gap-8 rounded-xl bg-card p-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-wrap items-end gap-6">
          <p className="font-display text-giant font-bold text-heading tabular-nums">
            {state === "ok" ? ats.length : "–"}
            {goal !== null && <span className="text-subtle-foreground">/{goal}</span>}
          </p>
          <div className="flex flex-col gap-0.5 pb-1">
            <h2 id="ats-titulo" className="text-section font-semibold">
              ATs marcadas pela equipe
            </h2>
            {state === "ok" && (
              <p className="text-body text-muted-foreground">
                {goal !== null ? `Meta da semana: ${goal}. ` : "Sem meta de ATs definida. "}
                <strong className="text-primary">
                  {mine === 0
                    ? "Nenhuma é sua ainda."
                    : mine === 1
                      ? "1 é sua."
                      : `${mine} são suas.`}
                </strong>
              </p>
            )}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label="Destacar"
          className="flex gap-0.5 rounded-lg bg-background p-1"
        >
          {VIEWS.map((v) => {
            const on = v.mine === onlyMine;
            return (
              <button
                key={v.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setOnlyMine(v.mine)}
                className={cn(
                  "h-9 cursor-pointer rounded-md px-3.5 text-dense font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  on ? "bg-control text-heading" : "text-muted-foreground hover:text-heading",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {state === "error" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive-soft px-4 py-3">
          <p className="text-dense text-destructive-text">
            Não foi possível carregar as ATs da equipe.
          </p>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : state === "loading" ? (
        <div className="h-[132px] rounded-lg bg-surface-inset" />
      ) : slots.length === 0 ? (
        <p className="rounded-lg bg-surface-inset px-4 py-6 text-body text-muted-foreground">
          Nenhuma AT da equipe nesta semana ainda.
        </p>
      ) : (
        <>
          <ol
            aria-label="ATs da semana, uma por vaga da meta"
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` } as CSSProperties}
          >
            {slots.map((s, i) => {
              const dim = onlyMine && !(s.kind === "at" && s.mine);
              return (
                <li
                  key={i}
                  title={slotLabel(s)}
                  aria-label={slotLabel(s)}
                  className={cn(
                    "flex h-[132px] flex-col justify-between rounded-lg px-1.5 py-3 text-dense font-bold transition-[opacity,translate] duration-200 hover:-translate-y-0.5",
                    s.kind === "livre"
                      ? "bg-surface-inset text-subtle-foreground"
                      : s.mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-primary-text-strong",
                    dim && (s.kind === "livre" ? "opacity-50" : "opacity-25"),
                  )}
                >
                  <span aria-hidden>{s.kind === "at" ? shortWeekday(s.day) : ""}</span>
                  <span aria-hidden className="truncate text-caption">
                    {s.kind === "at"
                      ? s.mine
                        ? (s.company ?? "Sua AT")
                        : "Equipe"
                      : s.next
                        ? "Próxima"
                        : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="-mt-3 text-dense text-subtle-foreground">
            {goal !== null ? `Cada vaga é uma AT da meta de ${goal}. ` : ""}As suas aparecem com a
            empresa; as do resto da equipe, só com o dia.
          </p>
        </>
      )}
    </section>
  );
}
