import { useState } from "react";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/lib/cadencia";

/** Formulário que aparece quando falta a empresa para gerar a mensagem. */
export function CompanyFix({
  initialGender,
  onSave,
}: {
  initialGender: Contact["company_gender"];
  onSave: (v: string, g: Contact["company_gender"]) => void;
}) {
  const [v, setV] = useState("");
  const [g, setG] = useState(initialGender);
  return (
    <form
      className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSave(v, g);
      }}
    >
      <span className="text-xs font-medium text-warning">Preencha a empresa deste lead</span>
      <Input
        autoFocus
        aria-label="Empresa do lead"
        className="h-7 w-56 text-xs"
        placeholder="Empresa"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <CompanyGenderToggle value={g} onChange={setG} />
      <Button size="sm" type="submit" disabled={!v.trim()}>
        Salvar empresa
      </Button>
    </form>
  );
}
