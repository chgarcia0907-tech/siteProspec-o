import { NativeSelect } from "@/components/ui/native-select";
import { PORTES, isPorte, type Porte } from "@/lib/empresas";
import { cn } from "@/lib/utils";

/**
 * Porte da empresa (faixa de funcionários, as mesmas do Pipedrive). Opcional: vazio aparece como
 * "Não informado", sem selo de pendência.
 */
export function PorteSelect({
  value,
  onChange,
  label,
  id,
  className,
}: {
  value: string | null;
  onChange: (porte: Porte | null) => void;
  /** Nome acessível do seletor. */
  label: string;
  id?: string;
  className?: string;
}) {
  return (
    <NativeSelect
      id={id}
      aria-label={label}
      className={cn(!value && "text-muted-foreground", className)}
      value={value ?? ""}
      onChange={(e) => onChange(isPorte(e.target.value) ? e.target.value : null)}
    >
      <option value="">Não informado</option>
      {PORTES.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </NativeSelect>
  );
}
