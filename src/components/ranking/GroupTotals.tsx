import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompRowG } from "@/lib/competition.server";

/** Somas do grupo/subgrupo filtrado. */
export function GroupTotals({
  rows,
  grupo,
  subgrupo,
}: {
  rows: CompRowG[];
  grupo: string;
  subgrupo: string;
}) {
  const sum = (f: (r: CompRowG) => number) => rows.reduce((a, r) => a + f(r), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Total do grupo: {grupo === "sem" ? "Sem grupo" : grupo}
          {subgrupo !== "todos" ? ` / ${subgrupo}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6 text-dense">
        <p>
          <span className="block text-muted-foreground">Pontuação final (soma)</span>
          <b className="font-display text-section text-heading">
            {sum((r) => r.pontuacao_final).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </b>
        </p>
        <p>
          <span className="block text-muted-foreground">Total de pontos (soma)</span>
          <b className="font-display text-section text-heading">{sum((r) => r.total_pontos)}</b>
        </p>
        <p>
          <span className="block text-muted-foreground">ATs</span>
          <b className="font-display text-section text-heading">{sum((r) => r.ats)}</b>
        </p>
        <p>
          <span className="block text-muted-foreground">Hunters</span>
          <b className="font-display text-section text-heading">{rows.length}</b>
        </p>
      </CardContent>
    </Card>
  );
}
