import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Overview } from "@/hooks/usePainel";
import { useSelection } from "@/hooks/useSelection";
import { addMembers } from "@/lib/periodos.functions";
import { errorMessage } from "@/lib/utils";
import { GroupSubgroupSelect } from "./GroupSubgroupSelect";
import { NO_ALLOCATION, type Allocation } from "./shared";

type Candidate = { id: string; name: string; info: string };

/** Quem pode entrar no período: membros de outro período ou todos os hunters, menos os atuais. */
function candidates(data: Overview, periodId: string, source: string, query: string): Candidate[] {
  const already = new Set(
    data.members.filter((m) => m.period_id === periodId).map((m) => m.user_id),
  );
  const base =
    source === "all"
      ? data.hunters.map((h) => ({ id: h.id, name: h.name, info: h.email }))
      : data.members
          .filter((m) => m.period_id === source)
          .map((m) => {
            const gn = data.groups.find((x) => x.id === m.group_id)?.name;
            const sn = data.subgroups.find((x) => x.id === m.subgroup_id)?.name;
            return {
              id: m.user_id,
              name: m.name,
              info: [gn, sn].filter(Boolean).join(" · ") || "Sem grupo",
            };
          });
  const t = query.trim().toLowerCase();
  return base.filter((x) => !already.has(x.id) && (!t || x.name.toLowerCase().includes(t)));
}

export function AddMembersDialog({
  open,
  onOpenChange,
  data,
  periodId,
  groups,
  subsOf,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: Overview;
  periodId: string;
  groups: Overview["groups"];
  subsOf: (gid: string) => Overview["subgroups"];
}) {
  const fn = useServerFn(addMembers);
  const qc = useQueryClient();
  const others = data.periods.filter((p) => p.id !== periodId); // já vem do mais recente ao mais antigo
  const [source, setSource] = useState<string>("");
  const [q, setQ] = useState("");
  const sel = useSelection();
  const [target, setTarget] = useState<Allocation>(NO_ALLOCATION);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setSource(others[0]?.id ?? "all");
      sel.clear();
      setQ("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => candidates(data, periodId, source, q), [data, periodId, source, q]);
  const allSelected = sel.size === list.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar membros existentes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="am-src">1. Membros de qual período?</Label>
            <NativeSelect
              id="am-src"
              className="w-full"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                sel.clear();
              }}
            >
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="all">Todos os membros cadastrados</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label>2. Selecione os membros</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => (allSelected ? sel.clear() : sel.selectAll(list.map((x) => x.id)))}
              >
                {allSelected && list.length
                  ? "Desmarcar todos"
                  : `Selecionar todos (${list.length})`}
              </Button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {list.map((x) => (
                <label key={x.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sel.has(x.id)} onCheckedChange={() => sel.toggle(x.id)} />
                  <span>{x.name}</span>
                  <span className="text-xs text-muted-foreground">{x.info}</span>
                </label>
              ))}
              {!list.length && (
                <p className="text-xs text-muted-foreground">
                  Ninguém para adicionar (todos já estão neste período).
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>3. Alocar em (opcional)</Label>
            <div className="flex gap-2">
              <GroupSubgroupSelect
                groups={groups}
                subsOf={subsOf}
                value={target}
                onChange={setTarget}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !sel.size}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fn({
                  data: {
                    periodId,
                    userIds: sel.ids(),
                    groupId: target.groupId || null,
                    subgroupId: target.subgroupId || null,
                  },
                });
                toast.success(`${r.added} membros adicionados`);
                await qc.invalidateQueries();
                onOpenChange(false);
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Adicionar {sel.size || ""} selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
