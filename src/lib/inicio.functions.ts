import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PageResult } from "./fetch-all";
import type { AtContact, WeekAt } from "./inicio";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type InicioResumo = {
  /** Meta semanal de ATs da equipe (null = sem meta definida). */
  goal: number | null;
  /** ATs da equipe na semana; a empresa só vem nas do próprio hunter. */
  ats: WeekAt[];
  /** Hunters que entram na conta da equipe. */
  teamSize: number;
};

/**
 * Resumo da equipe para a tela Início de qualquer hunter logado. As ATs dos outros hunters
 * ficam escondidas pelo RLS, então a leitura usa service role, mas o cliente recebe só o dia
 * de cada AT da equipe (sem nome nem empresa) e a meta somada.
 *
 * A equipe segue os Indicadores: com um ciclo ativo, só os membros dele; sem ciclo, todos os
 * hunters (administradores fora).
 */
export const inicioResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ today: isoDay }).parse(d))
  .handler(async ({ data, context }): Promise<InicioResumo> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./fetch-all");
    const { adminIds } = await import("./competition.server");
    const { teamWeekGoal, weekAts, weekOf } = await import("./inicio");
    const { hackathonPeriods, splitHackathon } = await import("./fila");

    const week = weekOf(data.today);
    const [profiles, admins, periods, members, goals, contacts] = await Promise.all([
      fetchAll((a, b) => db.from("profiles").select("id").order("id").range(a, b)),
      adminIds(db),
      db.from("periods").select("id, status, kind, closed_at"),
      fetchAll((a, b) =>
        db.from("period_members").select("period_id, user_id, group_id").order("id").range(a, b),
      ),
      db.from("goals").select("user_id, group_id, envios_dia, l1_semana, ats_semana, no_prazo_pct"),
      // Só contatos com AT: a semana é decidida em weekAts, pela data de registro.
      fetchAll(
        (a, b) =>
          db
            .from("contacts")
            .select("user_id, company, at_marcada_em, at_registrado_em, period_id, created_at")
            .not("at_marcada_em", "is", null)
            .order("id")
            .range(a, b) as unknown as PageResult<AtContact>,
      ),
    ]);

    const active = (periods.data ?? []).find((p) => p.status === "active") ?? null;
    const mem = new Map(
      members.filter((m) => m.period_id === active?.id).map((m) => [m.user_id, m.group_id]),
    );
    const cycle = active?.kind === "ciclo";
    const team = profiles
      .filter((p) => !admins.has(p.id) && (!cycle || mem.has(p.id)))
      .map((p) => ({ id: p.id, groupId: mem.get(p.id) ?? null }));

    return {
      goal: teamWeekGoal(goals.data ?? [], team),
      ats: weekAts(
        // Um card do Hackathon encerrado avançado agora não conta nas ATs da semana.
        splitHackathon(contacts, hackathonPeriods(periods.data ?? [])).current,
        new Set(team.map((h) => h.id)),
        context.userId,
        week,
      ),
      teamSize: team.length,
    };
  });
