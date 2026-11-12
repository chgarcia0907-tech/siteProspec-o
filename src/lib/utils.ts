import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensagem legível de um erro desconhecido (para toasts). */
export function errorMessage(e: unknown, fallback = "Não foi possível concluir"): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
