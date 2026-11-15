import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_OFFSETS, type Contact, type Offsets } from "@/lib/cadencia";
import type { Company, Sector, SectorTemplates } from "@/lib/empresas";
import { sortSectors } from "@/lib/empresas";
import { fetchAll } from "@/lib/fetch-all";

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async (): Promise<Contact[]> => {
      const data = await fetchAll((a, b) =>
        supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      );
      return data as unknown as Contact[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Offsets> => {
      const { data, error } = await supabase
        .from("settings")
        .select("offset1, offset2, offset3, offset4, offset5")
        .maybeSingle();
      if (error) throw error;
      return (data as Offsets | null) ?? DEFAULT_OFFSETS;
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offsets: Offsets) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("settings")
        .upsert({ user_id: userId, ...offsets }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["message_templates"],
    queryFn: async (): Promise<Record<number, { code: string; body: string }>> => {
      const { data, error } = await supabase.from("message_templates").select("step, code, body");
      if (error) throw error;
      const map: Record<number, { code: string; body: string }> = {};
      for (const row of data ?? []) map[row.step] = { code: row.code, body: row.body };
      return map;
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, message_name, email, gender")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveDisplayName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, display_name: name.trim(), email: auth.user?.email ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSaveMessageName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("profiles")
        .update({ message_name: name.trim() || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Contact> }) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("contacts").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: {
        name: string;
        headline: string;
        job_title: string;
        connected_at: string | null;
        company_id: string | null;
      }[],
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("contacts")
        .insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useSaveGender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gender: "m" | "f") => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("profiles").update({ gender }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useCompetitionSettings() {
  return useQuery({
    queryKey: ["competition_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_settings")
        .select("start_date, end_date")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? { start_date: "2026-10-01", end_date: null };
    },
  });
}

export type HolidayRow = { date: string; name: string };

export function useHolidayList() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: async (): Promise<HolidayRow[]> => {
      const { data, error } = await supabase.from("holidays").select("date, name").order("date");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Feriados como conjunto de datas, para os cálculos de dias úteis. */
export function useHolidays(): ReadonlySet<string> {
  const { data } = useHolidayList();
  return useMemo(() => new Set((data ?? []).map((h) => h.date)), [data]);
}

/** Ramos de atuação cadastrados pelo admin (ativos e inativos), na ordem definida. */
export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase.from("sectors").select("*");
      if (error) throw error;
      return sortSectors(data ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Mensagens das cadências por setor (setor → etapa → modelo). */
export function useSectorTemplates() {
  return useQuery({
    queryKey: ["sector_templates"],
    queryFn: async (): Promise<SectorTemplates> => {
      const { data, error } = await supabase
        .from("sector_templates")
        .select("sector_id, step, code, body");
      if (error) throw error;
      const map: SectorTemplates = {};
      for (const row of data ?? []) {
        const step = row.step as 1 | 2 | 3 | 4 | 5;
        (map[row.sector_id] ??= {})[step] = { code: row.code, body: row.body };
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Empresas do hunter logado (RLS), mais recentes primeiro. */
export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async (): Promise<Company[]> => {
      const data = await fetchAll((a, b) =>
        supabase
          .from("companies")
          .select("*")
          .order("week_start", { ascending: false })
          .order("id")
          .range(a, b),
      );
      return data as unknown as Company[];
    },
  });
}

export function useAddCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Pick<Company, "name" | "gender" | "sector_id" | "week_start">[],
    ): Promise<number> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      if (rows.length === 0) return 0;
      const { error } = await supabase
        .from("companies")
        .insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (error) {
        if (error.code === "23505") throw new Error("Essa empresa já está cadastrada");
        throw error;
      }
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Company, "name" | "gender" | "sector_id" | "week_start">>;
    }) => {
      const { error } = await supabase.from("companies").update(patch).eq("id", id);
      if (error) {
        if (error.code === "23505") throw new Error("Já existe outra empresa com esse nome");
        throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      // Nome e concordância são copiados para os contatos vinculados.
      if (v.patch.name !== undefined || v.patch.gender !== undefined)
        qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
