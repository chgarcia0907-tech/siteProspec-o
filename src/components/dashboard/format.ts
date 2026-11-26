// Formatação e tipos da aba Indicadores.
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type { GoalStatus } from "@/lib/dashboard";
import type { painelDashboard } from "@/lib/painel.functions";

export type DashData = Awaited<ReturnType<typeof painelDashboard>>;
export type Dash = DashData["dashboard"];

export const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const pctText = (v: number | null) => (v === null ? "—" : `${num(v)}%`);
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Semáforo das metas: ícone + rótulo + cor, nunca só cor (Metas e KPI de ATs). */
export const GOAL_STATUS: Record<
  GoalStatus,
  { label: string; icon: typeof CheckCircle2; cls: string; bar: string }
> = {
  ok: { label: "Na meta", icon: CheckCircle2, cls: "text-success", bar: "bg-success" },
  atencao: { label: "Perto", icon: AlertCircle, cls: "text-warning-text", bar: "bg-warning" },
  abaixo: { label: "Abaixo", icon: XCircle, cls: "text-destructive-text", bar: "bg-destructive" },
};
