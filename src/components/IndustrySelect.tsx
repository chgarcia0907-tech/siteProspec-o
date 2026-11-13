import { NativeSelect } from "@/components/ui/native-select";
import type { Sector } from "@/lib/empresas";
import { cn } from "@/lib/utils";

/**
 * Seletor do setor (ramo de atuação) da empresa, que define a cadência de mensagens.
 * Lista os setores ativos; um setor já escolhido e depois desativado continua visível.
 */
export function IndustrySelect({
  sectors,
  value,
  onChange,
  className,
  placeholder = "Setor da empresa…",
}: {
  sectors: readonly Sector[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const options = sectors.filter((s) => s.active || s.id === value);
  return (
    <NativeSelect
      aria-label="Setor da empresa"
      className={cn(!value && "border-warning text-muted-foreground", className)}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.active ? "" : " (inativo)"}
        </option>
      ))}
    </NativeSelect>
  );
}
