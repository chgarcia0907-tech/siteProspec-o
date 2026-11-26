import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { parseGoalNumber, resolveGoal, type DashGoal } from "@/lib/dashboard";
import { painelDeleteGoal, painelSaveGoal } from "@/lib/painel.functions";
import { errorMessage } from "@/lib/utils";
import type { DashData } from "./format";

type Goal = DashData["goals"][number];
type Field = "envios_dia" | "l1_semana" | "ats_semana" | "no_prazo_pct";
const FIELDS: { key: Field; label: string }[] = [
  { key: "envios_dia", label: "Mensagens por dia útil" },
  { key: "l1_semana", label: "LinkedIn 1 por semana" },
  { key: "ats_semana", label: "ATs por semana" },
  { key: "no_prazo_pct", label: "% no prazo (mínimo)" },
];
const EMPTY: Omit<DashGoal, "user_id" | "group_id"> = {
  envios_dia: null,
  l1_semana: null,
  ats_semana: null,
  no_prazo_pct: null,
};

/** Editor das metas: padrão da equipe, metas por grupo e exceções por hunter. */
export function GoalsDialog({ data, onClose }: { data: DashData; onClose: () => void }) {
  const goals = data.goals;
  const team = goals.find((g) => !g.user_id && !g.group_id);
  const hunterGoals = goals.filter((g) => g.user_id);
  const [adding, setAdding] = useState("");
  const hunters = data.options.hunters;
  const name = new Map(hunters.map((h) => [h.id, h.name]));
  const groupOf = new Map(hunters.map((h) => [h.id, h.groupId]));
  const available = hunters.filter((h) => !hunterGoals.some((g) => g.user_id === h.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Metas</DialogTitle>
          <DialogDescription>
            Campo vazio herda do nível acima: o hunter herda do grupo, e o grupo da equipe. Os
            grupos são os do período escolhido no filtro.
          </DialogDescription>
        </DialogHeader>

        <GoalForm
          title="Equipe (padrão)"
          goal={team}
          inherited={EMPTY}
          scope={{ userId: null, groupId: null }}
        />

        {data.options.groups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-dense font-semibold">Por grupo</h3>
            {data.options.groups.map((gr) => (
              <GoalForm
                key={gr.id}
                title={gr.name}
                goal={goals.find((g) => g.group_id === gr.id)}
                inherited={resolveGoal(goals, "", null)}
                scope={{ userId: null, groupId: gr.id }}
              />
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-dense font-semibold">Exceções por hunter</h3>
          {hunterGoals.map((g) => (
            <GoalForm
              key={g.id}
              title={name.get(g.user_id!) ?? "Hunter"}
              goal={g}
              inherited={resolveGoal(
                goals.filter((x) => !x.user_id),
                g.user_id!,
                groupOf.get(g.user_id!),
              )}
              scope={{ userId: g.user_id, groupId: null }}
            />
          ))}
          {adding && (
            <GoalForm
              title={name.get(adding) ?? "Hunter"}
              goal={undefined}
              inherited={resolveGoal(goals, adding, groupOf.get(adding))}
              scope={{ userId: adding, groupId: null }}
              onSaved={() => setAdding("")}
            />
          )}
          <NativeSelect
            aria-label="Adicionar meta de um hunter"
            value=""
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">Adicionar meta para um hunter…</option>
            {available.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  title,
  goal,
  inherited,
  scope,
  onSaved,
}: {
  title: string;
  goal: Goal | undefined;
  inherited: Omit<DashGoal, "user_id" | "group_id">;
  scope: { userId: string | null; groupId: string | null };
  onSaved?: () => void;
}) {
  const save = useServerFn(painelSaveGoal);
  const del = useServerFn(painelDeleteGoal);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<Record<Field, string>>(() => {
    const v = (f: Field) => (goal?.[f] == null ? "" : String(goal[f]).replace(".", ","));
    return {
      envios_dia: v("envios_dia"),
      l1_semana: v("l1_semana"),
      ats_semana: v("ats_semana"),
      no_prazo_pct: v("no_prazo_pct"),
    };
  });
  const parsed = Object.fromEntries(
    FIELDS.map((f) => [f.key, parseGoalNumber(text[f.key])]),
  ) as Record<Field, number | null | undefined>;
  const invalid =
    FIELDS.some((f) => parsed[f.key] === undefined) || (parsed.no_prazo_pct ?? 0) > 100;
  const isTeam = !scope.userId && !scope.groupId;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["painel_dashboard"] });
      onSaved?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="rounded-lg border bg-surface-inset p-4" aria-label={`Metas: ${title}`}>
      <legend className="px-1 text-dense font-medium">{title}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-1 text-caption text-muted-foreground">
            <span>{f.label}</span>
            <Input
              inputMode="decimal"
              className="h-8"
              aria-label={`${f.label} (${title})`}
              aria-invalid={parsed[f.key] === undefined}
              placeholder={
                isTeam
                  ? "sem meta"
                  : inherited[f.key] == null
                    ? "herda: sem meta"
                    : `herda: ${String(inherited[f.key]).replace(".", ",")}`
              }
              value={text[f.key]}
              onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {goal && !isTeam && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive-text"
            disabled={busy}
            onClick={() => run(() => del({ data: { id: goal.id } }), "Meta removida")}
          >
            Remover
          </Button>
        )}
        <Button
          size="sm"
          disabled={busy || invalid}
          onClick={() =>
            run(
              () =>
                save({
                  data: {
                    ...scope,
                    envios_dia: parsed.envios_dia ?? null,
                    l1_semana: parsed.l1_semana ?? null,
                    ats_semana: parsed.ats_semana ?? null,
                    no_prazo_pct:
                      parsed.no_prazo_pct == null ? null : Math.round(parsed.no_prazo_pct),
                  },
                }),
              "Meta salva",
            )
          }
        >
          Salvar
        </Button>
      </div>
    </fieldset>
  );
}
