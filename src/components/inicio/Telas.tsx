import { useState, type CSSProperties, type ReactNode } from "react";
import { ChannelBadge, StatusBadge } from "@/components/StatusBadge";
import { STEPS, type ContactStatus } from "@/lib/cadencia";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const [L1, W1, L2] = STEPS;

/** Recortes das telas do hunter, com dados de exemplo. */
function Hoje() {
  return (
    <div className="space-y-3">
      <p className="text-dense text-muted-foreground">3 de 8 envios feitos hoje</p>
      <div className="h-1.5 rounded-full bg-control">
        <div className="h-full w-[37%] rounded-full bg-primary" />
      </div>
      <div className="space-y-3 rounded-xl border border-input bg-surface-inset p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-card-title font-semibold text-heading">Rafael Nunes</p>
          {L2 && <ChannelBadge channel={L2.channel}>{L2.label}</ChannelBadge>}
        </div>
        <p className="text-dense text-foreground">
          Oi, Rafael! Vi que a Vértice Logística está abrindo vagas no time de operações e queria te
          mostrar como ajudamos empresas do setor a…
        </p>
        <div className="flex gap-2">
          <span className="rounded-md bg-primary px-3 py-1.5 text-dense font-semibold text-primary-foreground">
            Copiar mensagem
          </span>
          <span className="rounded-md border border-input bg-control px-3 py-1.5 text-dense font-semibold text-heading">
            Marcar como enviado
          </span>
        </div>
      </div>
    </div>
  );
}

const CONTATOS: [string, string, ContactStatus][] = [
  ["Mariana Lopes", "Construtora Atlas", "respondeu"],
  ["Rafael Nunes", "Vértice Logística", "em_cadencia"],
  ["Beatriz Prado", "Clínica Aurora", "em_cadencia"],
  ["Tiago Moreira", "Agro Serra", "aguardando"],
];

function Contatos() {
  return (
    <table className="table-dense w-full rounded-xl bg-surface-inset text-left">
      <thead>
        <tr className="text-muted-foreground">
          <th className="font-semibold">Contato</th>
          <th className="font-semibold">Empresa</th>
          <th className="font-semibold">Situação</th>
        </tr>
      </thead>
      <tbody>
        {CONTATOS.map(([nome, empresa, status]) => (
          <tr key={nome} className="border-t">
            <td className="font-semibold text-heading">{nome}</td>
            <td className="text-foreground">{empresa}</td>
            <td>
              <StatusBadge status={status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empresas() {
  return (
    <div className="space-y-3">
      <p className="font-display text-card-title font-semibold text-heading">
        Semana de 09/11 a 13/11
      </p>
      <ul className="divide-y rounded-xl border border-input bg-surface-inset text-dense">
        {[
          ["Construtora Atlas", "Construção", 6],
          ["Vértice Logística", "Logística", 4],
          ["Clínica Aurora", "Saúde", 3],
        ].map(([nome, setor, n]) => (
          <li key={nome} className="flex items-center justify-between px-4 py-3">
            <span className="font-semibold text-heading">{nome}</span>
            <span className="text-muted-foreground">
              {setor} · {n} contatos
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Importar() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-input bg-surface-inset p-4 text-dense text-muted-foreground">
        <p className="text-heading">Beatriz Prado</p>
        <p>Coordenadora de Operações na Clínica Aurora</p>
        <p>Conectado em 10 de novembro de 2026</p>
        <p className="mt-2 text-heading">Tiago Moreira</p>
        <p>Diretor Comercial | Agro Serra</p>
        <p>Conectado em 11 de novembro de 2026</p>
      </div>
      <div className="flex gap-2">
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-caption font-semibold text-success">
          12 novos
        </span>
        <span className="rounded-full border border-input px-2.5 py-0.5 text-caption font-semibold text-muted-foreground">
          3 já cadastrados
        </span>
      </div>
    </div>
  );
}

function Modelos() {
  return (
    <div className="space-y-3">
      {W1 && <ChannelBadge channel={W1.channel}>{W1.label}</ChannelBadge>}
      <p className="rounded-xl border border-input bg-surface-inset p-4 text-dense leading-relaxed text-foreground">
        [SAUDACAO], <Var>[NOME]</Var>! Aqui é o <Var>[CONSULTOR]</Var>. Te mandei uma mensagem no
        LinkedIn sobre <Var>[DOR_DO_SETOR]</Var> <Var>[NA_EMPRESA]</Var>. Tem 15 minutos{" "}
        <Var>[JANELA]</Var>?
      </p>
    </div>
  );
}

function Var({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-primary-soft px-1 text-caption font-semibold text-primary">
      {children}
    </span>
  );
}

const TELAS = [
  {
    nome: "Envios de hoje",
    desc: `Quem recebe ${L1?.label ?? "a mensagem"} e as outras etapas hoje, com os atrasados no topo.`,
    tela: <Hoje />,
  },
  {
    nome: "Contatos",
    desc: "Todos os leads, com a situação e o próximo envio.",
    tela: <Contatos />,
  },
  {
    nome: "Empresas da semana",
    desc: "As empresas que você vai prospectar, cada uma com o seu setor.",
    tela: <Empresas />,
  },
  {
    nome: "Importar conexões",
    desc: "Copie a lista do LinkedIn e cole: os repetidos ficam de fora.",
    tela: <Importar />,
  },
  {
    nome: "Modelos",
    desc: "O texto de cada etapa, com as variáveis que o app preenche.",
    tela: <Modelos />,
  },
];

/**
 * As telas do hunter como lista: apontar (ou focar) uma linha mostra o recorte dela na pasta
 * ao lado e apaga as outras linhas.
 */
export function Telas() {
  const [ativa, setAtiva] = useState(0);
  return (
    <Reveal
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,560px)] gap-16 bg-sidebar px-8 py-40"
      aria-labelledby="telas-titulo"
    >
      <div>
        <h2 id="telas-titulo" className="reveal text-statement font-extrabold text-heading">
          O que o hunter usa todo dia
        </h2>
        <ul className="mt-12 space-y-2">
          {TELAS.map((t, i) => (
            <li key={t.nome} className="reveal" style={{ "--i": i + 1 } as CSSProperties}>
              <button
                type="button"
                aria-pressed={ativa === i}
                onMouseEnter={() => setAtiva(i)}
                onFocus={() => setAtiva(i)}
                onClick={() => setAtiva(i)}
                className={cn(
                  "block w-full cursor-pointer rounded-lg px-4 py-3 text-left transition-[opacity,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  ativa === i ? "bg-card" : "opacity-45 hover:opacity-80",
                )}
              >
                <span className="block font-display text-statement font-bold text-heading">
                  {t.nome}
                </span>
                <span className="mt-1 block text-lead text-foreground">{t.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="reveal sticky top-24 self-start pt-11" style={{ "--i": 2 } as CSSProperties}>
        <div className="relative">
          <div className="folder-tab absolute bottom-full left-6 flex h-11 w-60 items-center bg-card px-6 font-display text-body font-bold text-heading">
            {TELAS[ativa]!.nome}
          </div>
          <div className="relative min-h-[360px] bg-card p-6">
            {TELAS.map((t, i) => (
              <div
                key={t.nome}
                data-ui
                aria-hidden={ativa !== i}
                className={cn(
                  "absolute inset-6 transition-[opacity,translate] duration-[240ms]",
                  ativa === i ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                {t.tela}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
