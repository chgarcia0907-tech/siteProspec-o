import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { ChannelBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { STEPS } from "@/lib/cadencia";
import { Reveal } from "./Reveal";

/** Recorte de um controle do app dentro da frase, na altura da linha. */
function Slot({ children }: { children: ReactNode }) {
  return (
    <span
      data-ui
      className="mx-1 inline-flex h-[1em] translate-y-[0.08em] items-center rounded-[0.18em] bg-surface-inset px-[0.3em] align-baseline"
    >
      {children}
    </span>
  );
}

/** O que a ferramenta faz, numa frase só, com os controles do app no lugar das palavras-chave. */
export function Recursos() {
  const whatsapp = STEPS.find((s) => s.channel === "whatsapp") ?? STEPS[0]!;
  return (
    <Reveal className="px-8 py-40" aria-labelledby="recursos-titulo">
      <h2 id="recursos-titulo" className="sr-only">
        O que a ferramenta faz
      </h2>
      <p className="reveal max-w-[44ch] text-statement font-medium text-heading">
        Os modelos{" "}
        <Slot>
          <span className="rounded-sm bg-primary-soft px-1.5 text-dense font-semibold text-primary">
            [NOME]
          </span>
        </Slot>{" "}
        já saem com o nome do lead e da empresa, a fila{" "}
        <Slot>
          <ChannelBadge channel={whatsapp.channel}>{whatsapp.label}</ChannelBadge>
        </Slot>{" "}
        diz o que mandar hoje, e cada setor{" "}
        <Slot>
          <span className="rounded-full bg-control px-2 text-caption font-semibold text-foreground">
            Construção
          </span>
        </Slot>{" "}
        tem a sua própria cadência.
      </p>
      <div
        className="reveal mt-[72px] ml-[50%] max-w-[44ch] space-y-5"
        style={{ "--i": 1 } as CSSProperties}
      >
        <p className="text-lead text-foreground">
          Nada de planilha paralela: a data de cada mensagem é calculada em dias úteis a partir do
          envio anterior, e quem atrasou aparece primeiro.
        </p>
        <Button asChild size="lg" className="text-lead">
          <Link to="/auth">Entrar</Link>
        </Button>
      </div>
    </Reveal>
  );
}
