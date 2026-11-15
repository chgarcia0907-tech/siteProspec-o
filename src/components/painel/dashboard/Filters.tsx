import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RANGE_LABEL, presetRange, type ChannelFilter, type RangePreset } from "@/lib/dashboard";
import type { DashData } from "./format";

export type DashFilters = {
  from: string;
  to: string;
  preset: RangePreset | "periodo" | "livre";
  periodId: string | null;
  groupId: string | null;
  subgroupId: string | null;
  hunterId: string | null;
  sectorId: string | null;
  channel: ChannelFilter;
};

/** Filtros em uma linha, acima de tudo: valem para a página inteira. */
export function Filters({
  value,
  onChange,
  options,
  today,
}: {
  value: DashFilters;
  onChange: (f: DashFilters) => void;
  options: DashData["options"] | undefined;
  today: string;
}) {
  const set = (patch: Partial<DashFilters>) => onChange({ ...value, ...patch });
  const period = options?.periods.find((p) => p.id === value.periodId);
  const subgroups = (options?.subgroups ?? []).filter(
    (s) => !value.groupId || s.groupId === value.groupId,
  );
  const hunters = (options?.hunters ?? []).filter(
    (h) => !value.groupId || h.groupId === value.groupId,
  );

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(RANGE_LABEL) as RangePreset[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={value.preset === p ? "default" : "outline"}
            onClick={() => set({ preset: p, ...presetRange(p, today) })}
          >
            {RANGE_LABEL[p]}
          </Button>
        ))}
        {period && (
          <Button
            size="sm"
            variant={value.preset === "periodo" ? "default" : "outline"}
            onClick={() =>
              set({
                preset: "periodo",
                from: period.start,
                to: period.end && period.end < today ? period.end : today,
              })
            }
          >
            Período inteiro
          </Button>
        )}
        <div className="flex items-center gap-1">
          <Input
            aria-label="Início do intervalo"
            type="date"
            className="h-9 w-40"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && set({ preset: "livre", from: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            aria-label="Fim do intervalo"
            type="date"
            className="h-9 w-40"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && set({ preset: "livre", to: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Período"
          value={value.periodId ?? ""}
          onChange={(e) =>
            set({ periodId: e.target.value || null, groupId: null, subgroupId: null })
          }
        >
          {(options?.periods ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.active ? " (ativo)" : ""}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Grupo"
          value={value.groupId ?? ""}
          onChange={(e) =>
            set({ groupId: e.target.value || null, subgroupId: null, hunterId: null })
          }
        >
          <option value="">Todos os grupos</option>
          {(options?.groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Subgrupo"
          value={value.subgroupId ?? ""}
          disabled={!subgroups.length}
          onChange={(e) => set({ subgroupId: e.target.value || null })}
        >
          <option value="">Todos os subgrupos</option>
          {subgroups.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Hunter"
          value={value.hunterId ?? ""}
          onChange={(e) => set({ hunterId: e.target.value || null })}
        >
          <option value="">Todos os hunters</option>
          {hunters.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Setor da empresa"
          value={value.sectorId ?? ""}
          onChange={(e) => set({ sectorId: e.target.value || null })}
        >
          <option value="">Todos os setores</option>
          {(options?.sectors ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Canal"
          value={value.channel}
          onChange={(e) => set({ channel: e.target.value as ChannelFilter })}
        >
          <option value="todos">LinkedIn e WhatsApp</option>
          <option value="linkedin">Só LinkedIn</option>
          <option value="whatsapp">Só WhatsApp</option>
        </NativeSelect>
      </div>
    </div>
  );
}
