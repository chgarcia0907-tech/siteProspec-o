import type { ReactNode } from "react";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { CompanySelect } from "@/components/CompanySelect";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import { InlineInput } from "@/components/InlineInput";
import { PersonaSelect } from "@/components/PersonaSelect";
import { ResponseKindSelect } from "@/components/RespostaOrigem";
import { SectorSelect } from "@/components/SectorSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_LABEL,
  STEPS,
  computedStatus,
  formatBR,
  funnelIndex,
  plannedDates,
  stepApplies,
  todayISO,
  type Contact,
  type ContactStatus,
  type Holidays,
  type Offsets,
} from "@/lib/cadencia";
import { statusOptions } from "@/lib/contatos";
import type { Company } from "@/lib/empresas";
import { contactPersona } from "@/lib/personas";
import { cn } from "@/lib/utils";

/**
 * Edição detalhada de um contato, aberta pelo menu da linha (DESIGN.md, seção 7): dados do lead,
 * empresa, datas e envios da cadência, situação e funil. Cada campo salva ao mudar, como antes
 * na tabela.
 */
export function ContactEditDialog({
  contact: c,
  offsets,
  holidays,
  companies,
  onPatch,
  onStatus,
  onClose,
}: {
  contact: Contact;
  offsets: Offsets;
  holidays: Holidays;
  companies: readonly Company[];
  onPatch: (changes: Partial<Contact>) => void;
  onStatus: (s: ContactStatus) => void;
  onClose: () => void;
}) {
  const planned = plannedDates(c, offsets, holidays);
  const status = computedStatus(c);
  const [step1] = STEPS;
  const { persona, suggested } = contactPersona(c);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{c.name}</DialogTitle>
          <DialogDescription>{c.headline || "Sem headline"}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" htmlFor="ed-nome">
            <InlineInput
              id="ed-nome"
              className="h-9 w-full"
              value={c.name}
              placeholder="Nome"
              onCommit={(v) => v.trim() && onPatch({ name: v.trim() })}
            />
          </Field>
          <Field label="Cargo na empresa" htmlFor="ed-cargo">
            <InlineInput
              id="ed-cargo"
              className="h-9 w-full"
              value={c.job_title}
              placeholder="Cargo"
              onCommit={(v) => onPatch({ job_title: v })}
            />
          </Field>
          <Field label="Área">
            <SectorSelect
              value={c.sector}
              onChange={(v) => onPatch({ sector: v })}
              className="w-full"
            />
          </Field>
          <Field label="Persona">
            <PersonaSelect
              value={suggested ? null : persona}
              suggested={persona}
              onChange={(p) => onPatch({ persona: p })}
              className="w-full"
              wrapperClassName="flex w-full"
            />
          </Field>
          <Field label="Telefone/WhatsApp" htmlFor="ed-tel">
            <InlineInput
              id="ed-tel"
              className="h-9 w-full"
              value={c.phone}
              placeholder="(11) 90000-0000"
              onCommit={(v) => onPatch({ phone: v })}
            />
          </Field>
          <label className="col-span-2 -mt-2 flex cursor-pointer items-center gap-2 text-dense text-muted-foreground">
            <Checkbox
              checked={c.sem_whatsapp}
              aria-label="Sem WhatsApp"
              onCheckedChange={(v) =>
                onPatch({
                  sem_whatsapp: !!v,
                  status: computedStatus({ ...c, sem_whatsapp: !!v }),
                })
              }
            />
            Sem número de WhatsApp: tira as etapas de WhatsApp da cadência deste contato
          </label>
          <Field label="Empresa" className="col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {companies.length > 0 && (
                <CompanySelect
                  companies={companies}
                  value={c.company_id}
                  onChange={(id) => onPatch({ company_id: id })}
                  emptyLabel="Texto livre (sem cadastro)"
                  className="w-56"
                />
              )}
              {!c.company_id && (
                <>
                  <InlineInput
                    className="h-9 w-56"
                    value={c.company}
                    placeholder="Empresa"
                    onCommit={(v) => onPatch({ company: v })}
                  />
                  <CompanyGenderToggle
                    value={c.company_gender ?? "feminino"}
                    onChange={(g) => onPatch({ company_gender: g })}
                  />
                </>
              )}
            </div>
          </Field>
        </div>

        <section className="space-y-2" aria-label="Cadência">
          <p className="text-dense font-semibold text-heading">Cadência</p>
          <ul className="divide-y rounded-lg border bg-surface-inset">
            {STEPS.map((s) => {
              const sent = c[s.sentField] as string | null;
              if (!stepApplies(c, s) && !sent)
                return (
                  <li
                    key={s.n}
                    className="flex items-center gap-3 px-3 py-2 text-dense text-subtle-foreground"
                  >
                    <span className="w-24 font-semibold">{s.label}</span>
                    dispensada: contato sem WhatsApp
                  </li>
                );
              return (
                <li key={s.n} className="flex items-center gap-3 px-3 py-2 text-dense">
                  <span className="w-24 font-semibold text-heading">{s.label}</span>
                  {s.n === 1 ? (
                    <Input
                      type="date"
                      aria-label="Data do LinkedIn 1"
                      className="h-8 w-40"
                      value={c.step1_date ?? ""}
                      onChange={(e) => onPatch({ step1_date: e.target.value || null })}
                    />
                  ) : (
                    <span
                      className={cn(
                        "w-40 text-muted-foreground",
                        sent && "line-through decoration-subtle-foreground",
                      )}
                    >
                      previsto {formatBR(planned[s.n])}
                    </span>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <Checkbox
                      checked={!!sent}
                      aria-label={`${s.label} enviada`}
                      onCheckedChange={(v) =>
                        onPatch({
                          [s.sentField]: v ? todayISO() : null,
                          ...(s.n === 1 && v && !c.step1_date ? { step1_date: todayISO() } : {}),
                        })
                      }
                    />
                    {sent ? `enviada em ${formatBR(sent)}` : "não enviada"}
                  </label>
                  {s.n === 1 && !sent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() =>
                        onPatch({ step1_date: todayISO(), [step1!.sentField]: todayISO() })
                      }
                    >
                      Enviei hoje
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-dense font-semibold text-heading">Situação</span>
            {funnelIndex(c) >= 0 ? (
              <FunnelBadge contact={c} />
            ) : (
              <Select value={status} onValueChange={(v) => onStatus(v as ContactStatus)}>
                <SelectTrigger className="h-8 w-48" aria-label="Situação">
                  <SelectValue asChild>
                    <span>
                      <StatusBadge status={status} />
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions(status).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {funnelIndex(c) < 0 && <ResponseKindSelect contact={c} onPatch={onPatch} />}
          </div>
          <FunnelControl contact={c} onPatch={onPatch} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-caption font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
