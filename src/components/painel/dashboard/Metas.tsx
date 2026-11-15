import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GoalMetric, GoalProgress, GoalSet, GoalStatus } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { GoalsDialog } from "./GoalsDialog";
import { Section } from "./shared";
import { num, type Dash, type DashData } from "./format";

const METRICS: { key: GoalMetric; label: string; unit?: string }[] = [
  { key: "envios", label: "Mensagens" },
  { key: "l1", label: "LinkedIn 1" },
  { key: "ats", label: "ATs" },
  { key: "noPrazo", label: "No prazo", unit: "%" },
];

const STATUS: Record<
  GoalStatus,
  { label: string; icon: typeof CheckCircle2; cls: string; bar: string }
> = {
  ok: { label: "Na meta", icon: CheckCircle2, cls: "text-success", bar: "bg-success" },
  atencao: { label: "Perto", icon: AlertCircle, cls: "text-warning-text", bar: "bg-warning" },
  abaixo: { label: "Abaixo", icon: XCircle, cls: "text-destructive-text", bar: "bg-destructive" },
};

/** Metas por hunter com semáforo (ícone + rótulo, nunca só cor) e o editor de metas. */
export function Metas({ d, data, title = "Metas" }: { d: Dash; data: DashData; title?: string }) {
  const [editing, setEditing] = useState(false);
  const g = d.goals;
  const hasGoals = data.goals.length > 0;
  const rows = d.hunters.filter((h) => METRICS.some((m) => h.goals[m.key]));

  return (
    <Section
      title={title}
      action={
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Configurar metas
        </Button>
      }
      hint={
        hasGoals
          ? `Metas diárias e semanais convertidas para ${g.elapsedDays} dias úteis do intervalo${
              g.partial ? " (até hoje, intervalo em andamento)" : ""
            }. Na meta = 100% ou mais; perto = 70% ou mais (no prazo: até 10 pontos abaixo).`
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {hasGoals &&
          METRICS.map((m) => {
            const t = g.onTarget[m.key];
            return t.total ? (
              <span
                key={m.key}
                className="rounded-full border border-input px-2.5 py-0.5 text-caption text-muted-foreground"
              >
                {m.label}: <strong className="text-heading">{t.ok}</strong> de {t.total} na meta
              </span>
            ) : null;
          })}
      </div>
      {!hasGoals ? (
        <p className="text-dense text-muted-foreground">
          Nenhuma meta definida. Configure a meta da equipe (e, se quiser, de grupos e hunters) para
          ver quem está na meta.
        </p>
      ) : g.elapsedDays === 0 ? (
        <p className="text-dense text-muted-foreground">
          O intervalo ainda não tem dias úteis até hoje: as metas aparecem a partir do primeiro dia
          útil.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="table-dense w-full">
            <thead className="bg-surface-inset text-caption text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Hunter</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="p-2 text-left">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <GoalRow name="Equipe" goals={g.team} strong />
              {rows.map((h) => (
                <GoalRow key={h.hunter_id} name={h.hunter} goals={h.goals} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <GoalsDialog data={data} onClose={() => setEditing(false)} />}
    </Section>
  );
}

function GoalRow({ name, goals, strong }: { name: string; goals: GoalSet; strong?: boolean }) {
  return (
    <tr className={cn("border-t", strong && "bg-surface-inset font-semibold text-heading")}>
      <td className="p-2">{name}</td>
      {METRICS.map((m) => (
        <td key={m.key} className="p-2">
          <Progress p={goals[m.key]} unit={m.unit} />
        </td>
      ))}
    </tr>
  );
}

function Progress({ p, unit = "" }: { p: GoalProgress | null; unit?: string | undefined }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const st = STATUS[p.status];
  const Icon = st.icon;
  const fill = p.target > 0 ? Math.min(100, (p.real / p.target) * 100) : 0;
  return (
    <span className="flex min-w-24 flex-col gap-1 whitespace-nowrap">
      <span className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", st.cls)} aria-hidden />
        <span className="text-heading tabular-nums">
          {num(p.real)}
          {unit} <span className="text-muted-foreground">/ {num(p.target)}</span>
          {unit}
        </span>
        <span className={cn("text-caption font-semibold", st.cls)}>{st.label}</span>
      </span>
      <span className="h-1.5 rounded-full bg-divider" aria-hidden>
        <span className={cn("block h-1.5 rounded-full", st.bar)} style={{ width: `${fill}%` }} />
      </span>
    </span>
  );
}
