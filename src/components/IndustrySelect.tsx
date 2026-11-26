import { NativeSelect } from "@/components/ui/native-select";
import {
  parseSectorOption,
  sectorOptions,
  sectorPath,
  sectorOptionValue,
  type SectorNode,
} from "@/lib/empresas";
import { cn } from "@/lib/utils";

/** Escolha do seletor: o setor e, quando houver, o subsetor dele. */
export type SectorChoice = { sector_id: string; subsector_id: string | null };

/**
 * Seletor setor › subsetor da empresa (ramo de atuação), que define a cadência de mensagens.
 * Um grupo por setor: a opção do setor sozinho primeiro e os subsetores ativos depois. O valor
 * já escolhido e depois desativado continua visível.
 */
export function IndustrySelect({
  sectors,
  sectorId,
  subsectorId,
  onChange,
  className,
  placeholder = "Setor da empresa…",
  label = "Setor da empresa",
  id,
}: {
  /** Setores e subsetores (`useSectorTree`). */
  sectors: readonly SectorNode[];
  sectorId: string;
  subsectorId: string | null;
  onChange: (choice: SectorChoice) => void;
  className?: string;
  placeholder?: string;
  /** Nome acessível do seletor. */
  label?: string;
  id?: string;
}) {
  const options = sectorOptions(sectors, { sectorId: sectorId || null, subsectorId });
  const value = sectorId ? sectorOptionValue(sectorId, subsectorId) : "";
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <NativeSelect
      id={id}
      aria-label={label}
      title={sectorPath(sectors, sectorId, subsectorId) || undefined}
      className={cn(!value && "border-warning text-muted-foreground", className)}
      value={value}
      onChange={(e) => {
        const parsed = parseSectorOption(e.target.value);
        if (parsed) onChange({ sector_id: parsed.sectorId, subsector_id: parsed.subsectorId });
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {options
            .filter((o) => o.group === group)
            .map((o) => {
              const node = sectors.find((s) => s.id === (o.subsectorId ?? o.sectorId));
              const top = sectors.find((s) => s.id === o.sectorId);
              const inativo = node?.active === false || top?.active === false;
              return (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {inativo ? " (inativo)" : ""}
                </option>
              );
            })}
        </optgroup>
      ))}
    </NativeSelect>
  );
}
