import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STEPS, addDaysISO, formatBR, todayISO, type StepDef } from "@/lib/cadencia";

type SentKey = `enviadas${StepDef["n"]}`;
type Row = {
  hunter_id: string;
  hunter_name: string;
  importados: number;
  concluidas: number;
  respostas: number;
} & Record<SentKey, number>;

const sentKey = (s: StepDef): SentKey => `enviadas${s.n}`;
const totalSent = (r: Row) => STEPS.reduce((sum, s) => sum + r[sentKey(s)], 0);

const PERIODS = {
  hoje: { label: "Hoje", days: 0 },
  semana: { label: "Semana", days: 6 },
  mes: { label: "Mês", days: 29 },
} as const;

/** Mensagens enviadas por etapa e hunter (função SQL `ranking`), por hoje/semana/mês. */
export function ActivityBoard() {
  const [period, setPeriod] = useState<keyof typeof PERIODS>("hoje");
  const start = addDaysISO(todayISO(), -PERIODS[period].days);

  const { data, isLoading } = useQuery({
    queryKey: ["ranking", start],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("ranking", { period_start: start });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = [...(data ?? [])].sort((a, b) => totalSent(b) - totalSent(a));
  const cols = STEPS.length + 5;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Atividade</h2>
          <p className="text-sm text-muted-foreground">
            Mensagens enviadas por etapa — período a partir de {formatBR(start)}.
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as keyof typeof PERIODS)}>
          <TabsList>
            {Object.entries(PERIODS).map(([key, p]) => (
              <TabsTrigger key={key} value={key}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métricas de atividade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Hunter</TableHead>
                  <TableHead className="text-right">Importados</TableHead>
                  {STEPS.map((s) => (
                    <TableHead key={s.n} className="text-right">
                      {s.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={cols} className="text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={cols} className="text-muted-foreground">
                      Nenhum dado no período.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r, i) => (
                  <TableRow key={r.hunter_id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.hunter_name}</TableCell>
                    <TableCell className="text-right">{r.importados}</TableCell>
                    {STEPS.map((s) => (
                      <TableCell key={s.n} className="text-right">
                        {r[sentKey(s)]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{r.concluidas}</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {r.respostas}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
