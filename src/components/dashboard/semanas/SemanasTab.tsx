import { Link } from "@tanstack/react-router";
import { CalendarRange } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Ask } from "@/components/useConfirm";
import { useSemanas, useSemanasAcoes } from "@/hooks/useDashboard";
import { addDaysISO, formatBR, spParts } from "@/lib/cadencia";
import { weekStartISO } from "@/lib/empresas";
import {
  METAS_CICLO_VAZIAS,
  calendarioSafras,
  cicloPadrao,
  rotuloSafra,
  type Safra,
  type SafraForm,
} from "@/lib/safras";
import { Section } from "../shared";
import { AlocacaoSemana } from "./AlocacaoSemana";
import { CalendarioSafras } from "./CalendarioSafras";
import { GerarSemanasDialog } from "./GerarSemanasDialog";
import { MetasCicloCard, MetasCicloDialog } from "./MetasCiclo";
import { ParametrosDialog } from "./ParametrosDialog";
import { SafraDialog } from "./SafraDialog";
import { TestesAbCard } from "./TestesAb";

type Aberto =
  | { tipo: "nova" }
  | { tipo: "editar"; safra: Safra }
  | { tipo: "gerar" }
  | { tipo: "metas" }
  | { tipo: "parametros" }
  | null;

/** Aba Semanas: como o ciclo está dividido em safras e em que fase está cada uma. */
export function SemanasTab({ ask }: { ask: Ask }) {
  const { data, isLoading, error, refetch } = useSemanas();
  const acoes = useSemanasAcoes();
  const hoje = spParts().iso;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);

  const ciclo = useMemo(() => {
    if (!data) return null;
    return data.ciclos.find((c) => c.id === escolhido) ?? cicloPadrao(data.ciclos);
  }, [data, escolhido]);
  const doCiclo = useMemo(
    () => (data && ciclo ? data.safras.filter((s) => s.period_id === ciclo.id) : []),
    [data, ciclo],
  );
  const calendario = useMemo(
    () => calendarioSafras(doCiclo, hoje, data?.parametros.maturacao_semanas ?? 3),
    [doCiclo, hoje, data],
  );

  if (isLoading) return <p className="text-dense text-muted-foreground">Carregando semanas…</p>;
  if (error || !data)
    return (
      <div className="rounded-xl border border-destructive-border bg-destructive-soft/40 p-5">
        <p className="text-dense text-destructive-text">Não foi possível carregar as semanas.</p>
        <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
          Tentar de novo
        </Button>
      </div>
    );

  if (!ciclo)
    return (
      <div className="rounded-xl border border-dashed border-input p-8 text-center">
        <CalendarRange className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-2 font-display text-card-title font-semibold text-heading">
          Nenhum ciclo cadastrado
        </p>
        <p className="mt-1 text-dense text-muted-foreground">
          As safras pertencem a um ciclo. Crie um período do tipo ciclo em{" "}
          <Link to="/painel" search={{ aba: "periodos" }} className="text-primary underline">
            Painel Admin › Períodos
          </Link>
          .
        </p>
      </div>
    );

  const nome = ciclo.name;
  const proxima: SafraForm = (() => {
    const ultima = doCiclo.reduce<Safra | null>(
      (m, s) => (!m || s.numero > m.numero ? s : m),
      null,
    );
    const inicio = ultima
      ? addDaysISO(ultima.inicio, 7)
      : weekStartISO(ciclo.started_at.slice(0, 10));
    return {
      numero: (ultima?.numero ?? 0) + 1,
      inicio,
      fim: addDaysISO(inicio, 4),
      usa_alocacao: true,
    };
  })();

  function excluir(s: Safra) {
    ask({
      title: `Excluir a ${rotuloSafra(s.numero)} do ${nome}?`,
      desc: `Os contatos criados na semana de ${formatBR(s.inicio)} ficam sem safra até uma nova ser criada nessa semana.`,
      action: "Excluir safra",
      run: async () => {
        await acoes.excluir(s.id);
        toast.success(`${rotuloSafra(s.numero)} excluída`);
      },
    });
  }

  async function salvarEdicao(original: Safra, f: SafraForm) {
    await acoes.editar(original.id, f);
    toast.success(`${rotuloSafra(f.numero)} salva`);
  }

  const outras = (id?: string) => data.safras.filter((s) => s.id !== id);
  const ate = ciclo.closed_at?.slice(0, 10) ?? addDaysISO(weekStartISO(hoje), 21);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-section font-semibold text-heading">Semanas do ciclo</h2>
          <p className="text-dense text-muted-foreground">
            Como o ciclo está dividido e em que fase está cada safra.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="semanas-ciclo" className="text-dense text-muted-foreground">
              Ciclo
            </Label>
            <NativeSelect
              id="semanas-ciclo"
              value={ciclo.id}
              onChange={(e) => setEscolhido(e.target.value)}
            >
              {data.ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === "active" ? " (ativo)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button variant="secondary" onClick={() => setAberto({ tipo: "parametros" })}>
            Configurar dashboard
          </Button>
        </div>
      </div>

      <Section
        title="Calendário de safras"
        hint={`Maturação de ${data.parametros.maturacao_semanas} semanas depois de cada safra. Só safras maduras entram nas comparações e regras.`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAberto({ tipo: "gerar" })}>
              Gerar semanas
            </Button>
            <Button onClick={() => setAberto({ tipo: "nova" })}>Nova safra</Button>
          </div>
        }
      >
        {calendario.linhas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input p-6 text-center">
            <p className="font-semibold text-heading">O {nome} ainda não tem safras</p>
            <p className="mt-1 text-dense text-muted-foreground">
              Use "Gerar semanas" para criar as semanas do ciclo de uma vez.
            </p>
          </div>
        ) : (
          <CalendarioSafras
            calendario={calendario}
            nomeCiclo={nome}
            onEditar={(s) => setAberto({ tipo: "editar", safra: s })}
            onExcluir={excluir}
          />
        )}
      </Section>

      <AlocacaoSemana periodId={ciclo.id} ask={ask} />

      <MetasCicloCard
        nomeCiclo={nome}
        metas={data.metas[ciclo.id] ?? METAS_CICLO_VAZIAS}
        onEditar={() => setAberto({ tipo: "metas" })}
      />

      <TestesAbCard periodId={ciclo.id} ask={ask} />

      {aberto?.tipo === "nova" && (
        <SafraDialog
          periodId={ciclo.id}
          inicial={proxima}
          editando={null}
          outras={outras()}
          onSalvar={async (f) => {
            await acoes.criar(ciclo.id, f);
            toast.success(`${rotuloSafra(f.numero)} criada`);
          }}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "editar" && (
        <SafraDialog
          periodId={ciclo.id}
          inicial={{
            numero: aberto.safra.numero,
            inicio: aberto.safra.inicio,
            fim: aberto.safra.fim,
            usa_alocacao: aberto.safra.usa_alocacao,
          }}
          editando={aberto.safra}
          outras={outras(aberto.safra.id)}
          onSalvar={(f) => salvarEdicao(aberto.safra, f)}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "gerar" && (
        <GerarSemanasDialog
          periodId={ciclo.id}
          nomeCiclo={nome}
          inicioPadrao={proxima.inicio}
          atePadrao={ate < proxima.inicio ? addDaysISO(proxima.inicio, 4) : ate}
          safras={data.safras}
          onGerar={async (inicio, fim) => {
            const n = await acoes.gerar(ciclo.id, inicio, fim);
            toast.success(n === 1 ? "1 safra criada" : `${n} safras criadas`);
            return n;
          }}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "metas" && (
        <MetasCicloDialog
          nomeCiclo={nome}
          inicial={data.metas[ciclo.id] ?? METAS_CICLO_VAZIAS}
          onSalvar={async (m) => {
            await acoes.salvarMetas(ciclo.id, m);
            toast.success("Metas do ciclo salvas");
          }}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "parametros" && (
        <ParametrosDialog
          inicial={data.parametros}
          onSalvar={async (p) => {
            await acoes.salvarParametros(p);
            toast.success("Parâmetros salvos");
          }}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}
