import { sectorPath, type SectorNode } from "@/lib/empresas";
import { num } from "../format";
import { Section } from "../shared";
import { SeloEsforco } from "./shared";
import { taxa, type Dados } from "./format";

/** Visão Equipe: uma linha por hunter com a disciplina da semana contra a meta. */
export function DisciplinaTabela({
  d,
  setores,
  onAbrir,
}: {
  d: Dados;
  setores: readonly SectorNode[];
  onAbrir: (id: string) => void;
}) {
  const parcial = d.hunters.some((h) => h.disciplina.esforco?.parcial);
  return (
    <Section
      title="Disciplina da semana"
      hint="Cada hunter está prospectando e rodando a cadência? Clique no nome para abrir a ficha."
    >
      <div className="overflow-x-auto rounded-xl border">
        <table className="table-dense w-full">
          <caption className="sr-only">Disciplina de cada hunter na semana</caption>
          <thead className="bg-surface-inset">
            <tr>
              {(
                [
                  ["Hunter", "left"],
                  ["Setor alocado", "left"],
                  ["Contatos", "right"],
                  ["Passos", "right"],
                  ["Passos no prazo", "left"],
                  ["Tasks no prazo", "left"],
                  ["Dias ativos", "right"],
                  ["Esforço", "left"],
                  ["ATs", "right"],
                  ["Parados", "right"],
                ] as const
              ).map(([t, lado]) => (
                <th
                  key={t}
                  scope="col"
                  className={lado === "right" ? "px-3 py-2 text-right" : "px-3 py-2 text-left"}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.hunters.map((h) => {
              const p = h.prospeccao;
              const dis = h.disciplina;
              return (
                <tr key={h.id} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <button
                      type="button"
                      className="font-semibold text-heading underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => onAbrir(h.id)}
                    >
                      {h.nome}
                    </button>
                  </th>
                  <td className="px-3 py-2">
                    {p.semMeta ? (
                      <span className="text-muted-foreground">
                        Sem prospecção: {p.alocacao?.motivo_meta_zero}
                      </span>
                    ) : p.alocacao ? (
                      <>
                        {sectorPath(setores, p.alocacao.sector_id, p.alocacao.subsector_id)}
                        {h.dupla && <span className="text-muted-foreground"> · {h.dupla}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {num(p.contatos)}
                    {p.metaContatos !== null && !p.semMeta && (
                      <span className="text-muted-foreground"> de {num(p.metaContatos)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(dis.passos)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {taxa(dis.noPrazo, dis.devidos)}
                  </td>
                  <td
                    className="px-3 py-2 tabular-nums whitespace-nowrap"
                    title={
                      dis.tasks ? undefined : "Sem tasks copiadas do Pipedrive para este hunter"
                    }
                  >
                    {dis.tasks ? taxa(dis.tasks.noPrazo, dis.tasks.devidas) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {dis.diasAtivos} de {dis.diasUteis}
                  </td>
                  <td className="px-3 py-2">
                    <SeloEsforco
                      esforco={dis.esforco}
                      alertaPct={d.esforcoAlertaPct}
                      semMeta={p.semMeta}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(dis.ats)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {h.cadencia.parados.length > 0 ? (
                      <span className="font-semibold text-warning-text">
                        {h.cadencia.parados.length}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-muted-foreground">
        Esforço = (contatos adicionados + passos) ÷ (meta de contatos da alocação + meta semanal de
        passos). Na meta: 100% ou mais; perto: {d.esforcoAlertaPct}% ou mais.
        {parcial && " Semana em andamento: a meta é proporcional aos dias úteis já passados."} Tasks
        no prazo: tasks do Pipedrive dos cards do hunter com prazo na semana (até ontem), concluídas
        até o dia do vencimento. Parados: em cadência, sem resposta e sem envio há mais dias úteis
        que o limite da dashboard.
      </p>
    </Section>
  );
}
