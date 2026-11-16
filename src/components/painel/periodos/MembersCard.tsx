import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";
import { paginate } from "@/lib/paginate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewPeriod } from "@/hooks/usePainel";
import { useSelection } from "@/hooks/useSelection";
import { allocateMembers, removeMembers } from "@/lib/periodos.functions";
import type { Ask } from "@/components/useConfirm";
import { GroupSubgroupSelect } from "./GroupSubgroupSelect";
import { NO_ALLOCATION, usePeriodActions, type Allocation, type PeriodScope } from "./shared";

/** Membros do período: alocar em grupo/subgrupo e remover do período. */
export function MembersCard({
  period,
  scope,
  ask,
  onlyUnalloc,
  onOnlyUnallocChange,
  onAdd,
}: {
  period: OverviewPeriod;
  scope: PeriodScope;
  ask: Ask;
  onlyUnalloc: boolean;
  onOnlyUnallocChange: (v: boolean) => void;
  onAdd: () => void;
}) {
  const alloc = useServerFn(allocateMembers);
  const remove = useServerFn(removeMembers);
  const { run, refresh } = usePeriodActions();
  const sel = useSelection();
  const [target, setTarget] = useState<Allocation>(NO_ALLOCATION);
  const shown = onlyUnalloc ? scope.unallocated : scope.members;
  const [page, setPage] = useState(0);
  // Períodos grandes podem ter muitos membros: 50 por página, como as outras tabelas.
  const paged = paginate(shown, page, 50);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
        <CardTitle>Membros do período</CardTitle>
        <label className="flex items-center gap-1 text-caption">
          <Checkbox checked={onlyUnalloc} onCheckedChange={(v) => onOnlyUnallocChange(!!v)} /> Só
          sem grupo
        </label>
        <Button size="sm" className="ml-auto" variant="outline" onClick={onAdd}>
          Adicionar membros existentes
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/35 bg-primary-soft px-3 py-2 text-dense">
            <span>{sel.size} selecionados</span>
            <GroupSubgroupSelect
              groups={scope.groups}
              subsOf={scope.subsOf}
              value={target}
              onChange={setTarget}
            />
            <Button
              size="sm"
              onClick={async () => {
                await run(
                  () =>
                    alloc({
                      data: {
                        periodId: period.id,
                        userIds: sel.ids(),
                        groupId: target.groupId || null,
                        subgroupId: target.subgroupId || null,
                      },
                    }),
                  "Alocação salva",
                );
                sel.clear();
              }}
            >
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive-text"
              onClick={() =>
                ask({
                  title: "Remover do período",
                  desc: `${sel.size} membros sairão de "${period.name}". As contas e os contatos deles não são apagados.`,
                  action: "Remover",
                  run: async () => {
                    await remove({ data: { periodId: period.id, userIds: sel.ids() } });
                    sel.clear();
                    toast.success("Membros removidos do período");
                    await refresh();
                  },
                })
              }
            >
              Remover do período
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="table-dense w-full text-dense">
            <thead className="bg-surface-inset text-left text-caption text-muted-foreground">
              <tr>
                <th className="w-8 p-2">
                  <Checkbox
                    checked={shown.length > 0 && shown.every((m) => sel.has(m.user_id))}
                    onCheckedChange={(v) =>
                      v ? sel.selectAll(shown.map((m) => m.user_id)) : sel.clear()
                    }
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="p-2">Membro</th>
                <th className="p-2">Grupo</th>
                <th className="p-2">Subgrupo</th>
                <th className="p-2">Contatos no período</th>
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.map((m) => (
                <tr key={m.id} className="border-t transition-colors hover:bg-surface-inset">
                  <td className="p-2">
                    <Checkbox
                      checked={sel.has(m.user_id)}
                      onCheckedChange={() => sel.toggle(m.user_id)}
                      aria-label={`Selecionar ${m.name}`}
                    />
                  </td>
                  <td className="p-2 font-semibold text-heading">{m.name}</td>
                  <td className="p-2">
                    {m.group_id ? (
                      scope.groupName.get(m.group_id)
                    ) : (
                      <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
                        Sem grupo
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {m.subgroup_id ? scope.subgroupName.get(m.subgroup_id) : "—"}
                  </td>
                  <td className="p-2">{m.contacts}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-muted-foreground">
                    Nenhum membro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination paged={paged} onPage={setPage} noun="membros" />
      </CardContent>
    </Card>
  );
}
