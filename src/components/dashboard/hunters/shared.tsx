// Selo do esforço da aba Hunters (palavra, ícone e cor, como o semáforo das metas).
import type { Esforco, StatusEsforco } from "@/lib/dashHunters";
import { statusEsforco, STATUS_ESFORCO_LABEL } from "@/lib/dashHunters";
import { cn } from "@/lib/utils";
import { GOAL_STATUS, num } from "../format";

const PARA_GOAL: Record<StatusEsforco, keyof typeof GOAL_STATUS> = {
  ok: "ok",
  perto: "atencao",
  abaixo: "abaixo",
};

/** Esforço com palavra, ícone e cor (cor nunca é o único sinal). */
export function SeloEsforco({
  esforco,
  alertaPct,
  semMeta,
  className,
}: {
  esforco: Esforco | null;
  alertaPct: number;
  semMeta?: boolean;
  className?: string;
}) {
  if (!esforco)
    return (
      <span className={cn("text-muted-foreground", className)}>
        {semMeta ? "sem meta" : "sem meta definida"}
      </span>
    );
  const st = GOAL_STATUS[PARA_GOAL[statusEsforco(esforco.pct, alertaPct)]];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}
      title={`${num(esforco.real)} de ${num(esforco.meta)}${esforco.parcial ? " (meta proporcional aos dias úteis já passados)" : ""}`}
    >
      <st.icon className={cn("size-3.5 shrink-0", st.cls)} aria-hidden />
      <span className="tabular-nums">{num(esforco.pct)}%</span>
      <span className={cn("font-semibold", st.cls)}>
        {STATUS_ESFORCO_LABEL[statusEsforco(esforco.pct, alertaPct)]}
      </span>
    </span>
  );
}
