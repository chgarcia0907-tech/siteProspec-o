import { NativeSelect } from "@/components/ui/native-select";
import { PERSONAS, PERSONA_LABEL, type Persona } from "@/lib/personas";
import { cn } from "@/lib/utils";

/**
 * Seletor da persona do contato. Com `value` nulo a persona ainda é a sugerida pelo cargo: a
 * primeira opção mostra "Sugerida: <rótulo>" e um selo avisa. Escolher qualquer persona, inclusive
 * a sugerida, grava e confirma (`onChange`). `compact` serve à tabela de Contatos (`h-8`); `noBadge`
 * troca o selo pela borda tracejada, para caber em 1280 px.
 */
export function PersonaSelect({
  value,
  suggested,
  onChange,
  compact = false,
  noBadge = false,
  className,
  wrapperClassName,
}: {
  /** Persona gravada no contato (`null` = ainda sugerida). */
  value: Persona | null;
  /** Persona sugerida pelo cargo (`contactPersona(c).persona`), mostrada quando `value` é nulo. */
  suggested: Persona;
  onChange: (persona: Persona) => void;
  compact?: boolean;
  /** Tabela de Contatos: sem selo nem prefixo; a sugestão vai em borda tracejada, aria-label e title. */
  noBadge?: boolean;
  className?: string;
  /** Classes do contêiner (ex.: `flex w-full` para o select ocupar a largura do campo). */
  wrapperClassName?: string;
}) {
  // Em Contatos (`noBadge`) os rótulos perdem o "Owner do/da " para caber na coluna.
  const short = (label: string) => (noBadge ? label.replace(/^Owner d[oa] /, "") : label);
  const hint = noBadge && !value;
  return (
    <span className={cn("inline-flex items-center gap-1.5", wrapperClassName)}>
      <NativeSelect
        aria-label={hint ? "Persona (sugerida)" : "Persona"}
        title={
          hint
            ? `Sugerida pelo cargo: ${PERSONA_LABEL[suggested]}. Escolha para confirmar.`
            : noBadge && value
              ? PERSONA_LABEL[value]
              : undefined
        }
        className={cn(
          compact ? "h-8" : "h-9",
          hint && "border-dashed text-muted-foreground",
          className,
        )}
        value={value ?? ""}
        onChange={(e) => {
          // A opção "Sugerida" (valor "") já vem selecionada, então o evento só traz personas reais.
          onChange(e.target.value as Persona);
        }}
      >
        {!value && (
          // Em Contatos o rótulo da sugestão repete o da opção real: escondida da lista aberta,
          // ela só aparece no select fechado.
          <option value="" hidden={noBadge}>
            {noBadge ? short(PERSONA_LABEL[suggested]) : `Sugerida: ${PERSONA_LABEL[suggested]}`}
          </option>
        )}
        {PERSONAS.map((p) => (
          <option key={p.key} value={p.key}>
            {short(p.label)}
          </option>
        ))}
      </NativeSelect>
      {!value && !noBadge && (
        <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
          sugerida
        </span>
      )}
    </span>
  );
}
