import { NativeSelect } from "@/components/ui/native-select";
import { PERSONAS, PERSONA_LABEL, type Persona } from "@/lib/personas";
import { cn } from "@/lib/utils";

/**
 * Seletor da persona do contato. Com `value` nulo a persona ainda é a sugerida pelo cargo: a
 * primeira opção mostra "Sugerida: <rótulo>" e um selo avisa. Escolher qualquer persona, inclusive
 * a sugerida, grava e confirma (`onChange`). `compact` serve à tabela de Contatos (`h-8`).
 */
export function PersonaSelect({
  value,
  suggested,
  onChange,
  compact = false,
  className,
}: {
  /** Persona gravada no contato (`null` = ainda sugerida). */
  value: Persona | null;
  /** Persona sugerida pelo cargo (`contactPersona(c).persona`), mostrada quando `value` é nulo. */
  suggested: Persona;
  onChange: (persona: Persona) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <NativeSelect
        aria-label="Persona"
        className={cn(compact ? "h-8" : "h-9", className)}
        value={value ?? ""}
        onChange={(e) => {
          // A opção "Sugerida" (valor "") já vem selecionada, então o evento só traz personas reais.
          onChange(e.target.value as Persona);
        }}
      >
        {!value && <option value="">Sugerida: {PERSONA_LABEL[suggested]}</option>}
        {PERSONAS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </NativeSelect>
      {!value && (
        <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
          sugerida
        </span>
      )}
    </span>
  );
}
