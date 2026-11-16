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
import { NativeSelect } from "@/components/ui/native-select";
import { STEPS, addDaysISO, formatBR, todayISO, type StepDef } from "@/lib/cadencia";
import { activeCycleScope, clampStart, onlyCycleMembers } from "@/lib/ranking";

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

/** Ciclo ativo da equipe (membros e início), para recortar as métricas de atividade. */
function useActiveCycle() {
  return useQuery({
    queryKey: ["active-cycle-scope"],
    queryFn: async () => {
      const { data: periods, error } = await supabase
        .from("periods")
        .select("id, status, kind, started_at")
        .eq("status", "active");
      if (error) throw error;
      const cycle = (periods ?? []).find((p) => p.kind === "ciclo");
      if (!cycle) return null;
      const { data: members, error: e2 } = await supabase
        .from("period_members")
        .select("period_id, user_id")
        .eq("period_id", cycle.id);
      if (e2) throw e2;
      return activeCycleScope(periods ?? [], members ?? []);
    },
  });
}

/**
 * Mensagens enviadas por etapa e hunter (função SQL `ranking`), por hoje/semana/mês.
 * Com um ciclo ativo, mostra só os membros dele e só a partir do início do ciclo;
 * "Todos os hunters" mostra o histórico completo (nada é apagado).
 */
export function ActivityBoard() {
  const [period, setPeriod] = useState<keyof typeof PERIODS>("hoje");
  const [todos, setTodos] = useState(false);
  const { data: cycle } = useActiveCycle();
  const scope = todos ? null : (cycle ?? null);
  const start = clampStart(addDaysISO(todayISO(), -PERIODS[period].days), scope);

  const { data, isLoading } = useQuery({
    queryKey: ["ranking", start],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("ranking", { period_start: start });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = onlyCycleMembers(data ?? [], scope).sort((a, b) => totalSent(b) - totalSent(a));
  const cols = STEPS.length + 5;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h2 className="text-section font-semibold">Atividade</h2>
          <p className="text-dense text-muted-foreground">
            Mensagens enviadas por etapa — período a partir de {formatBR(start)}
            {scope ? ", só a equipe do ciclo atual" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cycle && (
            <NativeSelect
              aria-label="Hunters exibidos"
              value={todos ? "todos" : "ciclo"}
              onChange={(e) => setTodos(e.target.value === "todos")}
            >
              <option value="ciclo">Equipe do ciclo</option>
              <option value="todos">Todos os hunters</option>
            </NativeSelect>
          )}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Métricas de atividade</CardTitle>
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
