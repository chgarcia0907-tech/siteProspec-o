import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS } from "@/lib/cadencia";

/** Seletor da área do lead (TI, RH...), que alimenta [DOR_DO_SETOR]. O ramo da empresa fica em `IndustrySelect`. */
export function SectorSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label="Área do contato">
        <SelectValue placeholder="Área" />
      </SelectTrigger>
      <SelectContent>
        {SECTORS.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
