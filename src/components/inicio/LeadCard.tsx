import { ChannelBadge, StatusBadge } from "@/components/StatusBadge";
import { FUNNEL, STEPS } from "@/lib/cadencia";
import { cn } from "@/lib/utils";

/**
 * O mesmo lead em quatro momentos (exemplo, não é dado real): recém-importado, com empresa e
 * área, no meio da cadência e com a reunião marcada. Recorte da interface do app (`data-ui`).
 */
export function LeadCard({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const sent = stage === 2 ? 2 : stage === 3 ? 2 : 0;
  const next = STEPS[sent];
  return (
    <div
      data-ui
      className="w-[280px] space-y-3 rounded-xl border border-input bg-surface-inset p-4 text-left transition-transform duration-150 group-hover:-translate-y-1.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-card-title font-semibold text-heading">Mariana Lopes</p>
          <p className="text-dense text-muted-foreground">Gerente de RH · Construtora Atlas</p>
        </div>
        <StatusBadge
          status={stage === 3 ? "respondeu" : stage === 2 ? "em_cadencia" : "aguardando"}
        />
      </div>

      {stage === 0 ? (
        <p className="text-dense text-muted-foreground">
          Conexão em 09/11/2026 ·{" "}
          <span className="font-semibold text-warning-text">sem empresa vinculada</span>
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-dense">
          <dt className="text-subtle-foreground">Empresa</dt>
          <dd className="text-foreground">Construtora Atlas · Construção</dd>
          <dt className="text-subtle-foreground">Área</dt>
          <dd className="text-foreground">RH</dd>
        </dl>
      )}

      {stage >= 2 && (
        <div className="flex items-center justify-between gap-3">
          <span
            className="flex items-center gap-1"
            role="img"
            aria-label={`${sent} de ${STEPS.length} mensagens enviadas`}
          >
            {STEPS.map((s, i) => (
              <span
                key={s.n}
                className={cn(
                  "size-3 rounded-full border-2",
                  i < sent &&
                    (s.channel === "linkedin"
                      ? "border-linkedin bg-linkedin"
                      : "border-whatsapp bg-whatsapp"),
                  i === sent &&
                    stage === 2 &&
                    (s.channel === "linkedin" ? "border-linkedin" : "border-whatsapp"),
                  (i > sent || (i === sent && stage === 3)) && "border-divider",
                )}
              />
            ))}
          </span>
          {stage === 2 && next && (
            <ChannelBadge channel={next.channel}>{next.label} · hoje</ChannelBadge>
          )}
        </div>
      )}

      {stage === 3 && (
        <div className="flex items-center justify-between gap-3 text-dense">
          <span className="rounded-sm bg-success-soft px-2 py-0.5 text-caption font-semibold text-success">
            {FUNNEL[0]!.label} · 24/11
          </span>
          <span className="text-muted-foreground">respondeu no {STEPS[1]!.label}</span>
        </div>
      )}
    </div>
  );
}
