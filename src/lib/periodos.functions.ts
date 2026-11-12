// Ações administrativas de Períodos, Grupos, Membros, Transferência e Exclusão de hunter.
// Toda função valida has_role(admin) pelo cliente do próprio usuário ANTES de usar o service role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { CompContact } from "./competition";

type Db = SupabaseClient<Database>;
type Ctx = { supabase: Db; userId: string };
const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(80);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso negado");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
function fail(msg: string): never {
  throw new Error(msg);
}

/** Visão completa: períodos, grupos, subgrupos e membros (com nome e nº de contatos no período). */
export const periodsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { fetchAll } = await import("./fetch-all");
    const [periods, groups, subgroups, members, profiles, contacts] = await Promise.all([
      db.from("periods").select("*").order("started_at", { ascending: false }),
      db.from("groups").select("*").order("name"),
      db.from("subgroups").select("*").order("name"),
      fetchAll((a, b) => db.from("period_members").select("*").order("id").range(a, b)),
      fetchAll((a, b) =>
        db.from("profiles").select("id, display_name, email").order("id").range(a, b),
      ),
      fetchAll((a, b) => db.from("contacts").select("user_id, period_id").order("id").range(a, b)),
    ]);
    if (periods.error || groups.error || subgroups.error) fail("Falha ao carregar períodos");
    const names = new Map(
      profiles.map((p) => [p.id, p.display_name?.trim() || p.email || "Hunter"]),
    );
    const count = new Map<string, number>();
    for (const c of contacts) {
      const k = `${c.period_id}|${c.user_id}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return {
      periods: periods.data ?? [],
      groups: groups.data ?? [],
      subgroups: subgroups.data ?? [],
      members: members
        .map((m) => ({
          ...m,
          name: names.get(m.user_id) ?? "Hunter",
          contacts: count.get(`${m.period_id}|${m.user_id}`) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      hunters: profiles
        .map((p) => ({ id: p.id, name: names.get(p.id)!, email: p.email ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    };
  });

// ---------- Períodos ----------

export const createPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ name, start: isoDate, kind: z.enum(["competicao", "ciclo"]).default("competicao") })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: active } = await db
      .from("periods")
      .select("name")
      .eq("status", "active")
      .maybeSingle();
    if (active) fail(`Encerre o período "${active.name}" antes de criar outro.`);
    const { data: row, error } = await db
      .from("periods")
      .insert({
        name: data.name,
        kind: data.kind,
        status: "active",
        started_at: `${data.start}T00:00:00-03:00`,
      })
      .select("id")
      .single();
    if (error)
      fail(
        error.code === "23505"
          ? "Já existe um período com esse nome ou outro período ativo."
          : "Falha ao criar período",
      );
    return { id: row.id as string };
  });

export const renamePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, name }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("periods").update({ name: data.name }).eq("id", data.id);
    if (error)
      fail(error.code === "23505" ? "Já existe um período com esse nome." : "Falha ao renomear");
    return { ok: true };
  });

/**
 * Encerra o período e grava o placar oficial congelado.
 * Exige digitar o nome exato do período. A troca active→closed é condicional (só uma chamada vence)
 * e a constraint única de period_snapshots impede placar duplicado.
 * `end` (opcional) é o último dia que conta no placar, para encerrar depois do fim real; padrão hoje.
 */
export const closePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, confirmName: z.string(), end: isoDate.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { fetchAll } = await import("./fetch-all");
    const { computeCompetition } = await import("./competition");
    const { spParts } = await import("./cadencia");

    const { data: p } = await db.from("periods").select("*").eq("id", data.id).maybeSingle();
    if (!p) fail("Período não encontrado");
    if (p.status !== "active") fail("Este período já foi encerrado.");
    if (data.confirmName.trim() !== p.name) fail("O nome digitado não confere.");

    const today = spParts().iso;
    const start = new Date(p.started_at).toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    const end = data.end ?? today;
    if (end > today) fail("A data de fim não pode ser no futuro.");
    if (end < start) fail("A data de fim é anterior ao início do período.");
    const ciclo = p.kind === "ciclo";
    const [contacts, members, profiles, groups, subgroups] = await Promise.all([
      fetchAll((a, b) => {
        let q = db
          .from("contacts")
          .select(
            "user_id, sent1_at, sent2_at, sent3_at, sent4_at, sent5_at, at_marcada_em, lead_em, proposta_em, aprovacao_em, vendido_em, at_registrado_em, lead_registrado_em, proposta_registrado_em, aprovacao_registrado_em, vendido_registrado_em, created_at",
          );
        if (!ciclo) q = q.eq("period_id", p.id);
        return q.order("id").range(a, b);
      }),
      fetchAll((a, b) =>
        db.from("period_members").select("*").eq("period_id", p.id).order("id").range(a, b),
      ),
      fetchAll((a, b) =>
        db.from("profiles").select("id, display_name, email").order("id").range(a, b),
      ),
      db.from("groups").select("id, name").eq("period_id", p.id),
      db.from("subgroups").select("id, name, group_id"),
    ]);
    const pname = new Map(
      profiles.map((x) => [x.id, x.display_name?.trim() || x.email || "Hunter"]),
    );
    const gname = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
    const sname = new Map((subgroups.data ?? []).map((s) => [s.id, s.name]));
    const mem = new Map(members.map((m) => [m.user_id, m]));
    // Participantes = membros do período + quem tem contatos nele (nenhum resultado fica de fora).
    // No ciclo, só os membros participam (os contatos são de toda a base deles).
    const ids = new Set<string>(members.map((m) => m.user_id));
    if (!ciclo) for (const c of contacts) ids.add(c.user_id);
    const hunters = [...ids].map((id) => ({ id, name: pname.get(id) ?? "Hunter" }));
    const result = computeCompetition(contacts as CompContact[], hunters, { start, end }, today);

    const frozen = new Date().toISOString();
    // Contagens do placar só dentro do período (data em SP), como os pontos.
    const spDay = (v: string | null | undefined) =>
      v
        ? /^\d{4}-\d{2}-\d{2}$/.test(v)
          ? v
          : new Date(v).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
        : null;
    const inRange = (v: string | null | undefined) => {
      const d = spDay(v);
      return !!d && d <= end && (!ciclo || d >= start);
    };
    const rows = result.rows.map((r) => {
      const m = mem.get(r.hunter_id);
      const mine = contacts.filter(
        (c) => c.user_id === r.hunter_id && (ciclo || inRange(c.created_at)),
      );
      const n = (f: "sent1_at" | "sent2_at" | "sent3_at" | "sent4_at" | "sent5_at") =>
        mine.filter((c) => inRange(c[f])).length;
      return {
        period_id: p.id,
        hunter_id: r.hunter_id,
        hunter_name: r.hunter,
        group_name: (m?.group_id && gname.get(m.group_id)) || "",
        subgroup_name: (m?.subgroup_id && sname.get(m.subgroup_id)) || "",
        points: r.pontuacao_final,
        contacts_count: mine.length,
        sent1: n("sent1_at"),
        sent2: n("sent2_at"),
        sent3: n("sent3_at"),
        sent4: n("sent4_at"),
        sent5: n("sent5_at"),
        ats_count: r.ats,
        leads_count: r.leads,
        propostas_count: r.propostas,
        aprovacoes_count: r.aprovacoes,
        vendas_count: r.vendidos,
        weekly_wins: r.semanas_vencidas,
        first_at_bonus: r.bonus_primeiro_at > 0,
        extra: {
          total_pontos: r.total_pontos,
          pontos_funil: r.pontos_funil,
          bonus_semanas: r.bonus_semanas,
          taxa_conversao: r.taxa_conversao,
          linkedin1: r.linkedin1,
          inicio: start,
          fim: end,
          semanas: result.weeks,
          primeiro_at: result.primeiroAt,
        },
        frozen_at: frozen,
      };
    });

    // Trava atômica: só uma chamada consegue mudar active → closed.
    // closed_at = último dia que conta (fim do dia em SP); a "maturação atual" usa essa data.
    const closedAt = data.end ? `${end}T23:59:59-03:00` : frozen;
    const { data: claimed } = await db
      .from("periods")
      .update({ status: "closed", closed_at: closedAt })
      .eq("id", p.id)
      .eq("status", "active")
      .select("id");
    if (!claimed?.length) fail("Este período já foi encerrado.");
    if (rows.length) {
      const { error } = await db.from("period_snapshots").insert(rows);
      if (error) {
        await db.from("period_snapshots").delete().eq("period_id", p.id);
        await db.from("periods").update({ status: "active", closed_at: null }).eq("id", p.id);
        fail("Falha ao gravar o placar. Nada foi encerrado; tente novamente.");
      }
    }
    return { hunters: rows.length };
  });

// ---------- Grupos e subgrupos ----------

export const saveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid.optional(), periodId: uuid, name }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const q = data.id
      ? db
          .from("groups")
          .update({ name: data.name })
          .eq("id", data.id)
          .eq("period_id", data.periodId)
      : db.from("groups").insert({ period_id: data.periodId, name: data.name });
    const { error } = await q;
    if (error)
      fail(
        error.code === "23505"
          ? "Já existe um grupo com esse nome neste período."
          : "Falha ao salvar grupo",
      );
    return { ok: true };
  });

export const saveSubgroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid.optional(), groupId: uuid, name }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const q = data.id
      ? db
          .from("subgroups")
          .update({ name: data.name })
          .eq("id", data.id)
          .eq("group_id", data.groupId)
      : db.from("subgroups").insert({ group_id: data.groupId, name: data.name });
    const { error } = await q;
    if (error)
      fail(
        error.code === "23505"
          ? "Já existe um subgrupo com esse nome neste grupo."
          : "Falha ao salvar subgrupo",
      );
    return { ok: true };
  });

/** Exclui grupo ou subgrupo. Membros e contatos ficam intactos (voltam para "sem grupo/subgrupo"). */
export const deleteGroupOrSub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["group", "subgroup"]), id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    if (data.kind === "group") {
      // Solta os membros explicitamente antes (grupo e subgrupos dele) para não sobrar subgrupo órfão.
      await db
        .from("period_members")
        .update({ group_id: null, subgroup_id: null })
        .eq("group_id", data.id);
      const { error } = await db.from("groups").delete().eq("id", data.id);
      if (error) fail("Falha ao excluir grupo");
    } else {
      const { error } = await db.from("subgroups").delete().eq("id", data.id);
      if (error) fail("Falha ao excluir subgrupo");
    }
    return { ok: true };
  });

// ---------- Membros ----------

async function validAllocation(
  db: Db,
  periodId: string,
  groupId: string | null,
  subgroupId: string | null,
) {
  if (subgroupId && !groupId) fail("Escolha o grupo antes do subgrupo.");
  if (groupId) {
    const { data: g } = await db
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .eq("period_id", periodId)
      .maybeSingle();
    if (!g) fail("Grupo não pertence a este período.");
  }
  if (subgroupId && groupId) {
    const { data: s } = await db
      .from("subgroups")
      .select("id")
      .eq("id", subgroupId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (!s) fail("Subgrupo não pertence a este grupo.");
  }
}

/** Adiciona vários membros a um período (e opcionalmente a um grupo/subgrupo) de uma vez. */
export const addMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        periodId: uuid,
        userIds: z.array(uuid).min(1).max(2000),
        groupId: uuid.nullable(),
        subgroupId: uuid.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    await validAllocation(db, data.periodId, data.groupId, data.subgroupId);
    const rows = data.userIds.map((u) => ({
      period_id: data.periodId,
      user_id: u,
      group_id: data.groupId,
      subgroup_id: data.subgroupId,
    }));
    const { error } = await db
      .from("period_members")
      .upsert(rows, { onConflict: "period_id,user_id" });
    if (error) fail("Falha ao adicionar membros");
    return { added: rows.length };
  });

/** Define grupo/subgrupo de um ou vários membros já no período. */
export const allocateMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        periodId: uuid,
        userIds: z.array(uuid).min(1).max(2000),
        groupId: uuid.nullable(),
        subgroupId: uuid.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    await validAllocation(db, data.periodId, data.groupId, data.subgroupId);
    const { error } = await db
      .from("period_members")
      .update({ group_id: data.groupId, subgroup_id: data.subgroupId })
      .eq("period_id", data.periodId)
      .in("user_id", data.userIds);
    if (error) fail("Falha ao alocar membros");
    return { ok: true };
  });

/** Remove membros de um período (não mexe em contatos nem na conta). */
export const removeMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ periodId: uuid, userIds: z.array(uuid).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db
      .from("period_members")
      .delete()
      .eq("period_id", data.periodId)
      .in("user_id", data.userIds);
    if (error) fail("Falha ao remover membros");
    return { ok: true };
  });

// ---------- Transferência de contatos ----------

/** Move TODOS os contatos de um hunter para outro em uma única operação (histórico preservado). */
export const transferContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ fromId: uuid, toId: uuid, confirm: z.literal("TRANSFERIR") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.fromId === data.toId) fail("Origem e destino são o mesmo hunter.");
    const db = await admin();
    const { data: dest } = await db.from("profiles").select("id").eq("id", data.toId).maybeSingle();
    if (!dest) fail("Hunter de destino não encontrado.");
    const { count, error } = await db
      .from("contacts")
      .update({ user_id: data.toId }, { count: "exact" })
      .eq("user_id", data.fromId);
    if (error) fail("Falha ao transferir. Nenhum contato foi movido.");
    return { moved: count ?? 0 };
  });

// ---------- Exclusão de hunter ----------

/**
 * Exclui a conta de um hunter (libera o e-mail para novo cadastro).
 * Travas: nunca a própria conta, nunca outro admin, e somente com ZERO contatos
 * (a conta apagaria os contatos em cascata — por isso a checagem é refeita logo antes).
 */
export const deleteHunter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, confirm: z.literal("EXCLUIR") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) fail("Você não pode excluir a própria conta.");
    const db = await admin();
    const { data: role } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", data.id)
      .eq("role", "admin")
      .maybeSingle();
    if (role) fail("Não é possível excluir um administrador.");
    const { count, error } = await db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.id);
    if (error) fail("Não foi possível verificar os contatos.");
    if ((count ?? 0) > 0)
      fail(`Este hunter possui ${count} contatos. Transfira ou exclua os contatos antes.`);
    const { error: delErr } = await db.auth.admin.deleteUser(data.id);
    if (delErr) fail("Falha ao excluir a conta.");
    return { ok: true };
  });
