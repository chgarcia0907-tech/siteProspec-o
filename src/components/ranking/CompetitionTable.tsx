import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FUNNEL } from "@/lib/cadencia";
import type { CompRowG } from "@/lib/competition.server";
import { cn } from "@/lib/utils";

const PODIUM = ["bg-warning-soft", "bg-accent", "bg-linkedin-soft"];
const COLS = FUNNEL.length + 9;

/** Placar: etapas do funil, bônus e pontuação final por hunter (pódio destacado). */
export function CompetitionTable({ rows, isLoading }: { rows: CompRowG[]; isLoading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-lg border">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Hunter</TableHead>
                <TableHead>Grupo</TableHead>
                {FUNNEL.map((f) => (
                  <TableHead key={f.countKey} className="text-right">
                    {f.plural}
                  </TableHead>
                ))}
                <TableHead className="text-right">Pontos funil</TableHead>
                <TableHead className="text-right">Bônus 1º AT</TableHead>
                <TableHead className="text-right">Bônus semanas</TableHead>
                <TableHead className="text-right">Total pontos</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">Pontuação final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-muted-foreground">
                    Nenhum hunter neste filtro.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => {
                const podium = i < 3 && r.pontuacao_final > 0;
                return (
                  <TableRow key={r.hunter_id} className={cn(podium && PODIUM[i])}>
                    <TableCell className="font-semibold">{podium ? `${i + 1}º` : i + 1}</TableCell>
                    <TableCell className="font-medium">{r.hunter}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.grupo ? `${r.grupo}${r.subgrupo ? ` / ${r.subgrupo}` : ""}` : "—"}
                    </TableCell>
                    {FUNNEL.map((f) => (
                      <TableCell key={f.countKey} className="text-right">
                        {r[f.countKey]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">{r.pontos_funil}</TableCell>
                    <TableCell className="text-right">{r.bonus_primeiro_at}</TableCell>
                    <TableCell className="text-right">
                      {r.bonus_semanas} ({r.semanas_vencidas} sem.)
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.total_pontos}</TableCell>
                    <TableCell className="text-right">
                      {r.taxa_conversao.toLocaleString("pt-BR")}%
                    </TableCell>
                    <TableCell className="text-right text-base font-bold">
                      {r.pontuacao_final.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
