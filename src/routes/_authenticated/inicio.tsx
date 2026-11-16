import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { Atrasados } from "@/components/semana/Atrasados";
import { AtsDaSemana } from "@/components/semana/AtsDaSemana";
import { Conversao } from "@/components/semana/Conversao";
import { EnviosHoje } from "@/components/semana/EnviosHoje";
import { useContacts, useHolidays, usePeriods, useProfile, useSettings } from "@/hooks/useCadencia";
import { addDaysISO, DEFAULT_OFFSETS, todayISO } from "@/lib/cadencia";
import { buildQueues, dayProgress, hackathonPeriods, splitHackathon } from "@/lib/fila";
import { conversion, lateRows, undatedL1, weekOf } from "@/lib/inicio";
import { inicioResumo } from "@/lib/inicio.functions";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Outbound NTec" },
      {
        name: "description",
        content: "As ATs da equipe na semana, os envios de hoje, os atrasados e a sua conversão.",
      },
    ],
  }),
  component: Inicio,
});

/** "2026-11-12" → "Quinta, 12 de novembro · semana de 09 a 15/11". */
function dataDaSemana(today: string, week: { from: string; to: string }): string {
  const d = new Date(`${today}T12:00:00`);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  const mes = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${mes} · semana de ${week.from.slice(8, 10)} a ${week.to.slice(8, 10)}/${week.to.slice(5, 7)}`;
}

function Inicio() {
  const today = todayISO();
  const week = weekOf(today);
  const lastWeek = weekOf(addDaysISO(week.from, -1));
  const { data: profile } = useProfile();
  const { data: contacts } = useContacts();
  const { data: periods } = usePeriods();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const resumoFn = useServerFn(inicioResumo);
  const resumo = useQuery({
    queryKey: ["inicio_resumo", today],
    queryFn: () => resumoFn({ data: { today } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const fila = useMemo(() => {
    if (!contacts || !periods) return undefined;
    // Envios e atrasados ignoram o Hackathon encerrado (como em Envios de hoje).
    const { current } = splitHackathon(contacts, hackathonPeriods(periods));
    const queues = buildQueues(current, settings ?? DEFAULT_OFFSETS, holidays, today);
    return {
      queues,
      progress: dayProgress(current, queues, today),
      late: lateRows(queues, holidays, today),
      undated: undatedL1(queues),
      now: conversion(current, week),
      prev: conversion(current, lastWeek),
    };
    // week e lastWeek derivam de today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, periods, settings, holidays, today]);

  const nome = profile?.display_name?.trim() || profile?.email?.split("@")[0] || "";
  const r = resumo.data;
  const falta = r && r.goal !== null ? r.goal - r.ats.length : null;
  const meta =
    !r || r.goal === null
      ? ""
      : falta! > 0
        ? ` A equipe está a ${falta} ${falta === 1 ? "AT" : "ATs"} da meta.`
        : " A equipe já bateu a meta da semana.";

  return (
    <div className="flex flex-col gap-14 pt-4 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
          <p className="text-body text-muted-foreground">{dataDaSemana(today, week)}</p>
          <h1 className="max-w-[760px] text-hero font-bold">
            Boas-vindas{nome ? `, ${nome}` : ""}.{meta}
          </h1>
        </div>
        <Link
          to="/hoje"
          className="inline-flex h-13 items-center gap-2.5 rounded-md bg-primary px-6 text-body font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:translate-y-px"
        >
          Começar os envios de hoje
          <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden />
        </Link>
      </header>

      <AtsDaSemana
        ats={r?.ats ?? []}
        goal={r?.goal ?? null}
        state={r ? "ok" : resumo.isError ? "error" : "loading"}
        onRetry={() => resumo.refetch()}
      />

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-stretch gap-6">
        <EnviosHoje queues={fila?.queues} progress={fila?.progress} undated={fila?.undated ?? 0} />
        <Atrasados rows={fila?.late} />
      </div>

      <Conversao now={fila?.now} prev={fila?.prev} />
    </div>
  );
}
