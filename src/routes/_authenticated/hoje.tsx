import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";
import { ContactEditDialog } from "@/components/contatos/ContactEditDialog";
import { DayProgressBar } from "@/components/hoje/DayProgressBar";
import { QueueError, QueueList, QueueLoading } from "@/components/hoje/QueueList";
import { RetomadasList } from "@/components/hoje/RetomadasList";
import { useQueueActions } from "@/components/hoje/useQueueActions";
import { useResponseOrigin } from "@/components/RespostaOrigem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, useHolidays, usePeriods, useSettings } from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, STEPS, todayISO } from "@/lib/cadencia";
import {
  buildQueues,
  dayProgress,
  hackathonPeriods,
  missingForMessage,
  splitHackathon,
} from "@/lib/fila";
import { withSyncedStatus } from "@/lib/contatos";
import { retomadasDoDia } from "@/lib/retomada";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Envios de hoje — Outbound NTec" },
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
  const [showHackathon, setShowHackathon] = useState(false);
  const { data: allContacts, isPending: contactsPending, isError, refetch } = useContacts();
  const periods = usePeriods();
  const isPending = contactsPending || periods.isPending;
  const hackathon = useMemo(() => hackathonPeriods(periods.data), [periods.data]);
  const split = useMemo(
    () => (allContacts ? splitHackathon(allContacts, hackathon) : undefined),
    [allContacts, hackathon],
  );
  const contacts = split && (showHackathon ? allContacts : split.current);
  const hackathonCount = split?.hackathon.length ?? 0;
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const offsets = settings ?? DEFAULT_OFFSETS;
  const actions = useQueueActions(ref);
  const origin = useResponseOrigin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = allContacts?.find((c) => c.id === editingId) ?? null;
  const queues = useMemo(
    () => buildQueues(contacts ?? [], offsets, holidays, ref),
    [contacts, offsets, holidays, ref],
  );
  const progress = contacts ? dayProgress(contacts, queues, ref) : undefined;
  const retomadas = useMemo(() => retomadasDoDia(contacts ?? [], ref), [contacts, ref]);
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

      {hackathonCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface-inset px-4 py-3 text-dense">
          <p className="text-muted-foreground">
            {showHackathon
              ? `Mostrando também ${hackathonCount} ${hackathonCount === 1 ? "contato" : "contatos"} do Hackathon.`
              : `${hackathonCount} ${hackathonCount === 1 ? "contato do Hackathon está" : "contatos do Hackathon estão"} fora das filas.`}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={showHackathon}
            onClick={() => setShowHackathon((v) => !v)}
          >
            {showHackathon ? "Ocultar contatos do Hackathon" : "Mostrar contatos do Hackathon"}
          </Button>
        </div>
      )}

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
          <TabsTrigger value="retomadas" className="gap-2">
            <CalendarClock className="size-3.5" aria-hidden />
            Retomadas
            <span className="rounded-full bg-control px-1.5 text-caption font-semibold text-heading tabular-nums">
              {isPending ? "…" : retomadas.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {STEPS.map((step) => (
          <TabsContent key={step.n} value={String(step.n)}>
            {isPending ? (
              <QueueLoading />
            ) : isError ? (
              <QueueError onRetry={() => refetch()} />
            ) : (
              <QueueList
                step={step}
                items={queues[step.n]}
                actions={actions}
                onEdit={(c) => setEditingId(c.id)}
                hackathonPeriods={hackathon}
              />
            )}
          </TabsContent>
        ))}
        <TabsContent value="retomadas">
          {isPending ? (
            <QueueLoading />
          ) : isError ? (
            <QueueError onRetry={() => refetch()} />
          ) : (
            <RetomadasList
              items={retomadas}
              hoje={ref}
              onPatch={(c, p, msg) => actions.patchContact(c, p, msg)}
            />
          )}
        </TabsContent>
      </Tabs>
      {editing && (
        <ContactEditDialog
          contact={editing}
          offsets={offsets}
          holidays={holidays}
          companies={actions.companies}
          onPatch={(changes) => actions.patchContact(editing, withSyncedStatus(editing, changes))}
          onStatus={(status) =>
            origin.guard(editing, { status }, (p) => actions.patchContact(editing, p))
          }
          onClose={() => setEditingId(null)}
        />
      )}
      {origin.dialog}
    </div>
  );
}
