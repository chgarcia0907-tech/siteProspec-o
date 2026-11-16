// Formatação e tipos da aba Indicadores.
import type { painelDashboard } from "@/lib/painel.functions";

export type DashData = Awaited<ReturnType<typeof painelDashboard>>;
export type Dash = DashData["dashboard"];

export const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const pctText = (v: number | null) => (v === null ? "—" : `${num(v)}%`);
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
