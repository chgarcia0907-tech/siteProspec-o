import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { TasksLista } from "@/components/tasks/TasksLista";
import { TasksPorHunter } from "@/components/tasks/TasksPorHunter";
import { TasksResumo } from "@/components/tasks/TasksResumo";
import { Button } from "@/components/ui/button";
import { useTimeComercial } from "@/hooks/useAts";
import { useTasksPipedrive } from "@/hooks/useTasks";
import { todayISO } from "@/lib/cadencia";
import { NOME_ETAPA_TASKS, resumoTasks, SEM_HUNTER, type EtapaTasks } from "@/lib/tasksHunter";
import { cn, errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Outbound NTec" },
      {
        name: "description",
        content: "Tasks do Pipedrive dos cards em AT Diag. Agendada e Realizada, por hunter.",
      },
      { property: "og:title", content: "Tasks — Outbound NTec" },
      {
        property: "og:description",
        content: "Tasks do Pipedrive dos cards em AT Diag. Agendada e Realizada, por hunter.",
      },
    ],
  }),
  component: Tasks,
});

type FiltroEtapa = EtapaTasks | "todas";

function Tasks() {
  const { data, isLoading, error, refetch, isFetching } = useTasksPipedrive();
  const { data: time } = useTimeComercial();
  const [etapa, setEtapa] = useState<FiltroEtapa>("todas");
  const [hunter, setHunter] = useState<string | null>(null);

  const nomes = useMemo(() => new Map((time ?? []).map((p) => [p.login, p.nome])), [time]);
  const nomeDe = (login: string) => (login === SEM_HUNTER ? login : (nomes.get(login) ?? login));
  const hoje = todayISO();
  const filtroEtapa = etapa === "todas" ? undefined : etapa;

  const geral = useMemo(
    () => (data ? resumoTasks(data.cards, data.tasks, hoje, filtroEtapa) : null),
    [data, hoje, filtroEtapa],
  );
  const doFiltro = useMemo(
    () =>
      data && hunter
        ? resumoTasks(
            data.cards.filter((c) => c.hunter === hunter),
            data.tasks,
            hoje,
            filtroEtapa,
          )
        : geral,
    [data, hunter, hoje, filtroEtapa, geral],
  );

  const admin = !!data?.admin;
  const atualizado = data
    ? new Date(data.atualizadoEm).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {atualizado ? `Pipedrive · atualizado às ${atualizado}` : "Pipedrive"}
          </p>
          <h1 className="mt-1 text-title font-bold">Tasks</h1>
          <p className="mt-2 max-w-3xl text-body text-muted-foreground">
            {admin
              ? "Tasks dos cards do NTec em AT Diag. Agendada e AT Diag. Realizada, pelo hunter de cada card."
              : "As tasks dos seus cards em AT Diag. Agendada e AT Diag. Realizada."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw aria-hidden className={cn("size-4", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Etapa"
          className="inline-flex rounded-lg border bg-surface-inset p-[3px]"
        >
          {(["todas", 108, 31] as FiltroEtapa[]).map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={etapa === e}
              onClick={() => setEtapa(e)}
              className={cn(
                "h-8 rounded-md px-3 text-dense font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                etapa === e
                  ? "bg-primary-soft text-heading"
                  : "text-muted-foreground hover:text-heading",
              )}
            >
              {e === "todas" ? "As duas etapas" : NOME_ETAPA_TASKS[e]}
            </button>
          ))}
        </div>
        {hunter && (
          <Button variant="ghost" size="sm" onClick={() => setHunter(null)}>
            Mostrando {nomeDe(hunter)} · ver todos
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="rounded-xl border border-dashed border-input p-6 text-muted-foreground">
          Carregando as tasks do Pipedrive…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-destructive-border bg-destructive-soft/40 p-4 text-dense text-destructive-text"
        >
          Não foi possível ler o Pipedrive: {errorMessage(error)}
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {doFiltro && geral && (
        <>
          <TasksResumo c={doFiltro.total} />
          {admin && (
            <TasksPorHunter
              linhas={geral.hunters}
              nomeDe={nomeDe}
              selecionado={hunter}
              onSelecionar={setHunter}
            />
          )}
          {!admin && geral.hunters.length === 0 && (
            <p className="rounded-xl border border-dashed border-input p-6 text-muted-foreground">
              Nenhum card seu nessas etapas. O hunter do card vem do campo “Hunter” no Pipedrive
              {data?.meuLogin ? ` (procurando por ${data.meuLogin})` : ""}.
            </p>
          )}
          <TasksLista tasks={doFiltro.abertas} mostrarHunter={admin && !hunter} nomeDe={nomeDe} />
        </>
      )}
    </div>
  );
}
