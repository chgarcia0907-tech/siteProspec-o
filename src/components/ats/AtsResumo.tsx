import type { ContagemAts } from "@/lib/ats";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Faixa de números das ATs do filtro atual: um cartão com divisórias (DESIGN.md, seção 5). */
export function AtsResumo({ c }: { c: ContagemAts }) {
  const itens: { rotulo: string; valor: number; nota: string; alerta?: boolean }[] = [
    {
      rotulo: "ATs",
      valor: c.total,
      nota: c.agendadas === 1 ? "1 agendada" : `${c.agendadas} agendadas`,
    },
    {
      rotulo: "Realizadas",
      valor: c.realizadas,
      nota: `${pct(c.taxaShow)} de comparecimento`,
    },
    {
      rotulo: "No-show",
      valor: c.noShow,
      nota: `${pct(c.taxaNoShow)} das que já aconteceram`,
      alerta: c.noShow > 0,
    },
    {
      rotulo: "Remarcadas",
      valor: c.remarcadas,
      nota: `${pct(c.taxaRemarcacao)} das ATs · ${c.remarcadasRealizadas} realizadas depois`,
    },
    { rotulo: "Canceladas", valor: c.canceladas, nota: "não vão acontecer" },
  ];
  return (
    <section
      aria-label="Resumo das ATs"
      className="grid grid-cols-5 divide-x divide-border overflow-hidden rounded-xl border bg-card"
    >
      {itens.map((i) => (
        <div key={i.rotulo} className={cn("p-4", i.alerta && "bg-destructive-soft/50")}>
          <p className="text-dense text-muted-foreground">{i.rotulo}</p>
          <p
            className={cn(
              "mt-1 font-display text-section font-bold tabular-nums",
              i.alerta ? "text-destructive-text" : "text-heading",
            )}
          >
            {i.valor}
          </p>
          <p className="mt-1 text-caption text-subtle-foreground">{i.nota}</p>
        </div>
      ))}
    </section>
  );
}
