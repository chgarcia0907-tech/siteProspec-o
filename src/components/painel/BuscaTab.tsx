import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useHunters } from "@/hooks/usePainel";
import { addDaysISO, formatBR, spParts } from "@/lib/cadencia";
import { mondayOf } from "@/lib/competition";
import { painelContacts } from "@/lib/painel.functions";
import type { Ask } from "./useConfirm";
import { ContactTable } from "./ContactTable";

const WEEKS_BACK = 26;
/** Semanas (segunda a domingo) da atual para trás. */
function weeksList(today: string) {
  const cur = mondayOf(today);
  return Array.from({ length: WEEKS_BACK }, (_, i) => {
    const from = addDaysISO(cur, -7 * i);
    return { from, to: addDaysISO(from, 6) };
  });
}

type Range = { from: string; to: string; label: string };

/** Aba "Busca geral": contatos de todos os hunters por nome/empresa e/ou dia/semana. */
export function BuscaTab({ ask }: { ask: Ask }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range | null>(null);
  const today = spParts().iso;
  const fn = useServerFn(painelContacts);
  const { data: hs } = useHunters();
  const names = useMemo(() => new Map((hs?.hunters ?? []).map((h) => [h.id, h.name])), [hs]);
  const enabled = term.length >= 2 || !!range;
  const res = useQuery({
    queryKey: ["painel_busca", term, range?.from, range?.to],
    enabled,
    queryFn: () =>
      fn({ data: { hunterId: null, q: term, from: range?.from ?? null, to: range?.to ?? null } }),
  });
  const n = res.data?.rows.length ?? 0;
  const limit = range ? 2000 : 300;

  return (
    <div className="space-y-3">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <Input
          placeholder="Nome ou empresa (opcional com filtro de data)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
      <DateRangePicker today={today} range={range} onChange={setRange} />
      {range && (
        <p className="text-xs text-muted-foreground">
          Período: <strong>{range.label}</strong> ({formatBR(range.from)}
          {range.to !== range.from ? ` a ${formatBR(range.to)}` : ""}) · contatos importados ou com
          envio/avanço no funil nesse intervalo
        </p>
      )}
      {enabled &&
        (res.isLoading ? (
          <p className="text-sm text-muted-foreground">Buscando…</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {n} resultados
              {n >= limit ? ` (mostrando os ${limit} primeiros)` : ""}
            </p>
            <ContactTable rows={res.data?.rows ?? []} names={names} ask={ask} />
          </>
        ))}
    </div>
  );
}

/** Atalhos de dia (hoje, ontem, data) e semana (esta, passada, lista) para a busca. */
function DateRangePicker({
  today,
  range,
  onChange,
}: {
  today: string;
  range: Range | null;
  onChange: (r: Range | null) => void;
}) {
  const weeks = useMemo(() => weeksList(today), [today]);
  const day = (iso: string, label: string) => onChange({ from: iso, to: iso, label });
  const week = (from: string, label?: string) =>
    onChange({
      from,
      to: addDaysISO(from, 6),
      label: label ?? `Semana de ${formatBR(from)} a ${formatBR(addDaysISO(from, 6))}`,
    });
  const isDay = range && range.from === range.to;
  const yesterday = addDaysISO(today, -1);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Dia:</span>
      <Button
        size="sm"
        variant={isDay && range?.from === today ? "default" : "outline"}
        onClick={() => day(today, "Hoje")}
      >
        Hoje
      </Button>
      <Button
        size="sm"
        variant={isDay && range?.from === yesterday ? "default" : "outline"}
        onClick={() => day(yesterday, "Ontem")}
      >
        Ontem
      </Button>
      <Input
        aria-label="Escolher dia"
        type="date"
        className="h-9 w-40"
        max={today}
        value={isDay ? range!.from : ""}
        onChange={(e) => e.target.value && day(e.target.value, formatBR(e.target.value))}
      />
      <span className="ml-3 text-muted-foreground">Semana (seg–dom):</span>
      <Button
        size="sm"
        variant={!isDay && range?.from === weeks[0]!.from ? "default" : "outline"}
        onClick={() => week(weeks[0]!.from, "Esta semana")}
      >
        Esta semana
      </Button>
      <Button
        size="sm"
        variant={!isDay && range?.from === weeks[1]!.from ? "default" : "outline"}
        onClick={() => week(weeks[1]!.from, "Semana passada")}
      >
        Semana passada
      </Button>
      <NativeSelect
        aria-label="Escolher semana"
        value={!isDay && range ? range.from : ""}
        onChange={(e) => e.target.value && week(e.target.value)}
      >
        <option value="">Escolher semana…</option>
        {weeks.map((w) => (
          <option key={w.from} value={w.from}>
            {formatBR(w.from)} a {formatBR(w.to)}
          </option>
        ))}
      </NativeSelect>
      {range && (
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Limpar data
        </Button>
      )}
    </div>
  );
}
