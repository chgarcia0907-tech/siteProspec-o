import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { painelIsAdmin } from "@/lib/painel.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/hoje", label: "Envios de hoje" },
  { to: "/contatos", label: "Contatos" },
  { to: "/importar", label: "Importar conexões" },
  { to: "/modelos", label: "Modelos" },
  { to: "/ranking", label: "Ranking" },
  { to: "/configuracoes", label: "Configurações" },
] as const;

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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link to="/hoje" className="text-sm font-bold tracking-tight">
            Cadência <span className="text-linkedin">Outbound</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
            {adm?.admin && (
              <Link
                to="/painel"
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-accent data-[status=active]:bg-accent"
              >
                Painel Admin
              </Link>
            )}
          </nav>
          <span className="hidden text-xs text-muted-foreground md:inline">{user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
