import { Link } from "@tanstack/react-router";
import type { LateRow } from "@/lib/inicio";

/** Quantos atrasados mostrar; o resto fica em Envios de hoje. */
const MAX = 5;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Atrasados: um por lead, do mais antigo para o mais novo. */
export function Atrasados({ rows }: { rows: LateRow[] | undefined }) {
  const shown = rows?.slice(0, MAX) ?? [];
  const rest = (rows?.length ?? 0) - shown.length;
  return (
    <section
      aria-labelledby="atrasados-titulo"
      aria-busy={!rows}
      className="flex flex-col gap-5 rounded-xl bg-destructive-soft p-8"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="atrasados-titulo" className="text-section font-semibold">
            Atrasados
          </h2>
          <p className="text-body text-muted-foreground">
            {rows && rows.length === 0 ? "Nenhum envio atrasado." : "Saem primeiro na fila."}
          </p>
        </div>
        <p className="font-display text-big font-bold text-destructive-text tabular-nums">
          {rows?.length ?? "–"}
          <span className="sr-only"> leads atrasados</span>
        </p>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {shown.map((r) => (
            <li key={r.contactId}>
              <Link
                to="/hoje"
                className="flex items-center gap-3 rounded-lg bg-destructive-soft px-3.5 py-3 transition-colors hover:bg-destructive/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-body text-heading">{r.name}</strong>
                  <span className="text-dense text-muted-foreground">
                    {r.step.label} · previsto {ddmm(r.planned)}
                  </span>
                </span>
                <span className="text-dense font-bold whitespace-nowrap text-destructive-text">
                  {r.days} {r.days === 1 ? "dia útil" : "dias úteis"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && (
        <Link
          to="/hoje"
          className="text-dense font-semibold text-destructive-text underline-offset-4 hover:underline"
        >
          E mais {rest} em Envios de hoje
        </Link>
      )}
    </section>
  );
}
