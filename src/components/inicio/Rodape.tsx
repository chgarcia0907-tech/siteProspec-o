import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { STEPS } from "@/lib/cadencia";
import { cn } from "@/lib/utils";
import { FOLDER } from "./pastas";
import { Reveal } from "./Reveal";

const NOME = "CADÊNCIA";
/** Alturas dos blocos (em % da faixa): sobem e descem como os toques da cadência. */
const ALTURA = [100, 78, 92, 64, 86, 70, 96, 82];

/** Fecho da página: o nome montado em pastas, uma letra por bloco, nas cores dos canais. */
export function Rodape() {
  return (
    <footer>
      <Reveal className="bg-background px-8 pt-24 pb-10" aria-label="Rodapé">
        <div className="flex h-[34svh] min-h-[240px] items-end gap-1" aria-label={NOME} role="img">
          {[...NOME].map((letra, i) => {
            const canal = STEPS[i % STEPS.length]!.channel;
            return (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "reveal folder-tab flex flex-1 items-end justify-center pb-[2vw] font-display text-display font-extrabold",
                  FOLDER[canal],
                )}
                style={
                  {
                    height: `${ALTURA[i % ALTURA.length]}%`,
                    "--i": i,
                  } as CSSProperties
                }
              >
                {letra}
              </span>
            );
          })}
        </div>
        <div className="mt-14 flex items-end justify-between gap-8 text-body">
          <div className="space-y-2">
            <p className="text-lead font-semibold text-heading">Cadência Outbound</p>
            <p className="text-muted-foreground">
              Ferramenta interna da equipe de prospecção. O cadastro é para hunters da equipe.
            </p>
            <nav aria-label="Acesso" className="flex gap-6 pt-2">
              <Link to="/auth" className="text-heading underline-offset-4 hover:underline">
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ modo: "cadastro" }}
                className="text-heading underline-offset-4 hover:underline"
              >
                Criar conta
              </Link>
            </nav>
          </div>
          <Button asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </Reveal>
    </footer>
  );
}
