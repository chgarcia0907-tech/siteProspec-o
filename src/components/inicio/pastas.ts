import { weekdayISO, type Channel } from "@/lib/cadencia";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-11-16" → "seg, 16/11". */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${WEEKDAY[weekdayISO(iso)]}, ${d}/${m}`;
}

/** Cor da pasta pelo canal da etapa: o par LinkedIn e WhatsApp do produto. */
export const FOLDER: Record<Channel, string> = {
  linkedin: "bg-linkedin text-primary-foreground",
  whatsapp: "bg-whatsapp text-primary-foreground",
};
