// Peças comuns da aba Indicadores: cartões de seção e barras horizontais.
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "./format";

/** Seção do painel com título e explicação curta do que o bloco responde. */
export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string | undefined;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className} role="region" aria-label={title}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Lista de barras horizontais com rótulo, valor e nota opcional (ex.: taxa de passagem). */
export function BarList({
  items,
  empty = "Sem dados no intervalo.",
}: {
  items: { label: string; value: number; note?: string }[];
  empty?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!max) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[9rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground" title={i.label}>
            {i.label}
          </span>
          <span className="h-3 rounded-sm bg-muted" aria-hidden>
            <span
              className="block h-3 rounded-sm bg-chart-1"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </span>
          <span className="min-w-[4.5rem] text-right tabular-nums">
            {num(i.value)}
            {i.note && <span className="ml-1 text-xs text-muted-foreground">{i.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
