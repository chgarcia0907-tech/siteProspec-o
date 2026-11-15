import { NativeSelect } from "@/components/ui/native-select";
import type { Company } from "@/lib/empresas";
import { cn } from "@/lib/utils";

/** Vínculo do contato com uma empresa cadastrada pelo hunter (vazio = sem vínculo). */
export function CompanySelect({
  companies,
  value,
  onChange,
  className,
  emptyLabel = "Sem empresa cadastrada",
}: {
  companies: readonly Pick<Company, "id" | "name">[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  emptyLabel?: string;
}) {
  const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <NativeSelect
      aria-label="Empresa"
      className={cn("h-7 text-xs", className)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{emptyLabel}</option>
      {sorted.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </NativeSelect>
  );
}
