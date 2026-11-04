import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Channel, type ContactStatus } from "@/lib/cadencia";

const STATUS_CLASS: Record<ContactStatus, string> = {
  aguardando: "bg-muted text-muted-foreground",
  em_cadencia: "bg-linkedin-soft text-linkedin",
  respondeu: "bg-success-soft text-success",
  concluido: "bg-accent text-accent-foreground",
  descartado: "bg-warning-soft text-warning",
};

export function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        channel === "linkedin"
          ? "bg-linkedin-soft text-linkedin"
          : "bg-whatsapp-soft text-whatsapp",
      )}
    >
      {children}
    </span>
  );
}
