import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Overview, OverviewPeriod } from "@/hooks/usePainel";
import { spParts } from "@/lib/cadencia";
import { closePeriod } from "@/lib/periodos.functions";
import type { Ask } from "../useConfirm";
import { AddMembersDialog } from "./AddMembersDialog";
import { GroupsCard } from "./GroupsCard";
import { MembersCard } from "./MembersCard";
import { fmtDate, periodScope, usePeriodActions } from "./shared";

export function PeriodDetail({
  data,
  period,
  ask,
}: {
  data: Overview;
  period: OverviewPeriod;
  ask: Ask;
}) {
  const scope = periodScope(data, period);
  const [onlyUnalloc, setOnlyUnalloc] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <PeriodHeader period={period} members={scope.members.length} ask={ask} />

      {scope.unallocated.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <span className="font-medium">
            {scope.unallocated.length}{" "}
            {scope.unallocated.length === 1 ? "membro aguardando" : "membros aguardando"} alocação
            em grupo
          </span>
          <Button size="sm" variant="outline" onClick={() => setOnlyUnalloc(true)}>
            Mostrar
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <GroupsCard period={period} scope={scope} ask={ask} />
        <MembersCard
          period={period}
          scope={scope}
          ask={ask}
          onlyUnalloc={onlyUnalloc}
          onOnlyUnallocChange={setOnlyUnalloc}
          onAdd={() => setAdding(true)}
        />
      </div>
      <AddMembersDialog
        open={adding}
        onOpenChange={setAdding}
        data={data}
        periodId={period.id}
        groups={scope.groups}
        subsOf={scope.subsOf}
      />
    </div>
  );
}

/** Nome, situação e datas do período, com o encerramento (congela o placar oficial). */
function PeriodHeader({
  period,
  members,
  ask,
}: {
  period: OverviewPeriod;
  members: number;
  ask: Ask;
}) {
  const close = useServerFn(closePeriod);
  const { refresh } = usePeriodActions();
  const [endDate, setEndDate] = useState(spParts().iso);
  const closed = period.status === "closed";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
        <span className="font-semibold">{period.name}</span>
        <Badge variant={closed ? "secondary" : "default"}>{closed ? "Encerrado" : "Ativo"}</Badge>
        <Badge variant="outline">{period.kind === "ciclo" ? "Ciclo" : "Competição"}</Badge>
        <span className="text-muted-foreground">
          Início {fmtDate(period.started_at)}
          {period.closed_at
            ? ` · Encerrado em ${new Date(period.closed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
            : ""}{" "}
          · {members} membros
        </span>
        {!closed && (
          <span className="ml-auto flex items-center gap-2">
            <Label htmlFor="end-date" className="text-xs text-muted-foreground">
              Conta até
            </Label>
            <Input
              id="end-date"
              type="date"
              className="h-8 w-[150px]"
              value={endDate}
              max={spParts().iso}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </span>
        )}
        {!closed && (
          <Button
            size="sm"
            variant="destructive"
            disabled={!endDate}
            onClick={() =>
              ask({
                title: `Encerrar e consolidar "${period.name}"`,
                desc: `O placar oficial será congelado com os resultados até ${endDate.split("-").reverse().join("/")}. Os contatos continuam rodando a cadência normalmente, e os avanços posteriores seguem contando para a maturação desta safra, mas não alteram o placar oficial.`,
                word: period.name,
                action: "Encerrar período",
                run: async () => {
                  const r = await close({
                    data: { id: period.id, confirmName: period.name, end: endDate },
                  });
                  toast.success(`Período encerrado · placar congelado para ${r.hunters} hunters`);
                  await refresh();
                },
              })
            }
          >
            Encerrar e consolidar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
