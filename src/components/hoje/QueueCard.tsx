import { useState } from "react";
import { ChannelBadge } from "@/components/StatusBadge";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import { Button } from "@/components/ui/button";
import { onlyDigits, type StepDef } from "@/lib/cadencia";
import { missingForMessage, type QueueItem } from "@/lib/fila";
import { cn } from "@/lib/utils";
import { CompanyFix } from "./CompanyFix";
import { LeadFields } from "./LeadFields";
import type { QueueActions } from "./useQueueActions";

/** Duração da saída do cartão ao marcar o envio (ver docs/redesign, auditoria de movimento). */
const EXIT_MS = 160;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "2026-11-06" → "06/11". */
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/**
 * Cartão de um lead na fila (DESIGN.md, seção 7): nome, selos e meta-linha à esquerda; funil,
 * mensagem e envio à direita. Os campos do lead ficam recolhidos numa faixa que só aparece
 * quando falta um dado que a mensagem usa.
 */
export function QueueCard({
  step,
  item: { contact, planned, late },
  actions,
  hackathon = false,
}: {
  step: StepDef;
  item: QueueItem;
  actions: QueueActions;
  /** Contato de um Hackathon encerrado, exibido só quando o hunter pede. */
  hackathon?: boolean;
}) {
  const hasPhone = onlyDigits(contact.phone).length >= 10;
  const noCompany = !contact.company.trim();
  const noArea = step.n === 1 && !contact.sector;
  const noCargo = step.n === 1 && !contact.job_title.trim();
  const sector = actions.sectorOf(contact);
  const template = actions.templateFor(contact, step);
  const missing = missingForMessage(contact, step, template?.body);
  const askedCompany = actions.needCompany === contact.id && noCompany;
  const [editing, setEditing] = useState(false);
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
  const faltando = [noCompany && "empresa", noArea && "área", noCargo && "cargo"].filter(Boolean);

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
        <article
          className={cn("rounded-xl border bg-card", late && "border-destructive-border")}
          aria-label={contact.name}
        >
          <div className="flex items-start gap-4 p-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-card-title font-semibold">{contact.name}</h3>
                {late && (
                  <span className="rounded-sm bg-destructive-soft px-2 py-0.5 text-caption font-semibold text-destructive-text">
                    Atrasado · previsto {ddmm(planned)}
                  </span>
                )}
                {hackathon && (
                  <span className="rounded-sm bg-control px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                    Hackathon
                  </span>
                )}
                {noCompany && <Pendencia>sem empresa</Pendencia>}
                {noArea && <Pendencia>sem área</Pendencia>}
                {noCargo && <Pendencia>sem cargo</Pendencia>}
                {step.channel === "whatsapp" && !hasPhone && <Pendencia>sem telefone</Pendencia>}
                <FunnelBadge contact={contact} />
              </div>
              <p className="truncate text-dense text-muted-foreground">
                {contact.job_title.trim() || contact.headline || "Sem cargo"}
                {contact.company ? ` · ${contact.company}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-subtle-foreground">
                <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
                {template && (
                  <span>
                    <span className="font-mono text-muted-foreground">
                      {template.code || (template.fromSector ? "setor" : "padrão")}
                    </span>{" "}
                    {template.fromSector ? "cadência do setor" : "modelo padrão"}
                  </span>
                )}
                {!late && (
                  <span>
                    {step.n === 1 && !planned
                      ? "Sem data de LinkedIn 1"
                      : `previsto ${ddmm(planned)}`}
                  </span>
                )}
                {sector && <span>{sector.name}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <FunnelControl
                contact={contact}
                onPatch={(p) => actions.patchContact(contact, p, "Funil atualizado")}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => actions.copyMessage(contact, step)}
              >
                Copiar mensagem
              </Button>
              {step.channel === "whatsapp" && hasPhone && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.openWhatsApp(contact, step)}
                >
                  Abrir WhatsApp
                </Button>
              )}
              <Button size="sm" disabled={leaving} onClick={markSent}>
                {leaving ? "Enviado ✓" : "Marcar como enviado"}
              </Button>
            </div>
          </div>
          {(missing || askedCompany) && (
            <div className="space-y-3 rounded-b-xl border-t bg-surface-inset px-4 py-3">
              {!editing && !askedCompany ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-dense text-warning-text">
                    A mensagem usa {faltando.join(", ").replace(/, ([^,]*)$/, " e $1")}. Complete
                    antes de copiar.
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    Completar dados
                  </Button>
                </div>
              ) : (
                <>
                  <LeadFields
                    key={`${contact.id}-${contact.name}`}
                    contact={contact}
                    showStep1={step.n === 1}
                    companies={actions.companies}
                    onPatch={(p) => actions.patchContact(contact, p)}
                  />
                  {askedCompany && (
                    <CompanyFix
                      initialGender={contact.company_gender ?? "feminino"}
                      onSave={(v, g) => actions.saveCompany(contact, v, g)}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function Pendencia({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
      {children}
    </span>
  );
}
