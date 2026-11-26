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
  action,
  id,
}: {
  title: string;
  /** Âncora da seção (ex.: destino do atalho "Ver por hunter"). */
  id?: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
  /** Ação no canto do cabeçalho (ex.: "Configurar metas"). */
  action?: ReactNode;
}) {
  return (
    <Card id={id} className={className} role="region" aria-label={title}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-5 pb-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {hint && <p className="text-dense text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
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
  if (!max) return <p className="text-dense text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-dense">
          <span className="truncate text-muted-foreground" title={i.label}>
            {i.label}
          </span>
          <span className="h-2 rounded-full bg-divider" aria-hidden>
            <span
              className="block h-2 rounded-full bg-primary"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </span>
          <span className="min-w-[4.5rem] text-right text-heading tabular-nums">
            {num(i.value)}
            {i.note && <span className="ml-1 text-caption text-muted-foreground">{i.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
