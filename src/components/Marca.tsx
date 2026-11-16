import { cn } from "@/lib/utils";

/** Nome da plataforma: "Outbound NTec", com "NTec" no azul da marca. */
export function Marca({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold text-heading", className)}>
      Outbound <span className="text-primary">NTec</span>
    </span>
  );
}
