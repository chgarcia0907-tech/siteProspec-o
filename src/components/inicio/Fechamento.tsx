import { useState, type CSSProperties } from "react";
import { AuthForm, type AuthMode } from "@/components/auth/AuthForm";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/** Fim da página: o formulário de entrada já aberto sobre o campo azul. */
export function Fechamento() {
  const [mode, setMode] = useState<AuthMode>("login");
  return (
    <Reveal
      className="grid min-h-[90svh] grid-cols-12 gap-8 bg-primary px-10 py-16 text-primary-foreground"
      aria-labelledby="fechamento-titulo"
    >
      <div className="col-span-6 flex flex-col justify-end">
        <h2
          id="fechamento-titulo"
          className="reveal max-w-[9ch] text-display font-extrabold text-primary-foreground"
        >
          A fila de hoje espera
        </h2>
        <p className="reveal mt-6 max-w-[40ch] text-lead" style={{ "--i": 1 } as CSSProperties}>
          Entre com o seu e-mail. O hunter cai direto em Envios de hoje; o administrador, no painel
          da equipe.
        </p>
      </div>
      <div className="col-span-5 col-start-8 flex items-center">
        <div
          data-ui
          className="reveal w-full max-w-[440px] space-y-5 rounded-xl bg-card p-7 text-foreground shadow-2xl"
          style={{ "--i": 2 } as CSSProperties}
        >
          <h3 className="text-section font-semibold">
            {mode === "login" ? "Entrar" : "Criar conta de hunter"}
          </h3>
          <div
            role="radiogroup"
            aria-label="Tenho conta?"
            className="grid grid-cols-2 gap-1 rounded-lg bg-surface-inset p-1"
          >
            {(
              [
                ["login", "Já tenho conta"],
                ["signup", "Sou novo"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-dense font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  mode === m
                    ? "bg-control text-heading"
                    : "text-muted-foreground hover:text-heading",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <AuthForm mode={mode} idPrefix="fim-" />
        </div>
      </div>
    </Reveal>
  );
}
