import { Link } from "@tanstack/react-router";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: LucideIcon; count?: number | undefined };

/** Navegação lateral fixa (DESIGN.md, seção 6): Prospecção, Referência e Administração. */
export function AppSidebar({
  email,
  isAdmin,
  pendingToday,
  onSignOut,
}: {
  email: string;
  isAdmin: boolean;
  /** Envios previstos para hoje (soma das filas); `undefined` enquanto carrega. */
  pendingToday: number | undefined;
  onSignOut: () => void;
}) {
  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Prospecção",
      items: [
        { to: "/hoje", label: "Envios de hoje", icon: Send, count: pendingToday },
        { to: "/empresas", label: "Empresas", icon: Building2 },
        { to: "/contatos", label: "Contatos", icon: Users },
        { to: "/importar", label: "Importar conexões", icon: Upload },
      ],
    },
    {
      title: "Referência",
      items: [
        { to: "/modelos", label: "Modelos", icon: FileText },
        { to: "/configuracoes", label: "Configurações", icon: Settings },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Administração",
            items: [{ to: "/painel", label: "Painel Admin", icon: LayoutDashboard }],
          },
        ]
      : []),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-58 flex-col border-r bg-sidebar">
      <Link
        to="/hoje"
        className="flex h-16 items-center px-5 font-display text-card-title font-bold text-heading"
      >
        Cadência <span className="ml-1 text-primary">Outbound</span>
      </Link>
      <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-2 text-caption font-bold tracking-wider text-subtle-foreground uppercase">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, count }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-2 text-dense font-semibold text-muted-foreground transition-colors",
                      "hover:bg-control hover:text-heading",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      "data-[status=active]:bg-primary-soft data-[status=active]:text-heading",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {count !== undefined && count > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-caption font-bold text-primary-foreground tabular-nums">
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t px-3 py-3">
        <span className="min-w-0 flex-1 truncate px-2 text-caption text-muted-foreground">
          {email}
        </span>
        <Button variant="ghost" size="sm" onClick={onSignOut} aria-label="Sair">
          <LogOut strokeWidth={1.75} aria-hidden />
          Sair
        </Button>
      </div>
    </aside>
  );
}
