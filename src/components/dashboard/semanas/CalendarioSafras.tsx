import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBR } from "@/lib/cadencia";
import {
  STATUS_SAFRA_LABEL,
  codigoSafra,
  rotuloSafra,
  type Calendario,
  type CelulaSafra,
  type Safra,
} from "@/lib/safras";
import { cn } from "@/lib/utils";

type Fase = NonNullable<CelulaSafra["fase"]>;

/** Cor de cada fase (DESIGN.md, seção 6c): a prospecção é a única cheia, para saltar à vista. */
const FASE_CLASSE: Record<Fase, string> = {
  em_prospeccao: "bg-primary text-primary-foreground font-semibold",
  em_cadencia: "bg-primary-soft text-heading",
  em_maturacao: "border border-dashed border-input bg-surface-inset text-muted-foreground",
  madura: "bg-success-soft text-success",
};
const FASE_CURTA: Record<Fase, string> = {
  em_prospeccao: "Prospecção",
  em_cadencia: "Cadência",
  em_maturacao: "Maturação",
  madura: "Madura",
};
const LEGENDA: Fase[] = ["em_prospeccao", "em_cadencia", "em_maturacao", "madura"];

const ddmm = (iso: string) => formatBR(iso).slice(0, 5);

/** Calendário em escada: safras nas linhas, semanas nas colunas, fase em cada célula. */
export function CalendarioSafras({
  calendario,
  nomeCiclo,
  onEditar,
  onExcluir,
}: {
  calendario: Calendario<Safra>;
  nomeCiclo: string;
  onEditar: (s: Safra) => void;
  onExcluir: (s: Safra) => void;
}) {
  const { semanas, semanaAtual, linhas } = calendario;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="table-dense w-full">
          <caption className="sr-only">
            Fase de cada safra do ciclo {nomeCiclo} em cada semana
          </caption>
          <thead className="bg-surface-inset">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Safra
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Situação hoje
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Alocação
              </th>
              {semanas.map((s) => {
                const hoje = s === semanaAtual;
                return (
                  <th
                    key={s}
                    scope="col"
                    className={cn(
                      "px-1 py-2 text-center text-caption font-semibold tabular-nums",
                      hoje ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-current={hoje ? "date" : undefined}
                  >
                    {ddmm(s)}
                    {hoje && <span className="block font-bold">hoje</span>}
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ safra, status, celulas }) => {
              const codigo = codigoSafra(nomeCiclo, safra.numero);
              return (
                <tr key={safra.id} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block font-semibold text-heading">{codigo}</span>
                    <span className="text-caption text-muted-foreground tabular-nums">
                      {ddmm(safra.inicio)} a {ddmm(safra.fim)}
                    </span>
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap">{STATUS_SAFRA_LABEL[status]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {safra.usa_alocacao ? "Usa" : "Não usa"}
                  </td>
                  {celulas.map((c) => (
                    <td
                      key={c.semana}
                      className={cn("px-0.5 py-1.5", c.semana === semanaAtual && "bg-primary/5")}
                    >
                      {c.fase && (
                        <span
                          className={cn(
                            "block rounded-sm px-1 py-1 text-center text-caption whitespace-nowrap",
                            FASE_CLASSE[c.fase],
                            c.futura && "opacity-80",
                          )}
                          title={`${codigo} na semana de ${formatBR(c.semana)}: ${STATUS_SAFRA_LABEL[c.fase]}${c.futura ? " (previsto)" : ""}`}
                        >
                          {FASE_CURTA[c.fase]}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Editar ${rotuloSafra(safra.numero)}`}
                      onClick={() => onEditar(safra)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="destructive-ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Excluir ${rotuloSafra(safra.numero)}`}
                      onClick={() => onExcluir(safra)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
        <span>Legenda:</span>
        {LEGENDA.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block size-3 rounded-sm", FASE_CLASSE[f])} aria-hidden />
            {STATUS_SAFRA_LABEL[f]}
          </span>
        ))}
        <span>Semanas depois de hoje aparecem esmaecidas (fase prevista).</span>
      </p>
    </div>
  );
}
