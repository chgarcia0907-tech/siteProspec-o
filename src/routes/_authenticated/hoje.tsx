import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DayProgressBar } from "@/components/hoje/DayProgressBar";
import { QueueError, QueueList, QueueLoading } from "@/components/hoje/QueueList";
import { useQueueActions } from "@/components/hoje/useQueueActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, useHolidays, useSettings } from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, STEPS, todayISO } from "@/lib/cadencia";
import { buildQueues, dayProgress, missingForMessage } from "@/lib/fila";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Envios de hoje — Cadência Outbound" },
      {
        name: "description",
        content: "Veja quem precisa receber cada mensagem hoje e quem está atrasado.",
      },
      { property: "og:title", content: "Envios de hoje" },
      {
        property: "og:description",
        content: "Veja quem precisa receber cada mensagem hoje e quem está atrasado.",
      },
    ],
  }),
  component: Hoje,
});

/** "2026-11-12" → "Quinta-feira, 12 de novembro". */
function diaPorExtenso(iso: string): string {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Hoje() {
  const [ref, setRef] = useState(todayISO());
  const [tab, setTab] = useState("1");
  const { data: contacts, isPending, isError, refetch } = useContacts();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const offsets = settings ?? DEFAULT_OFFSETS;
  const actions = useQueueActions(ref);
  const queues = useMemo(
    () => buildQueues(contacts ?? [], offsets, holidays, ref),
    [contacts, offsets, holidays, ref],
  );
  const progress = contacts ? dayProgress(contacts, queues, ref) : undefined;
  const missing = STEPS.reduce(
    (n, step) =>
      n +
      queues[step.n].filter(
        (i) =>
          missingForMessage(i.contact, step, actions.templateFor(i.contact, step)?.body) !== null,
      ).length,
    0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{diaPorExtenso(ref)}</p>
          <h1 className="mt-1 text-title font-bold">Envios de hoje</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data da fila"
            className="w-44"
            value={ref}
            onChange={(e) => setRef(e.target.value || todayISO())}
          />
          <Button variant="secondary" onClick={() => setRef(todayISO())}>
            Hoje
          </Button>
        </div>
      </header>

      <DayProgressBar progress={progress} missing={missing} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {STEPS.map((step) => (
            <TabsTrigger key={step.n} value={String(step.n)} className="gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  step.channel === "linkedin" ? "bg-linkedin" : "bg-whatsapp",
                )}
              />
              {step.label}
              <span className="rounded-full bg-control px-1.5 text-caption font-semibold text-heading tabular-nums">
                {isPending ? "…" : queues[step.n].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {STEPS.map((step) => (
          <TabsContent key={step.n} value={String(step.n)}>
            {isPending ? (
              <QueueLoading />
            ) : isError ? (
              <QueueError onRetry={() => refetch()} />
            ) : (
              <QueueList step={step} items={queues[step.n]} actions={actions} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
