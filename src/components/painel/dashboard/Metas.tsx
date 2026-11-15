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

const STATUS: Record<GoalStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: "Na meta", icon: CheckCircle2, cls: "text-success" },
  atencao: { label: "Perto", icon: AlertCircle, cls: "text-warning-text" },
  abaixo: { label: "Abaixo", icon: XCircle, cls: "text-destructive-text" },
};

/** Metas por hunter com semáforo (ícone + rótulo, nunca só cor) e o editor de metas. */
export function Metas({ d, data }: { d: Dash; data: DashData }) {
  const [editing, setEditing] = useState(false);
  const g = d.goals;
  const hasGoals = data.goals.length > 0;
  const rows = d.hunters.filter((h) => METRICS.some((m) => h.goals[m.key]));

  return (
    <Section
      title="Metas"
      hint={
        hasGoals
          ? `Metas diárias e semanais convertidas para ${g.elapsedDays} dias úteis do intervalo${
              g.partial ? " (até hoje, intervalo em andamento)" : ""
            }. Na meta = 100% ou mais; perto = 70% ou mais (no prazo: até 10 pontos abaixo).`
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {hasGoals &&
          METRICS.map((m) => {
            const t = g.onTarget[m.key];
            return t.total ? (
              <span key={m.key} className="rounded-md border px-2 py-1 text-xs">
                {m.label}: <strong>{t.ok}</strong> de {t.total} hunters na meta
              </span>
            ) : null;
          })}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(true)}>
          Configurar metas
        </Button>
      </div>
      {!hasGoals ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma meta definida. Configure a meta da equipe (e, se quiser, de grupos e hunters) para
          ver quem está na meta.
        </p>
      ) : g.elapsedDays === 0 ? (
        <p className="text-sm text-muted-foreground">
          O intervalo ainda não tem dias úteis até hoje: as metas aparecem a partir do primeiro dia
          útil.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="table-dense w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
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
    <tr className={cn("border-t", strong && "bg-muted/30 font-medium")}>
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
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className={cn("h-4 w-4 shrink-0", st.cls)} aria-hidden />
      <span className="tabular-nums">
        {num(p.real)}
        {unit} <span className="text-muted-foreground">/ {num(p.target)}</span>
        {unit}
      </span>
      <span className={cn("text-xs", st.cls)}>{st.label}</span>
    </span>
  );
}
