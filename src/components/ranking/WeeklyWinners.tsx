import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBR } from "@/lib/cadencia";
import type { CompWeek } from "@/lib/competition";

/** Quem fez mais ATs em cada semana do período (bônus semanal). */
export function WeeklyWinners({ weeks }: { weeks: CompWeek[] }) {
  if (!weeks.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Semanas com mais ATs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {weeks.map((w) => (
          <p key={w.inicio}>
            {formatBR(w.inicio)} a {formatBR(w.fim)}
            {w.parcial && (
              <span className="ml-1 rounded-full bg-muted px-2 text-[11px] font-semibold">
                parcial
              </span>
            )}
            {" — "}
            {w.vencedores.join(", ")} ({w.max} AT{w.max > 1 ? "s" : ""})
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
