import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { AuthForm, type AuthMode } from "@/components/auth/AuthForm";
import { FolderStack } from "@/components/inicio/FolderStack";
import { Marca } from "@/components/Marca";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { modo?: "cadastro" } =>
    s["modo"] === "cadastro" ? { modo: "cadastro" } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Outbound NTec" },
      {
        name: "description",
        content: "Acesse sua conta de hunter para ver seus contatos e filas.",
      },
      { property: "og:title", content: "Entrar — Outbound NTec" },
      {
        property: "og:description",
        content: "Acesse sua conta de hunter para ver seus contatos e filas.",
      },
    ],
  }),
  component: AuthPage,
});

const MODOS: [AuthMode, string][] = [
  ["login", "Entrar"],
  ["signup", "Criar conta"],
];

function AuthPage() {
  const navigate = useNavigate();
  const { modo } = Route.useSearch();
  const [mode, setMode] = useState<AuthMode>(modo === "cadastro" ? "signup" : "login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  return (
    <div className="grid h-svh min-h-[720px] min-w-[1024px] grid-cols-[minmax(0,1fr)_minmax(460px,40%)] bg-background">
      <section className="flex flex-col" aria-label="Outbound NTec">
        <header className="flex items-center justify-between px-8 py-6">
          <Link to="/" className="text-lead">
            <Marca />
          </Link>
        </header>
        <p
          className="rise-in px-8 pt-[4vh] font-display text-display font-extrabold text-heading"
          aria-hidden
        >
          Do aceite à reunião
        </p>
        <FolderStack strip={40} className="mt-14 mr-[4vw] ml-8 flex-1">
          <p className="max-w-[40ch] px-10 pt-8 text-lead">
            Uma pasta por mensagem da cadência, cada uma no seu dia útil. Entre para ver quem recebe
            a de hoje.
          </p>
        </FolderStack>
      </section>

      <section
        className="flex flex-col justify-center bg-sidebar px-12"
        aria-labelledby="auth-titulo"
      >
        <h1 id="auth-titulo" className="rise-in text-title font-bold">
          {mode === "login" ? "Entrar" : "Criar conta de hunter"}
        </h1>
        <p
          className="rise-in mt-2 text-lead text-muted-foreground"
          style={{ "--i": 1 } as CSSProperties}
        >
          {mode === "login"
            ? "Entre com seu e-mail para ver seus contatos."
            : "Crie sua conta para começar a sua cadência."}
        </p>

        <div className="rise-in mt-12" style={{ "--i": 2 } as CSSProperties}>
          <div role="tablist" aria-label="Entrar ou criar conta" className="flex gap-1">
            {MODOS.map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`aba-${m}`}
                aria-selected={mode === m}
                aria-controls="auth-painel"
                onClick={() => setMode(m)}
                className={cn(
                  "folder-tab flex h-11 w-44 cursor-pointer items-center justify-center font-display text-body font-bold transition-colors focus-visible:text-primary focus-visible:outline-none",
                  mode === m
                    ? "bg-card text-heading"
                    : "bg-surface-inset text-muted-foreground hover:text-heading",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="auth-painel"
            role="tabpanel"
            aria-labelledby={`aba-${mode}`}
            className="bg-card p-7"
          >
            <AuthForm mode={mode} />
          </div>
          <Link
            to="/"
            className="mt-6 inline-block text-body text-muted-foreground underline-offset-4 hover:text-heading hover:underline"
          >
            Voltar para a página inicial
          </Link>
        </div>
      </section>
    </div>
  );
}
