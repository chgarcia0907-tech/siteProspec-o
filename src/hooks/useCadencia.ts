import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_OFFSETS, type Contact, type Offsets } from "@/lib/cadencia";
import type { manualAtRow } from "@/lib/contatos";
import type { Company, Sector, SectorCadences, SectorTemplates, PersonaKey } from "@/lib/empresas";
import { sortSectors, topSectors } from "@/lib/empresas";
import { groupPatches } from "@/lib/enriquecimento";
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

/** Períodos (leitura liberada a todo logado); a fila usa para separar o Hackathon encerrado. */
export function usePeriods() {
  return useQuery({
    queryKey: ["periods-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("id, name, status, started_at, closed_at, kind")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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

/**
 * Atualiza um contato de forma otimista: a lista em cache muda na hora (ex.: o cartão sai da
 * fila ao marcar o envio) e volta ao estado anterior se a gravação falhar.
 */
export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["contacts"] });
      const previous = qc.getQueryData<Contact[]>(["contacts"]);
      qc.setQueryData<Contact[]>(["contacts"], (list) =>
        list?.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["contacts"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
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

/**
 * Grava alterações diferentes por contato (ex.: preenchimento automático). Alterações iguais
 * viram uma só requisição; os grupos rodam em lotes para não abrir centenas de conexões.
 */
export function useBulkPatchContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; patch: Partial<Contact> }[]): Promise<number> => {
      const jobs = groupPatches(items).flatMap(({ ids, patch }) => {
        const chunks: { ids: string[]; patch: Partial<Contact> }[] = [];
        for (let i = 0; i < ids.length; i += 200)
          chunks.push({ ids: ids.slice(i, i + 200), patch });
        return chunks;
      });
      for (let i = 0; i < jobs.length; i += 6) {
        const results = await Promise.all(
          jobs
            .slice(i, i + 6)
            .map(({ ids, patch }) => supabase.from("contacts").update(patch).in("id", ids)),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
      return items.length;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
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
        /** Empresa em texto livre, quando não há empresa cadastrada vinculada. */
        company?: string;
        company_gender?: Contact["company_gender"];
        /** Área do contato (TI, RH...). */
        sector?: string;
      }[],
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      // `defaultToNull: false`: coluna que falta numa linha usa o padrão do banco, e não NULL
      // (NULL em coluna NOT NULL recusa o lote inteiro).
      const { error } = await supabase.from("contacts").insert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { defaultToNull: false },
      );
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

/** Cadastra um contato à mão (ex.: AT marcada por e-mail), já com o `user_id` do hunter logado. */
export function useAddContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: ReturnType<typeof manualAtRow>) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("contacts")
        .insert({ ...row, user_id: userId }, { defaultToNull: false });
      if (error) throw error;
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

/**
 * Ramos de atuação de primeiro nível cadastrados pelo admin (ativos e inativos), na ordem
 * definida. Subsetores não entram aqui: quem precisa deles usa `useSectorTree`.
 */
export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase.from("sectors").select("*");
      if (error) throw error;
      return topSectors(data ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todos os setores e subsetores (ativos e inativos), na ordem definida; `parent_id` liga o filho. */
export function useSectorTree() {
  return useQuery({
    queryKey: ["sectors", "tree"],
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase.from("sectors").select("*");
      if (error) throw error;
      return sortSectors(data ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Mensagens "qualquer persona" das cadências (setor → etapa → modelo). */
export function useSectorTemplates() {
  return useQuery({
    queryKey: ["sector_templates"],
    queryFn: async (): Promise<SectorTemplates> => {
      const { data, error } = await supabase
        .from("sector_templates")
        .select("sector_id, persona, step, code, body");
      if (error) throw error;
      const map: SectorTemplates = {};
      for (const row of data ?? []) {
        // O filtro fica aqui (e não na consulta) para uma linha sem o campo, como nos dados de teste, valer.
        if ((row.persona ?? "") !== "") continue;
        const step = row.step as 1 | 2 | 3 | 4 | 5;
        (map[row.sector_id] ??= {})[step] = { code: row.code, body: row.body };
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Mensagens de todas as cadências (setor ou subsetor → persona → etapa → modelo). */
export function useSectorCadences() {
  return useQuery({
    queryKey: ["sector_templates", "cadences"],
    queryFn: async (): Promise<SectorCadences> => {
      const { data, error } = await supabase
        .from("sector_templates")
        .select("sector_id, persona, step, code, body");
      if (error) throw error;
      const map: SectorCadences = {};
      for (const row of data ?? []) {
        const step = row.step as 1 | 2 | 3 | 4 | 5;
        const persona = (row.persona ?? "") as PersonaKey;
        ((map[row.sector_id] ??= {})[persona] ??= {})[step] = { code: row.code, body: row.body };
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
      rows: (Pick<Company, "name" | "gender" | "sector_id" | "week_start"> &
        Partial<Pick<Company, "subsector_id">>)[],
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
      patch: Partial<
        Pick<Company, "name" | "gender" | "sector_id" | "subsector_id" | "week_start">
      >;
    }) => {
      // Trocar o setor sem dizer o subsetor limpa o subsetor: o banco recusa um subsetor de outro setor.
      const body =
        "sector_id" in patch && !("subsector_id" in patch)
          ? { ...patch, subsector_id: null }
          : patch;
      const { error } = await supabase.from("companies").update(body).eq("id", id);
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
