import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { QueueList } from "@/components/hoje/QueueList";
import { useQueueActions } from "@/components/hoje/useQueueActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, useHolidays, useSettings } from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, STEPS, formatBR, todayISO } from "@/lib/cadencia";
import { buildQueues } from "@/lib/fila";

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

function Hoje() {
  const [ref, setRef] = useState(todayISO());
  const [tab, setTab] = useState("1");
  const { data: contacts } = useContacts();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const offsets = settings ?? DEFAULT_OFFSETS;
  const actions = useQueueActions(ref);
  const queues = useMemo(
    () => buildQueues(contacts ?? [], offsets, holidays, ref),
    [contacts, offsets, holidays, ref],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Envios de hoje</h1>
          <p className="text-sm text-muted-foreground">
            Fila do dia {formatBR(ref)} — atrasados aparecem em vermelho no topo.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            type="date"
            className="w-44"
            value={ref}
            onChange={(e) => setRef(e.target.value || todayISO())}
          />
          <Button variant="outline" onClick={() => setRef(todayISO())}>
            Hoje
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          {STEPS.map((step) => (
            <TabsTrigger key={step.n} value={String(step.n)} className="gap-2">
              {step.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold">
                {queues[step.n].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {STEPS.map((step) => (
          <TabsContent key={step.n} value={String(step.n)} className="mt-4">
            <QueueList step={step} items={queues[step.n]} actions={actions} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
