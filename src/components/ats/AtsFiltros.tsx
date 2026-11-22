import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FILTRO_STATUS_LABEL, type AtFiltros, type FiltroStatus } from "@/lib/ats";
import type { MembroTime } from "@/hooks/useAts";

/** Busca e filtros da tabela de ATs, juntos num cartão. */
export function AtsFiltros({
  filtros,
  onChange,
  time,
}: {
  filtros: AtFiltros;
  onChange: (f: AtFiltros) => void;
  time: readonly MembroTime[];
}) {
  const set = (p: Partial<AtFiltros>) => onChange({ ...filtros, ...p });
  const hunters = time.filter((p) => p.papel === "hunter");
  const cns = time.filter((p) => p.papel === "cn");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
      <div className="relative min-w-60 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground"
          strokeWidth={1.75}
        />
        <Input
          aria-label="Buscar por empresa ou prospect"
          placeholder="Buscar por empresa ou prospect"
          value={filtros.busca}
          onChange={(e) => set({ busca: e.target.value })}
          className="h-8 pl-8 text-dense"
        />
      </div>
      <NativeSelect
        aria-label="Situação"
        value={filtros.status}
        onChange={(e) => set({ status: e.target.value as FiltroStatus })}
        className="h-8"
      >
        {(Object.keys(FILTRO_STATUS_LABEL) as FiltroStatus[]).map((s) => (
          <option key={s} value={s}>
            {FILTRO_STATUS_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Hunter"
        value={filtros.hunter}
        onChange={(e) => set({ hunter: e.target.value })}
        className="h-8"
      >
        <option value="">Todos os hunters</option>
        {hunters.map((p) => (
          <option key={p.login} value={p.login}>
            {p.nome}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="CN"
        value={filtros.cn}
        onChange={(e) => set({ cn: e.target.value })}
        className="h-8"
      >
        <option value="">Todos os CNs</option>
        {cns.map((p) => (
          <option key={p.login} value={p.login}>
            {p.nome}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
