import { CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useSectorTree } from "@/hooks/useCadencia";
import { useDashHunters, useSemanas } from "@/hooks/useDashboard";
import { formatBR, spParts } from "@/lib/cadencia";
import { cicloPadrao, rotuloSafra, semanaPadrao } from "@/lib/safras";
import { CalorSemana, Dispersoes, ParticipacaoAts } from "./Equipe";
import { DisciplinaTabela } from "./DisciplinaTabela";
import { FichaHunter } from "./FichaHunter";
import { ErroCarga } from "../shared";

const ddmm = (iso: string) => formatBR(iso).slice(0, 5);

/**
 * Aba Hunters (Módulo 2): cada hunter está prospectando, rodando a cadência e isso vira AT?
 * Semana e ficha aberta ficam na URL.
 */
export function HuntersTab({
  semana: semanaBusca,
  ficha,
  onBusca,
}: {
  semana: string | undefined;
  ficha: string | undefined;
  onBusca: (b: { semana?: string | undefined; ficha?: string | undefined }) => void;
}) {
  const hoje = spParts().iso;
  const semanas = useSemanas();
  const setores = useSectorTree();
  const [cicloId, setCicloId] = useState<string | null>(null);
  const ciclo = semanas.data
    ? (semanas.data.ciclos.find((c) => c.id === cicloId) ?? cicloPadrao(semanas.data.ciclos))
    : null;
  const safras = (semanas.data?.safras ?? [])
    .filter((s) => s.period_id === ciclo?.id)
    .sort((a, b) => a.numero - b.numero);
  const semana =
    (semanaBusca && safras.some((s) => s.inicio === semanaBusca) ? semanaBusca : null) ??
    semanaPadrao(safras, hoje);
  const dados = useDashHunters(ciclo && semana ? ciclo.id : null, semana ?? "");

  // Ficha aberta: rola até ela.
  useEffect(() => {
    if (ficha && dados.data) document.getElementById("ficha")?.scrollIntoView({ block: "start" });
  }, [ficha, dados.data]);

  if (semanas.isLoading)
    return <p className="text-dense text-muted-foreground">Carregando hunters…</p>;
  if (semanas.error)
    return (
      <ErroCarga oQue="os ciclos" erro={semanas.error} onRetry={() => void semanas.refetch()} />
    );
  if (!ciclo || safras.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-input p-8 text-center">
        <CalendarRange className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-2 font-display text-card-title font-semibold text-heading">
          Nenhuma safra no ciclo
        </p>
        <p className="mt-1 text-dense text-muted-foreground">
          Crie as semanas do ciclo na aba Semanas para acompanhar os hunters.
        </p>
      </div>
    );

  const d = dados.data;
  const aberto = d && ficha ? d.hunters.find((h) => h.id === ficha) : undefined;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-section font-semibold text-heading">Hunters</h2>
          <p className="text-dense text-muted-foreground">
            Cada hunter está prospectando, rodando a cadência e isso vira AT?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="hunters-ciclo" className="text-dense text-muted-foreground">
              Ciclo
            </Label>
            <NativeSelect
              id="hunters-ciclo"
              value={ciclo.id}
              onChange={(e) => {
                setCicloId(e.target.value);
                onBusca({ semana: undefined, ficha: undefined });
              }}
            >
              {semanas.data!.ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === "active" ? " (ativo)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="hunters-semana" className="text-dense text-muted-foreground">
              Semana
            </Label>
            <NativeSelect
              id="hunters-semana"
              className="w-56"
              value={semana ?? ""}
              onChange={(e) => onBusca({ semana: e.target.value, ficha })}
            >
              {safras.map((s) => (
                <option key={s.id} value={s.inicio}>
                  {rotuloSafra(s.numero)} · {ddmm(s.inicio)} a {ddmm(s.fim)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>

      {dados.isLoading || !d ? (
        dados.error ? (
          <ErroCarga oQue="os hunters" erro={dados.error} onRetry={() => void dados.refetch()} />
        ) : (
          <p className="text-dense text-muted-foreground">Carregando hunters…</p>
        )
      ) : d.hunters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input p-6 text-center text-dense text-muted-foreground">
          O ciclo ainda não tem membros. Adicione os hunters em Painel Admin › Períodos.
        </p>
      ) : (
        <>
          <DisciplinaTabela
            d={d}
            setores={setores.data ?? []}
            onAbrir={(id) => onBusca({ semana: semana ?? undefined, ficha: id })}
          />
          {aberto && (
            <FichaHunter
              d={d}
              h={aberto}
              setores={setores.data ?? []}
              onFechar={() => onBusca({ semana: semana ?? undefined, ficha: undefined })}
              onAbrir={(id) => onBusca({ semana: semana ?? undefined, ficha: id })}
            />
          )}
          <div className="grid gap-6 xl:grid-cols-2">
            <CalorSemana d={d} />
            <ParticipacaoAts d={d} />
          </div>
          <Dispersoes d={d} />
        </>
      )}
    </div>
  );
}
