// Peças comuns da aba Indicadores: cartões de seção e barras horizontais.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/utils";
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

/** Falha ao carregar uma parte da Dashboard: o que falhou, o motivo devolvido pelo servidor e
 * "Tentar de novo". Nunca troque um erro por um estado vazio ("Nenhum ciclo"): esconde a causa. */
export function ErroCarga({
  oQue,
  erro,
  onRetry,
}: {
  /** Complemento de "Não foi possível carregar …" (ex.: "os ciclos"). */
  oQue: string;
  erro: unknown;
  onRetry: () => void;
}) {
  const motivo = errorMessage(erro, "");
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive-border bg-destructive-soft/40 p-5"
    >
      <p className="text-dense text-destructive-text">Não foi possível carregar {oQue}.</p>
      {motivo && <p className="mt-1 text-caption text-muted-foreground">{motivo}</p>}
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
