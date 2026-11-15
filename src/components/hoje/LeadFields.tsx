import { useState } from "react";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { CompanySelect } from "@/components/CompanySelect";
import { SectorSelect } from "@/components/SectorSelect";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/lib/cadencia";
import type { Company } from "@/lib/empresas";
import { cn } from "@/lib/utils";

/** Campos editáveis do lead na fila (nome, empresa e, no LinkedIn 1, área e cargo). */
export function LeadFields({
  contact,
  showStep1,
  companies,
  onPatch,
}: {
  contact: Contact;
  showStep1: boolean;
  companies: readonly Company[];
  onPatch: (p: Partial<Contact>) => void;
}) {
  const [cargo, setCargo] = useState(contact.job_title);
  const [nome, setNome] = useState(contact.name);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
      <Input
        aria-label="Nome do lead"
        placeholder="Nome"
        className="h-7 w-52 text-xs"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() =>
          nome.trim() && nome.trim() !== contact.name
            ? onPatch({ name: nome.trim() })
            : setNome(contact.name)
        }
      />
      {companies.length > 0 && (
        <CompanySelect
          companies={companies}
          value={contact.company_id}
          onChange={(id) => onPatch({ company_id: id })}
          emptyLabel="Vincular empresa…"
          className={cn("w-48", !contact.company_id && "border-warning")}
        />
      )}
      {!contact.company_id && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {contact.company.trim() || "Empresa"}
          <CompanyGenderToggle
            value={contact.company_gender ?? "feminino"}
            onChange={(g) => onPatch({ company_gender: g })}
          />
        </span>
      )}
      {showStep1 && (
        <>
          <SectorSelect
            value={contact.sector}
            onChange={(v) => onPatch({ sector: v })}
            className={cn("h-7 w-48 text-xs", !contact.sector && "border-warning")}
          />
          <div className="flex flex-col">
            <Input
              aria-label="Cargo na empresa"
              placeholder="Cargo na empresa"
              className={cn("h-7 w-52 text-xs", !contact.job_title.trim() && "border-warning")}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              onBlur={() =>
                cargo.trim() !== contact.job_title && onPatch({ job_title: cargo.trim() })
              }
            />
            {contact.headline && (
              <p
                className="mt-0.5 w-52 truncate text-[11px] text-muted-foreground"
                title={contact.headline}
              >
                {contact.headline}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
