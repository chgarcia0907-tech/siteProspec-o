import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AtDetalheDialog } from "@/components/ats/AtDetalheDialog";
import { AtsFiltros } from "@/components/ats/AtsFiltros";
import { AtsResumo } from "@/components/ats/AtsResumo";
import { AtsTabela } from "@/components/ats/AtsTabela";
import { RegistrarAtButton } from "@/components/ats/RegistrarAtDialog";
import { TablePagination } from "@/components/TablePagination";
import { useAtEventos, useAts, useTimeComercial } from "@/hooks/useAts";
import { useContacts } from "@/hooks/useCadencia";
import {
  contarAts,
  filtrarAts,
  FILTROS_VAZIOS,
  linhasDaTabela,
  loginDoUsuario,
  podeRegistrarEvento,
  type AtFiltros,
} from "@/lib/ats";
import { paginate } from "@/lib/paginate";
import { painelIsAdmin } from "@/lib/painel.functions";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/ats")({
  head: () => ({
    meta: [
      { title: "ATs — Outbound NTec" },
      {
        name: "description",
        content: "Registro das ATs da equipe, com remarcações, no-show e desfecho de cada uma.",
      },
      { property: "og:title", content: "ATs — Outbound NTec" },
      {
        property: "og:description",
        content: "Registro das ATs da equipe, com remarcações, no-show e desfecho de cada uma.",
      },
    ],
  }),
  component: Ats,
});

function Ats() {
  const { user } = Route.useRouteContext();
  const { data: ats, isLoading } = useAts();
  const { data: eventos } = useAtEventos();
  const { data: time } = useTimeComercial();
  const { data: contatos } = useContacts();
  const isAdminFn = useServerFn(painelIsAdmin);
  const { data: adm } = useQuery({
    queryKey: ["painel_admin"],
    queryFn: () => isAdminFn(),
    staleTime: Infinity,
  });
  const [filtros, setFiltros] = useState<AtFiltros>(FILTROS_VAZIOS);
  const [page, setPage] = useState(0);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const linhas = useMemo(() => linhasDaTabela(ats ?? [], eventos ?? []), [ats, eventos]);
  const filtradas = useMemo(() => filtrarAts(linhas, filtros), [linhas, filtros]);
  const contagem = useMemo(() => contarAts(filtradas), [filtradas]);
  const paged = paginate(filtradas, page, PAGE_SIZE);
  const nomes = useMemo(() => new Map((time ?? []).map((p) => [p.login, p.nome])), [time]);
  const nomeDe = (login: string | null) => (login ? (nomes.get(login) ?? login) : "—");
  const aberta = linhas.find((a) => a.id === abertaId) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {linhas.length === 1 ? "1 AT registrada" : `${linhas.length} ATs registradas`}
          </p>
          <h1 className="mt-1 text-title font-bold">ATs</h1>
          <p className="mt-2 max-w-3xl text-body text-muted-foreground">
            Todas as ATs da equipe, com remarcações, no-show e desfecho. Quando a AT tem card no
            Pipedrive, a situação vem de lá.
          </p>
        </div>
        <RegistrarAtButton
          userId={user.id}
          hunterLogin={loginDoUsuario(user.id, user.email, time ?? [])}
          time={time ?? []}
          contatos={contatos ?? []}
        />
      </header>

      <AtsResumo c={contagem} />
      <AtsFiltros
        filtros={filtros}
        onChange={(f) => {
          setFiltros(f);
          setPage(0);
        }}
        time={time ?? []}
      />
      <AtsTabela
        linhas={paged.pageRows}
        isLoading={isLoading}
        nomeDe={nomeDe}
        onAbrir={setAbertaId}
      />
      <TablePagination paged={paged} onPage={setPage} noun="ATs" />

      <AtDetalheDialog
        at={aberta}
        eventos={eventos ?? []}
        nomeDe={nomeDe}
        podeAgir={!!aberta && podeRegistrarEvento(aberta, user.id, !!adm?.admin)}
        onClose={() => setAbertaId(null)}
      />
    </div>
  );
}
