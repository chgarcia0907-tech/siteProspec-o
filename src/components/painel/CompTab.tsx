import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompetition } from "@/lib/admin.functions";
import { formatBR } from "@/lib/cadencia";
import { painelSetPeriod } from "@/lib/painel.functions";
import { ActivityBoard } from "@/components/ranking/ActivityBoard";
import { CompetitionBoard } from "@/components/ranking/CompetitionBoard";

/** Aba "Competição": período da competição geral, placar e atividade (o ranking só aparece aqui). */
export function CompTab() {
  const fn = useServerFn(getCompetition);
  const save = useServerFn(painelSetPeriod);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["painel_comp"], queryFn: () => fn() });
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const s = start ?? data?.start ?? "";
  const e = end ?? data?.end ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Período da competição</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ps">Início</Label>
            <Input id="ps" type="date" value={s} onChange={(x) => setStart(x.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe">Fim (opcional)</Label>
            <Input id="pe" type="date" value={e} onChange={(x) => setEnd(x.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={!s}
            onClick={async () => {
              const r = await save({ data: { start: s, end: e || null } });
              if (r.ok) {
                toast.success("Período salvo");
                qc.invalidateQueries();
              } else toast.error("A data de fim deve ser depois do início");
            }}
          >
            Salvar período
          </Button>
          {data?.primeiroAt && (
            <p className="text-xs text-muted-foreground">
              1º AT: {data.primeiroAt.hunter} em {formatBR(data.primeiroAt.data)}
            </p>
          )}
        </CardContent>
      </Card>
      <CompetitionBoard />
      <ActivityBoard />
    </div>
  );
}
