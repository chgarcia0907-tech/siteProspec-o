import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Channel, type ContactStatus } from "@/lib/cadencia";

const STATUS_CLASS: Record<ContactStatus, string> = {
  aguardando: "border border-input text-muted-foreground",
  em_cadencia: "bg-linkedin-soft text-linkedin",
  respondeu: "bg-success-soft text-success",
  concluido: "bg-divider text-foreground",
  descartado: "bg-destructive-soft text-destructive-text",
};

export function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ChannelBadge({
  channel,
  children,
}: {
  channel: Channel;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        channel === "linkedin"
          ? "bg-linkedin-soft text-linkedin"
          : "bg-whatsapp-soft text-whatsapp",
      )}
    >
      {children}
    </span>
  );
}
