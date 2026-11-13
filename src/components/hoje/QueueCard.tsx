import { ChannelBadge } from "@/components/StatusBadge";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import { Button } from "@/components/ui/button";
import { formatBR, onlyDigits, type StepDef } from "@/lib/cadencia";
import type { QueueItem } from "@/lib/fila";
import { cn } from "@/lib/utils";
import { CompanyFix } from "./CompanyFix";
import { LeadFields } from "./LeadFields";
import type { QueueActions } from "./useQueueActions";

/** Cartão de um lead na fila: avisos, mensagem, WhatsApp, envio e funil. */
export function QueueCard({
  step,
  item: { contact, planned, late },
  actions,
}: {
  step: StepDef;
  item: QueueItem;
  actions: QueueActions;
}) {
  const hasPhone = onlyDigits(contact.phone).length >= 10;
  const noCompany = !contact.company.trim();
  const sector = actions.sectorOf(contact);
  const template = actions.templateFor(contact, step);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2",
        late && "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="min-w-56 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{contact.name}</span>
          {late && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              Atrasado — previsto {formatBR(planned)}
            </span>
          )}
          {noCompany && <Warn>sem empresa</Warn>}
          {step.n === 1 && !contact.sector && <Warn>sem área</Warn>}
          {step.n === 1 && !contact.job_title.trim() && <Warn>sem cargo</Warn>}
          <FunnelBadge contact={contact} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {contact.company ? `${contact.company} · ` : ""}
          {contact.headline || "Sem cargo"}
        </p>
      </div>
      {sector && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          {sector.name}
        </span>
      )}
      <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
      {template && (
        <span
          className="font-mono text-[11px] text-muted-foreground"
          title={template.fromSector ? "Mensagem da cadência do setor" : "Modelo padrão da equipe"}
        >
          {template.code || (template.fromSector ? "setor" : "padrão")}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {step.n === 1 && !planned ? "Sem data de LinkedIn 1" : `Previsto ${formatBR(planned)}`}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => actions.copyMessage(contact, step)}>
          Copiar mensagem
        </Button>
        {step.channel === "whatsapp" &&
          (hasPhone ? (
            <Button size="sm" variant="outline" onClick={() => actions.openWhatsApp(contact, step)}>
              Abrir WhatsApp
            </Button>
          ) : (
            <Warn>sem telefone</Warn>
          ))}
        <Button size="sm" onClick={() => actions.markSent(contact, step)}>
          Marcar como enviado
        </Button>
        <FunnelControl
          contact={contact}
          onPatch={(p) => actions.patchContact(contact, p, "Funil atualizado")}
        />
      </div>
      <LeadFields
        key={`${contact.id}-${contact.name}`}
        contact={contact}
        showStep1={step.n === 1}
        companies={actions.companies}
        onPatch={(p) => actions.patchContact(contact, p)}
      />
      {actions.needCompany === contact.id && noCompany && (
        <CompanyFix
          initialGender={contact.company_gender ?? "feminino"}
          onSave={(v, g) => actions.saveCompany(contact, v, g)}
        />
      )}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
      {children}
    </span>
  );
}
