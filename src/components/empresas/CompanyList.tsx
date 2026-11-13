import { toast } from "sonner";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { IndustrySelect } from "@/components/IndustrySelect";
import { InlineInput } from "@/components/InlineInput";
import type { Ask } from "@/components/painel/useConfirm";
import { Button } from "@/components/ui/button";
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
      <p className="text-sm text-muted-foreground">
        Nenhuma empresa cadastrada ainda. Cadastre as empresas que você vai prospectar nesta semana.
      </p>
    );

  return (
    <div className="space-y-6">
      {groupByWeek(companies).map(({ week, companies: list }) => (
        <section key={week} className="space-y-2">
          <h2 className="text-sm font-semibold">
            Semana de {formatBR(week)} a {formatBR(weekEndISO(week))}{" "}
            <span className="font-normal text-muted-foreground">· {list.length} empresas</span>
          </h2>
          <div className="divide-y rounded-lg border bg-card">
            {list.map((c) => {
              const n = contactCount.get(c.id) ?? 0;
              const incompleta = missingSteps(sectorTemplates[c.sector_id], STEPS).length > 0;
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <InlineInput
                    key={c.name}
                    value={c.name}
                    placeholder="Empresa"
                    onCommit={(v) => v && patch(c, { name: v }, "Empresa renomeada")}
                  />
                  <CompanyGenderToggle value={c.gender} onChange={(g) => patch(c, { gender: g })} />
                  <IndustrySelect
                    sectors={sectors}
                    value={c.sector_id}
                    onChange={(id) => patch(c, { sector_id: id }, "Setor atualizado")}
                    className="h-7 w-52 text-xs"
                  />
                  {incompleta && (
                    <span
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      title="Etapas sem mensagem própria do setor usam o modelo padrão"
                    >
                      cadência do setor incompleta
                    </span>
                  )}
                  <span
                    className={
                      n === 0
                        ? "rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {n === 0 ? "sem contatos" : `${n} contato${n === 1 ? "" : "s"}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 text-xs text-destructive"
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
                    Excluir
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
