import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AtEventoTipo, AtRow, novaAtLinha, eventoLinha, PessoaTime } from "@/lib/ats";
import { fetchAll } from "@/lib/fetch-all";

/** Todas as ATs (leitura liberada a todo logado). */
export function useAts() {
  return useQuery({
    queryKey: ["ats"],
    queryFn: async (): Promise<AtRow[]> => {
      const data = await fetchAll((a, b) =>
        supabase.from("ats").select("*").order("registrada_em").order("id").range(a, b),
      );
      return data as AtRow[];
    },
  });
}

export type AtEventoLinha = {
  id: string;
  at_id: string;
  evento: AtEventoTipo;
  ocorrido_em: string;
  created_at: string;
  horario_anterior: string | null;
  horario_novo: string | null;
  motivo: string | null;
  origem: string;
  pipedrive_stage_id: number | null;
};

/** Log de todas as ATs: conta remarcações na tabela e mostra a linha do tempo de cada uma. */
export function useAtEventos() {
  return useQuery({
    queryKey: ["at_eventos"],
    queryFn: async (): Promise<AtEventoLinha[]> => {
      const data = await fetchAll((a, b) =>
        supabase
          .from("at_eventos")
          .select(
            "id, at_id, evento, ocorrido_em, created_at, horario_anterior, horario_novo, motivo, origem, pipedrive_stage_id",
          )
          .order("ocorrido_em")
          .order("created_at")
          .range(a, b),
      );
      return data as AtEventoLinha[];
    },
  });
}

export type MembroTime = PessoaTime & { user_id: string | null };

/** Time comercial (hunters e CNs) para filtros, o @ da ficha e o login do hunter logado. */
export function useTimeComercial() {
  return useQuery({
    queryKey: ["time_comercial"],
    queryFn: async (): Promise<MembroTime[]> => {
      const { data, error } = await supabase
        .from("time_comercial")
        .select("login, nome, papel, apelidos, ativo, user_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as MembroTime[];
    },
  });
}

const invalidar = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ["ats"] }),
    qc.invalidateQueries({ queryKey: ["at_eventos"] }),
  ]);

/** Registra uma AT do hunter logado; o banco carimba status, registro e o evento "marcada". */
export function useRegistrarAt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: ReturnType<typeof novaAtLinha>) => {
      // agendada_atual é NOT NULL sem default, mas o trigger ats_before_insert a preenche com a
      // original, e o hunter nem tem grant nessa coluna: ela não pode ir no corpo do insert.
      const insert = row as typeof row & { agendada_atual: string };
      const { error } = await supabase.from("ats").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Registra remarcação, no-show, realizada ou cancelada numa AT sem card no Pipedrive. */
export function useRegistrarEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: ReturnType<typeof eventoLinha>) => {
      const { error } = await supabase.from("at_eventos").insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
