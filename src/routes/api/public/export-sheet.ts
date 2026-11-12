import { fetchAll } from "@/lib/fetch-all";
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import {
  DEFAULT_OFFSETS,
  STATUS_LABEL,
  STEPS,
  computedStatus,
  plannedDates,
  type Contact,
  type Offsets,
} from "@/lib/cadencia";

// Etapas, status e datas previstas vêm de src/lib/cadencia.ts (mesma regra do app).
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const Route = createFileRoute("/api/public/export-sheet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tk } = await supabaseAdmin.from("sync_settings" as never).select("token").limit(1).maybeSingle();
        const expected = (tk as { token?: string } | null)?.token ?? "";
        if (!token || !expected || token.length > 256 || !safeEq(token, expected)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const [contactsRes, profilesRes, settingsRes, holRes] = await Promise.all([
          fetchAll((a, b) => supabaseAdmin.from("contacts").select("*").order("id").range(a, b)).then((data) => ({ data, error: null })),
          fetchAll((a, b) => supabaseAdmin.from("profiles").select("id, display_name, email").order("id").range(a, b)).then((data) => ({ data, error: null })),
          fetchAll((a, b) => supabaseAdmin.from("settings").select("*").order("user_id").range(a, b)).then((data) => ({ data, error: null })),
          supabaseAdmin.from("holidays").select("date"),
        ]);
        if (contactsRes.error || profilesRes.error || settingsRes.error || holRes.error) {
          return Response.json({ error: "internal" }, { status: 500 });
        }
        const names = new Map(profilesRes.data.map((p) => [p.id, p.display_name?.trim() || p.email || ""]));
        const holidays = new Set((holRes.data ?? []).map((h) => h.date));
        const offs = new Map(settingsRes.data.map((s) => [s.user_id, s as Offsets]));

        const rows = contactsRes.data
          .map((c) => {
            const planned = plannedDates(c, offs.get(c.user_id) ?? DEFAULT_OFFSETS, holidays);
            const status = computedStatus(c as Contact);
            const active = status === "aguardando" || status === "em_cadencia";
            const next = active ? STEPS.find((s) => !c[s.sentField]) : undefined;
            return {
              hunter: names.get(c.user_id) ?? "",
              nome: c.name ?? "",
              cargo: c.headline ?? "",
              empresa: c.company ?? "",
              telefone: c.phone ?? "",
              data_conexao: d10(c.connected_at),
              linkedin1_prevista: d10(planned[1]), linkedin1_enviada: d10(c.sent1_at),
              whatsapp1_prevista: d10(planned[2]), whatsapp1_enviada: d10(c.sent2_at),
              linkedin2_prevista: d10(planned[3]), linkedin2_enviada: d10(c.sent3_at),
              whatsapp2_prevista: d10(planned[4]), whatsapp2_enviada: d10(c.sent4_at),
              linkedin3_prevista: d10(planned[5]), linkedin3_enviada: d10(c.sent5_at),
              proxima_etapa: next?.label ?? "",
              proxima_data: next ? d10(planned[next.n]) : "",
              status: STATUS_LABEL[status],
              importado_em: d10(c.created_at),
            };
          })
          .sort((a, b) => a.hunter.localeCompare(b.hunter, "pt-BR") || b.data_conexao.localeCompare(a.data_conexao));

        return Response.json(
          { updated_at: new Date().toISOString(), rows },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
