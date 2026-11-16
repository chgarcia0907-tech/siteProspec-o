import { Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { IndustrySelect } from "@/components/IndustrySelect";
import { InlineInput } from "@/components/InlineInput";
import type { Ask } from "@/components/useConfirm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteCompany, useUpdateCompany } from "@/hooks/useCadencia";
import { STEPS, formatBR } from "@/lib/cadencia";
import {
  groupByWeek,
  missingSteps,
  weekEndISO,
  type Company,
  type Sector,
  type SectorTemplates,
} from "@/lib/empresas";
import { errorMessage } from "@/lib/utils";

/** Empresas do hunter agrupadas por semana, com setor e concordância editáveis. */
export function CompanyList({
  companies,
  sectors,
  sectorTemplates,
  contactCount,
  ask,
}: {
  companies: readonly Company[];
  sectors: readonly Sector[];
  sectorTemplates: SectorTemplates;
  contactCount: ReadonlyMap<string, number>;
  ask: Ask;
}) {
  const update = useUpdateCompany();
  const del = useDeleteCompany();
  const patch = (c: Company, p: Parameters<typeof update.mutate>[0]["patch"], msg?: string) =>
    update.mutate(
      { id: c.id, patch: p },
      {
        onSuccess: () => msg && toast.success(msg),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  if (companies.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
        <Building2 className="size-6 text-subtle-foreground" strokeWidth={1.75} aria-hidden />
        <p className="text-card-title font-semibold text-heading">Nenhuma empresa cadastrada</p>
        <p className="text-dense text-muted-foreground">
          Cadastre as empresas que você vai prospectar nesta semana.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      {groupByWeek(companies).map(({ week, companies: list }) => (
        <section key={week} className="space-y-2" aria-label={`Semana de ${formatBR(week)}`}>
          <h2 className="text-card-title font-semibold">
            Semana de {formatBR(week)} a {formatBR(weekEndISO(week))}{" "}
            <span className="text-dense font-normal text-muted-foreground">
              · {list.length} {list.length === 1 ? "empresa" : "empresas"}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa e concordância</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cadência</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => {
                  const n = contactCount.get(c.id) ?? 0;
                  const incompleta = missingSteps(sectorTemplates[c.sector_id], STEPS).length > 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <InlineInput
                            key={c.name}
                            className="h-8 w-36"
                            aria-label={`Nome da empresa ${c.name}`}
                            value={c.name}
                            placeholder="Empresa"
                            onCommit={(v) => v && patch(c, { name: v }, "Empresa renomeada")}
                          />
                          <CompanyGenderToggle
                            value={c.gender}
                            onChange={(g) => patch(c, { gender: g })}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <IndustrySelect
                          sectors={sectors}
                          value={c.sector_id}
                          onChange={(id) => patch(c, { sector_id: id }, "Setor atualizado")}
                          className="h-8 w-36"
                        />
                      </TableCell>
                      <TableCell>
                        {incompleta ? (
                          <span
                            className="inline-block rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text"
                            title="Etapas sem mensagem própria do setor usam o modelo padrão"
                          >
                            cadência do setor incompleta
                          </span>
                        ) : (
                          <span className="text-caption text-success">cadência completa</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {n === 0 ? (
                          <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning-text">
                            sem contatos
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {n === 1 ? "1 contato" : `${n} contatos`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="destructive-ghost"
                          aria-label={`Excluir ${c.name}`}
                          onClick={() =>
                            ask({
                              title: `Excluir ${c.name}?`,
                              desc:
                                n > 0
                                  ? `Os ${n} contatos vinculados continuam cadastrados, mas sem empresa vinculada (voltam ao modelo padrão).`
                                  : "A empresa sai da sua lista.",
                              action: "Excluir",
                              run: () => del.mutateAsync(c.id),
                            })
                          }
                        >
                          <Trash2 strokeWidth={1.75} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  );
}
