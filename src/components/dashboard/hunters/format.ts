// Tipos e formatação da aba Hunters.
import type { DashHuntersDados } from "@/hooks/useDashboard";
import { num } from "../format";

export type Dados = DashHuntersDados;
export type Hunter = Dados["hunters"][number];

/** Toda taxa com o volume ao lado: "90% (27 de 30)"; sem base, "—". */
export function taxa(n: number, d: number): string {
  if (d === 0) return "—";
  return `${num(Math.round((n / d) * 1000) / 10)}% (${num(n)} de ${num(d)})`;
}
