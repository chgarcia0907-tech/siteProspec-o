import { cn } from "@/lib/utils";

/** Nome da plataforma: o macaquinho do NTec e "Outbound NTec", com "NTec" no azul da marca. */
export function Marca({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display font-bold text-heading",
        className,
      )}
    >
      <img src="/favicon.png" alt="" aria-hidden className="size-[1.6em] shrink-0" />
      <span>
        Outbound <span className="text-primary">NTec</span>
      </span>
    </span>
  );
}
