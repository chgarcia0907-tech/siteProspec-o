import * as React from "react";
import { cn } from "@/lib/utils";

/** `<select>` nativo com o visual dos inputs (para filtros simples e formulários densos). */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("h-9 rounded-md border border-input bg-background px-2 text-sm", className)}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
