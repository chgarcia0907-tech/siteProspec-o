import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompetition } from "@/lib/admin.functions";
import { FUNNEL, formatBR } from "@/lib/cadencia";
import { painelSetPeriod } from "@/lib/painel.functions";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Aba "Competição": período da competição geral e placar resumido. */
export function CompTab() {
  const fn = useServerFn(getCompetition);
  const save = useServerFn(painelSetPeriod);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["painel_comp"], queryFn: () => fn() });
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const s = start ?? data?.start ?? "";
  const e = end ?? data?.end ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Período da competição</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ps">Início</Label>
            <Input id="ps" type="date" value={s} onChange={(x) => setStart(x.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe">Fim (opcional)</Label>
            <Input id="pe" type="date" value={e} onChange={(x) => setEnd(x.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={!s}
            onClick={async () => {
              const r = await save({ data: { start: s, end: e || null } });
              if (r.ok) {
                toast.success("Período salvo");
                qc.invalidateQueries();
              } else toast.error("A data de fim deve ser depois do início");
            }}
          >
            Salvar período
          </Button>
          {data?.primeiroAt && (
            <p className="text-xs text-muted-foreground">
              1º AT: {data.primeiroAt.hunter} em {formatBR(data.primeiroAt.data)}
            </p>
          )}
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-md border">
        <table className="table-dense w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {[
                "#",
                "Hunter",
                ...FUNNEL.map((f) => f.abbr),
                "Funil",
                "Bônus",
                "Total",
                "LinkedIn 1",
                "Conversão",
                "Final",
              ].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r, i) => (
              <tr key={r.hunter_id} className={`border-t ${i < 3 ? "font-medium" : ""}`}>
                <td className="p-2">{i + 1}º</td>
                <td className="p-2">{r.hunter}</td>
                {FUNNEL.map((f) => (
                  <td key={f.countKey} className="p-2">
                    {r[f.countKey]}
                  </td>
                ))}
                <td className="p-2">{r.pontos_funil}</td>
                <td className="p-2">{r.bonus_primeiro_at + r.bonus_semanas}</td>
                <td className="p-2">{r.total_pontos}</td>
                <td className="p-2">{r.linkedin1}</td>
                <td className="p-2">{n(r.taxa_conversao)}%</td>
                <td className="p-2 font-semibold">{n(r.pontuacao_final)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!data?.weeks.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Semanas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.weeks.map((w) => (
              <p key={w.inicio}>
                {formatBR(w.inicio)} a {formatBR(w.fim)}
                {w.parcial ? " (parcial)" : ""}: {w.vencedores.join(", ")} — {w.max} ATs
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
