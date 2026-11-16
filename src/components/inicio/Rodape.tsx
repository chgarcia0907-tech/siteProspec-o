import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/Marca";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/** As duas palavras do nome; "NTec" fica no azul da marca. */
const PALAVRAS = [
  { texto: "OUTBOUND", cor: "bg-control text-heading" },
  { texto: "NTEC", cor: "bg-primary text-primary-foreground" },
] as const;
/** Alturas dos blocos (em % da faixa): sobem e descem como os toques da cadência. */
const ALTURA = [100, 78, 92, 64, 86, 70, 96, 82, 88, 100, 74, 94];

/** Fecho da página: o nome montado em pastas, uma letra por bloco. */
export function Rodape() {
  return (
    <footer>
      <Reveal className="bg-background px-8 pt-24 pb-10" aria-label="Rodapé">
        <div
          className="flex h-[34svh] min-h-[240px] items-end gap-1"
          aria-label="Outbound NTec"
          role="img"
        >
          {PALAVRAS.flatMap(({ texto, cor }, p) =>
            [...texto].map((letra, j) => {
              const i = p * PALAVRAS[0].texto.length + j;
              return (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    "reveal folder-tab flex flex-1 items-end justify-center pb-[2vw] font-display text-mark font-extrabold",
                    cor,
                    p > 0 && j === 0 && "ml-6",
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
            }),
          )}
        </div>
        <div className="mt-14 flex items-end justify-between gap-8 text-body">
          <div className="space-y-2">
            <Marca className="block text-lead" />
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
