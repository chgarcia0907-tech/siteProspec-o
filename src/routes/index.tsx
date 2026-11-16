import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Caminho } from "@/components/inicio/Caminho";
import { Fechamento } from "@/components/inicio/Fechamento";
import { Hero } from "@/components/inicio/Hero";
import { Recursos } from "@/components/inicio/Recursos";
import { Rodape } from "@/components/inicio/Rodape";
import { Telas } from "@/components/inicio/Telas";
import { supabase } from "@/integrations/supabase/client";

const DESCRICAO =
  "Cole as conexões aceitas no LinkedIn e envie cada mensagem da cadência, no LinkedIn ou no WhatsApp, no dia útil certo, até a reunião ser marcada.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Outbound NTec — do aceite à reunião" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Outbound NTec" },
      { property: "og:description", content: DESCRICAO },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-w-[1024px] bg-background">
      <main>
        <Hero />
        <Caminho />
        <Recursos />
        <Telas />
        <Fechamento />
      </main>
      <Rodape />
    </div>
  );
}
