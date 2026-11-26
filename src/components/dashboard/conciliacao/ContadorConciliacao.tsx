import { useConciliacao, useSemanas } from "@/hooks/useDashboard";
import { pendencias } from "@/lib/conciliacao";
import { cicloPadrao } from "@/lib/safras";

/** Pendências da conciliação no ciclo padrão, no título da aba (some quando zera). */
export function ContadorConciliacao() {
  const semanas = useSemanas();
  const ciclo = semanas.data ? cicloPadrao(semanas.data.ciclos) : null;
  const { data } = useConciliacao(ciclo?.id ?? null);
  const n = data ? pendencias(data) : 0;
  if (!n) return null;
  return (
    <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-caption font-semibold text-warning-text tabular-nums">
      {n}
      <span className="sr-only"> pendências</span>
    </span>
  );
}
