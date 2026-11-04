import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadência Outbound — cadência de prospecção" },
      {
        name: "description",
        content:
          "Importe conexões do LinkedIn, acompanhe os 5 toques da cadência e envie no dia certo.",
      },
      { property: "og:title", content: "Cadência Outbound" },
      {
        property: "og:description",
        content:
          "Importe conexões do LinkedIn, acompanhe os 5 toques da cadência e envie no dia certo.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hoje", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Prospecção outbound
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Cadência Outbound
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Cole a lista de conexões aceitas do LinkedIn, deixe o sistema calcular
          os 5 toques (LinkedIn e WhatsApp, um por dia) e envie todo dia quem
          está na fila — sem planilha e sem esquecer ninguém.
        </p>
        <ul className="mt-6 grid gap-2 text-sm text-foreground sm:grid-cols-2">
          <li className="rounded-lg border bg-card px-3 py-2">
            Importação por copiar e colar
          </li>
          <li className="rounded-lg border bg-card px-3 py-2">
            Fila de envios de hoje e atrasados
          </li>
          <li className="rounded-lg border bg-card px-3 py-2">
            Modelos com nome preenchido
          </li>
          <li className="rounded-lg border bg-card px-3 py-2">
            Ranking entre os hunters
          </li>
        </ul>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
