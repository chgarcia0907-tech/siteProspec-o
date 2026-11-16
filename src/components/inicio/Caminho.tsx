import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { LeadCard } from "./LeadCard";
import { Reveal } from "./Reveal";

/** Os quatro momentos de um lead, do mais escuro ao mais claro (mais perto da reunião). */
const CAMPOS = [
  { bg: "bg-background", frase: "Primeiro, ele chega colado do LinkedIn." },
  { bg: "bg-sidebar", frase: "Depois, ganha empresa e área." },
  { bg: "bg-card", frase: "Aí entra na fila de cada dia." },
  { bg: "bg-control", frase: "Até a reunião ser marcada." },
] as const;

/** "Como um lead anda": quatro campos lado a lado, com o mesmo cartão cada vez mais adiante. */
export function Caminho() {
  return (
    <Reveal className="grid grid-cols-4" aria-labelledby="caminho-titulo">
      {CAMPOS.map((c, i) => (
        <div
          key={c.frase}
          className={cn("group relative flex h-[84svh] min-h-[620px] flex-col p-8", c.bg)}
        >
          {i === 0 ? (
            <h2 id="caminho-titulo" className="reveal text-statement font-extrabold text-heading">
              Como um lead anda
            </h2>
          ) : (
            <span aria-hidden />
          )}
          <div
            className="reveal absolute inset-x-0 top-[38%] flex justify-center px-6"
            style={{ "--i": i + 1 } as CSSProperties}
          >
            <LeadCard stage={i as 0 | 1 | 2 | 3} />
          </div>
          <p
            className="reveal mt-auto max-w-[16ch] text-statement font-semibold text-heading"
            style={{ "--i": i + 2 } as CSSProperties}
          >
            {c.frase}
          </p>
        </div>
      ))}
    </Reveal>
  );
}
