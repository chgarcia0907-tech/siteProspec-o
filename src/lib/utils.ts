import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * O tailwind-merge precisa conhecer a escala tipográfica do design system (src/styles.css):
 * sem isso, ele trata `text-dense` ou `text-kpi` como cor e os descarta quando a mesma lista
 * tem `text-heading`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title", "section", "card-title", "body", "dense", "caption", "kpi"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensagem legível de um erro desconhecido (para toasts). */
export function errorMessage(e: unknown, fallback = "Não foi possível concluir"): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
