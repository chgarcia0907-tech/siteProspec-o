import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewPeriod } from "@/hooks/usePainel";
import { deleteGroupOrSub, saveGroup, saveSubgroup } from "@/lib/periodos.functions";
import type { Ask } from "../useConfirm";
import { usePeriodActions, type PeriodScope } from "./shared";

/** Grupos e subgrupos do período: criar e excluir. */
export function GroupsCard({
  period,
  scope,
  ask,
}: {
  period: OverviewPeriod;
  scope: PeriodScope;
  ask: Ask;
}) {
  const sGroup = useServerFn(saveGroup);
  const sSub = useServerFn(saveSubgroup);
  const delGS = useServerFn(deleteGroupOrSub);
  const { run, refresh } = usePeriodActions();
  const [newGroup, setNewGroup] = useState("");
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const { groups, subsOf, members } = scope;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Grupos e subgrupos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum grupo criado neste período.</p>
        )}
        {groups.map((gr) => (
          <div key={gr.id} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{gr.name}</span>
              <span className="text-xs text-muted-foreground">
                {members.filter((m) => m.group_id === gr.id).length} membros
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-destructive"
                onClick={() =>
                  ask({
                    title: `Excluir grupo "${gr.name}"`,
                    desc: 'Os subgrupos dele também serão excluídos. Os membros e os contatos continuam intactos e voltam para "Sem grupo".',
                    run: async () => {
                      await delGS({ data: { kind: "group", id: gr.id } });
                      toast.success("Grupo excluído");
                      await refresh();
                    },
                  })
                }
              >
                Excluir
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {subsOf(gr.id).map((sg) => (
                <Badge key={sg.id} variant="secondary" className="gap-1">
                  {sg.name}
                  <button
                    aria-label={`Excluir subgrupo ${sg.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      ask({
                        title: `Excluir subgrupo "${sg.name}"`,
                        desc: "Os membros continuam no grupo, apenas ficam sem subgrupo.",
                        run: async () => {
                          await delGS({ data: { kind: "subgroup", id: sg.id } });
                          toast.success("Subgrupo excluído");
                          await refresh();
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                const n = (newSub[gr.id] ?? "").trim();
                if (!n) return;
                await run(() => sSub({ data: { groupId: gr.id, name: n } }), "Subgrupo criado");
                setNewSub((x) => ({ ...x, [gr.id]: "" }));
              }}
            >
              <Input
                className="h-8"
                placeholder="Novo subgrupo (opcional)"
                value={newSub[gr.id] ?? ""}
                onChange={(e) => setNewSub((x) => ({ ...x, [gr.id]: e.target.value }))}
              />
              <Button size="sm" variant="outline" type="submit">
                Criar
              </Button>
            </form>
          </div>
        ))}
        <form
          className="flex gap-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newGroup.trim()) return;
            await run(
              () => sGroup({ data: { periodId: period.id, name: newGroup.trim() } }),
              "Grupo criado",
            );
            setNewGroup("");
          }}
        >
          <Input
            className="h-8"
            placeholder="Novo grupo"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          />
          <Button size="sm" type="submit">
            Criar grupo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
