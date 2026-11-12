import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useOverview } from "@/hooks/usePainel";
import type { Ask } from "../useConfirm";
import { NewPeriodButton } from "./NewPeriodButton";
import { PeriodDetail } from "./PeriodDetail";

/** Aba "Períodos e grupos": escolha do período e gestão de grupos e membros. */
export function PeriodosTab({ ask }: { ask: Ask }) {
  const { data, isLoading } = useOverview();
  const [pid, setPid] = useState<string | null>(null);
  const active = data?.periods.find((p) => p.status === "active");
  const period = data?.periods.find((p) => p.id === (pid ?? active?.id ?? data?.periods[0]?.id));
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="sel-period">Período</Label>
          <NativeSelect
            id="sel-period"
            value={period?.id ?? ""}
            onChange={(e) => setPid(e.target.value)}
          >
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "active" ? " (ativo)" : " (encerrado)"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <NewPeriodButton
          disabledReason={active ? `Encerre "${active.name}" para criar outro período.` : null}
          onCreated={setPid}
        />
      </div>
      {period && <PeriodDetail key={period.id} data={data} period={period} ask={ask} />}
    </div>
  );
}
