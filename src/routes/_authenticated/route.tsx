import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { painelIsAdmin } from "@/lib/painel.functions";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { useAlertasAltos } from "@/hooks/useDashboard";
import { useContacts, usePeriods, useHolidays, useSettings } from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, todayISO } from "@/lib/cadencia";
import { buildQueues, dayProgress, hackathonPeriods, splitHackathon } from "@/lib/fila";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdminFn = useServerFn(painelIsAdmin);
  const { data: adm } = useQuery({
    queryKey: ["painel_admin"],
    queryFn: () => isAdminFn(),
    staleTime: Infinity,
  });
  const pendingToday = usePendingToday();
  const alertasAltos = useAlertasAltos(!!adm?.admin);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        email={user.email ?? ""}
        isAdmin={!!adm?.admin}
        pendingToday={pendingToday}
        alertasAltos={alertasAltos}
        onSignOut={signOut}
      />
      <main className="ml-58 px-10 py-8">
        <div className="mx-auto max-w-[1120px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** Leads com envio pendente hoje (contador da navegação; mesma conta da barra de progresso). */
function usePendingToday(): number | undefined {
  const { data: allContacts } = useContacts();
  const { data: periods } = usePeriods();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  return useMemo(() => {
    if (!allContacts || !periods) return undefined;
    // O Hackathon encerrado fica fora das filas (e do contador) até o hunter pedir para vê-lo.
    const { current: contacts } = splitHackathon(allContacts, hackathonPeriods(periods));
    const ref = todayISO();
    const queues = buildQueues(contacts, settings ?? DEFAULT_OFFSETS, holidays, ref);
    return dayProgress(contacts, queues, ref).pending;
  }, [allContacts, periods, settings, holidays]);
}
