import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_OFFSETS, STEPS, plannedDates, spParts } from "@/lib/cadencia";
import { Marca } from "@/components/Marca";
import { FolderStack } from "./FolderStack";

/** Etapa sem envio: só a data da conexão define a previsão. */
const NOT_SENT = Object.fromEntries(STEPS.map((s) => [s.sentField, null]));

/**
 * Primeira tela: o título, uma frase e a pilha de pastas da cadência. A pasta da frente traz a
 * entrada e a única coisa viva da página: escolher o dia do aceite e ver o dia útil de cada
 * mensagem nas abas, com a mesma conta (`plannedDates`) das telas do app.
 */
export function Hero() {
  // O "hoje" só é lido no navegador: no servidor o relógio (e o fuso) pode ser outro, e a
  // diferença faria o React descartar o HTML da página na hidratação.
  const [aceite, setAceite] = useState("");
  useEffect(() => setAceite(spParts().iso), []);
  const dates = plannedDates(
    { step1_date: aceite || null, ...NOT_SENT } as Parameters<typeof plannedDates>[0],
    DEFAULT_OFFSETS,
  );

  return (
    <section className="flex h-svh min-h-[760px] flex-col" aria-labelledby="inicio-titulo">
      <header className="flex items-center justify-between px-8 py-6">
        <Marca className="text-lead" />
        <Link
          to="/auth"
          className="rounded-md px-3 py-2 text-lead text-heading transition-colors hover:bg-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Entrar
        </Link>
      </header>

      <div className="px-8 pt-[6vh] pb-16 text-center">
        <h1 id="inicio-titulo" className="rise-in text-display font-extrabold text-heading">
          Do aceite à reunião
        </h1>
        <p
          className="rise-in mx-auto mt-6 max-w-[46ch] text-lead text-foreground"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Cole as conexões aceitas no LinkedIn. O Outbound NTec diz quem recebe cada mensagem, no
          LinkedIn ou no WhatsApp, a cada dia útil, até a reunião ser marcada.
        </p>
      </div>

      <FolderStack dates={dates} className="mx-[4vw] flex-1">
        <div className="flex h-full items-start justify-between gap-10 px-10 pt-8">
          <div className="space-y-3">
            <Button
              asChild
              size="lg"
              className="bg-background px-8 text-lead text-heading hover:bg-card"
            >
              <Link to="/auth">Entrar</Link>
            </Button>
            <p className="text-body">
              Ainda sem conta?{" "}
              <Link
                to="/auth"
                search={{ modo: "cadastro" }}
                className="font-bold underline underline-offset-4"
              >
                Criar conta de hunter
              </Link>
            </p>
          </div>
          <div className="flex items-start gap-6">
            <div className="space-y-2">
              <label htmlFor="aceite" className="block text-body font-bold">
                Conexão aceita em
              </label>
              <Input
                id="aceite"
                type="date"
                value={aceite}
                onChange={(e) => setAceite(e.target.value)}
                className="h-11 w-48 border-transparent bg-background text-body text-heading"
              />
            </div>
            <p className="max-w-[34ch] pt-7 text-body">
              Cada aba mostra o dia da mensagem. Fim de semana fica de fora e, dentro do app, os
              feriados cadastrados também.
            </p>
          </div>
        </div>
      </FolderStack>
    </section>
  );
}
