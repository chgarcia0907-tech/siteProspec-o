import type { CompanyGender } from "@/lib/cadencia";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CompanyGender; label: string; tip: string }[] = [
  { value: "masculino", label: "♂ no", tip: "Masculino — “no Grupo Bild”" },
  { value: "feminino", label: "♀ na", tip: "Feminino — “na Ada”" },
  {
    value: "sem_artigo",
    label: "em",
    tip: "Sem artigo (plural ou ambíguo) — “em Lojas Americanas”",
  },
];

/** Seletor segmentado da concordância da empresa nas mensagens. */
export function CompanyGenderToggle({
  value,
  onChange,
}: {
  value: CompanyGender;
  onChange: (v: CompanyGender) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Artigo da empresa"
      className="inline-flex h-7 overflow-hidden rounded-md border"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.tip}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            "px-1.5 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
