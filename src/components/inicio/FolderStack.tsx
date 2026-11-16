import type { CSSProperties, ReactNode } from "react";
import { STEPS } from "@/lib/cadencia";
import { cn } from "@/lib/utils";
import { FOLDER, shortDay } from "./pastas";

/**
 * O motivo das páginas públicas: uma pasta por etapa de `STEPS`, empilhadas com a primeira na
 * frente. As abas andam da esquerda para a direita na ordem da cadência e, com `dates`, mostram
 * o dia útil de cada mensagem. A pasta da frente fica aberta e recebe `children`.
 */
export function FolderStack({
  dates,
  strip = 48,
  children,
  className,
}: {
  dates?: Record<number, string | null>;
  /** Quanto de cada pasta de trás aparece, em px. */
  strip?: number;
  children: ReactNode;
  className?: string;
}) {
  const back = STEPS.length - 1;
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ "--strip": `${strip}px` } as CSSProperties}
    >
      {[...STEPS].reverse().map((s, k) => {
        const depth = back - k; // 0 = a pasta da frente
        const front = depth === 0;
        const date = dates?.[s.n];
        return (
          <div
            key={s.n}
            className={cn("rise-in absolute inset-x-0 bottom-0", FOLDER[s.channel])}
            style={
              {
                top: `calc(2.75rem + var(--strip) * ${k})`,
                "--i": k,
              } as CSSProperties
            }
          >
            <div
              className={cn(
                "folder-tab absolute bottom-full flex h-11 w-60 items-center justify-between gap-3 px-6 font-display",
                FOLDER[s.channel],
              )}
              style={{ left: `calc(2rem + ${depth} * (100% - 17rem) / ${back})` }}
            >
              <span className="text-body font-bold">{s.label}</span>
              {date && (
                <span key={date} className="rise-in text-body tabular-nums">
                  {shortDay(date)}
                </span>
              )}
            </div>
            {front && <div className="h-full">{children}</div>}
          </div>
        );
      })}
    </div>
  );
}
