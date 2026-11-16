import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Campo de texto que salva ao sair (ou Enter), só se o valor mudou. */
export function InlineInput({
  value,
  placeholder,
  onCommit,
  className = "h-7 w-36",
  ...rest
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  className?: string;
  "aria-label"?: string;
  id?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <Input
      className={className}
      {...rest}
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
