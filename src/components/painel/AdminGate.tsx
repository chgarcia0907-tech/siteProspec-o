import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { painelIsAdmin } from "@/lib/painel.functions";

/** Só mostra o conteúdo ao administrador (has_role validado no servidor). */
export function AdminGate({ children }: { children: ReactNode }) {
  const isAdmin = useServerFn(painelIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["painel_admin"], queryFn: () => isAdmin() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.admin)
    return (
      <p className="text-sm text-muted-foreground">
        Acesso restrito ao administrador.{" "}
        <Link to="/hoje" className="underline">
          Voltar
        </Link>
      </p>
    );
  return <>{children}</>;
}
