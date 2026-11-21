import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CardTasks, TaskPd } from "./tasksHunter";

export type TasksPipedrive = {
  admin: boolean;
  /** Login do usuário logado (time comercial, senão começo do e-mail). */
  meuLogin: string | null;
  atualizadoEm: string;
  cards: CardTasks[];
  tasks: TaskPd[];
};

type DealPd = {
  id: number;
  title: string;
  stage_id: number;
  label_ids?: number[] | null;
  custom_fields?: Record<string, unknown> | null;
};
type CampoPd = { field_code: string; options?: { id: number; label: string }[] | null };

/** Roda `fn` em todos os itens, `limite` por vez (respeita o limite de chamadas do Pipedrive). */
async function emLotes<T, R>(itens: readonly T[], limite: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        out[i] = await fn(itens[i]!);
      }
    }),
  );
  return out;
}

/**
 * Tasks do Pipedrive dos cards do NTec (funil 6, etiqueta NTec) em AT Diag. Agendada e AT Diag.
 * Realizada, lidas na hora com PIPEDRIVE_API_TOKEN. O admin recebe todos os hunters; os demais,
 * só os cards em que o campo Hunter é o próprio login. A conta fica em `tasksHunter.ts`.
 */
export const tasksPipedrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TasksPipedrive> => {
    const { pd, pdTodas } = await import("./pipedrive.server");
    const { loginDoUsuario } = await import("./ats");
    const { CAMPO_HUNTER, ETAPAS_TASKS, ETIQUETA_NTEC, hunterDoCard } =
      await import("./tasksHunter");

    const [{ data: admin }, { data: time }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.from("time_comercial").select("login, user_id"),
    ]);
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const meuLogin = loginDoUsuario(context.userId, email, time ?? []);

    const [deals, campos] = await Promise.all([
      pdTodas<DealPd>("/deals?pipeline_id=6&status=open"),
      pd<CampoPd[]>("/dealFields?limit=500"),
    ]);
    const opcoes = new Map(
      (campos.find((c) => c.field_code === CAMPO_HUNTER)?.options ?? []).map((o) => [
        o.id,
        o.label,
      ]),
    );
    const etapas: readonly number[] = ETAPAS_TASKS;
    let cards: CardTasks[] = deals
      .filter((d) => (d.label_ids ?? []).includes(ETIQUETA_NTEC) && etapas.includes(d.stage_id))
      .map((d) => ({
        id: d.id,
        title: d.title,
        stage_id: d.stage_id,
        hunter: hunterDoCard(d.custom_fields?.[CAMPO_HUNTER], opcoes),
      }));
    if (!admin) cards = cards.filter((c) => c.hunter === meuLogin);

    const porCard = await emLotes(cards, 6, (c) =>
      pd<TaskPd[]>(`/activities?deal_id=${c.id}&limit=500`),
    );
    // Buscadas card a card: sem deal_id na resposta, a task é do card que foi pedido.
    const tasks: TaskPd[] = porCard.flatMap((lista, i) =>
      lista.map((t) => ({
        id: t.id,
        deal_id: t.deal_id ?? cards[i]!.id,
        subject: t.subject,
        type: t.type,
        due_date: t.due_date,
        done: t.done,
        marked_as_done_time: t.marked_as_done_time,
        is_deleted: t.is_deleted ?? false,
      })),
    );
    return { admin: !!admin, meuLogin, atualizadoEm: new Date().toISOString(), cards, tasks };
  });
