import { useState } from "react";
import { ChannelBadge } from "@/components/StatusBadge";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import { Button } from "@/components/ui/button";
import { formatBR, onlyDigits, type StepDef } from "@/lib/cadencia";
import type { QueueItem } from "@/lib/fila";
import { cn } from "@/lib/utils";
import { CompanyFix } from "./CompanyFix";
import { LeadFields } from "./LeadFields";
import type { QueueActions } from "./useQueueActions";

/** Duração da saída do cartão ao marcar o envio (ver docs/redesign, auditoria de movimento). */
const EXIT_MS = 160;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  /**
   * Envio registrado: o botão trava na hora e o cartão sai da fila (opacidade, leve deslocamento e
   * altura fechando), sem receber cliques. Assim um segundo toque rápido não grava de novo nem cai
   * no lead que sobe para o lugar dele. A remoção em si é otimista (useUpdateContact).
   */
  const [leaving, setLeaving] = useState(false);
  function markSent() {
    if (leaving) return;
    setLeaving(true);
    if (reducedMotion()) actions.markSent(contact, step);
    else window.setTimeout(() => actions.markSent(contact, step), EXIT_MS);
  }
  return (
    <div
      data-slot="queue-card"
      data-leaving={leaving || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity,translate] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        leaving
          ? "pointer-events-none translate-x-1.5 grid-rows-[0fr] opacity-0"
          : "grid-rows-[1fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
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
              title={
                template.fromSector ? "Mensagem da cadência do setor" : "Modelo padrão da equipe"
              }
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => actions.openWhatsApp(contact, step)}
                >
                  Abrir WhatsApp
                </Button>
              ) : (
                <Warn>sem telefone</Warn>
              ))}
            <Button size="sm" disabled={leaving} onClick={markSent}>
              {leaving ? "Enviado ✓" : "Marcar como enviado"}
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
      </div>
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
