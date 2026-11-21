import type { Contagem } from "@/lib/tasksHunter";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Faixa de números das tasks do filtro atual: um cartão com divisórias (DESIGN.md, seção 5). */
export function TasksResumo({ c }: { c: Contagem }) {
  const itens: { rotulo: string; valor: string; nota: string; alerta?: boolean }[] = [
    {
      rotulo: "Tasks abertas",
      valor: String(c.abertas),
      nota:
        c.cards[108] + c.cards[31] === 1 ? "em 1 card" : `em ${c.cards[108] + c.cards[31]} cards`,
    },
    {
      rotulo: "Atrasadas",
      valor: String(c.atrasadas),
      nota: c.atrasadas ? "venceram e não foram feitas" : "nenhuma atrasada",
      alerta: c.atrasadas > 0,
    },
    { rotulo: "Vencem hoje", valor: String(c.hoje), nota: "para fazer hoje" },
    { rotulo: "Próximas", valor: String(c.proximas + c.semData), nota: "nos próximos dias" },
    {
      rotulo: "Concluídas no prazo",
      valor: pct(c.taxaNoPrazo),
      nota: `${c.noPrazo} de ${c.concluidas} concluídas`,
    },
  ];
  return (
    <section
      aria-label="Resumo das tasks"
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
