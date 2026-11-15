import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { formatBR } from "@/lib/cadencia";
import { pct, type HunterRow } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { Section } from "./shared";
import { dm, num, pctText, type Dash } from "./format";

type SortKey =
  | "hunter"
  | "total"
  | "noPrazo"
  | "late"
  | "idle"
  | "started"
  | "inProgress"
  | "ats"
  | "responses"
  | "conv";
const SORT: Record<SortKey, (r: HunterRow) => number | string> = {
  hunter: (r) => r.hunter,
  total: (r) => r.total,
  noPrazo: (r) => pct(r.onTime, r.due) ?? -1,
  late: (r) => r.late,
  idle: (r) => r.idleDays ?? 9999,
  started: (r) => r.started,
  inProgress: (r) => r.inProgress,
  ats: (r) => r.ats,
  responses: (r) => r.responses,
  conv: (r) => pct(r.ats, r.l1) ?? -1,
};

/** Execução da cadência por hunter: envios por etapa, prazo, atrasados e situação da fila. */
export function Execucao({ d }: { d: Dash }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "total", desc: true });
  const [open, setOpen] = useState<string | null>(null);
  const rows = [...d.hunters].sort((a, b) => {
    const x = SORT[sort.key](a);
    const y = SORT[sort.key](b);
    const c = typeof x === "string" ? x.localeCompare(String(y), "pt-BR") : x - (y as number);
    return sort.desc ? -c : c;
  });
  const th = (key: SortKey, label: string, title?: string) => (
    <th className="p-2 text-right first:text-left">
      <button
        className="inline-flex items-center gap-0.5 hover:text-foreground"
        title={title}
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "hunter" }))}
      >
        {label}
        {sort.key === key && <span aria-hidden>{sort.desc ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
  const cols = d.steps.length + 11;

  return (
    <Section
      title="Execução da cadência por hunter"
      hint="Envios no intervalo por etapa. “No prazo” = etapas previstas no intervalo que saíram até a data prevista. Clique no hunter para ver os atrasados."
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="table-dense w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {th("hunter", "Hunter")}
              {d.steps.map((s) => (
                <th key={s.n} className="p-2 text-right">
                  {s.label}
                </th>
              ))}
              {th("total", "Total")}
              {th("noPrazo", "No prazo", "Previstas no intervalo que saíram na data")}
              {th("late", "Atrasados", "Contatos com etapa vencida agora")}
              {th("idle", "Último envio")}
              {th("started", "Iniciadas", "LinkedIn 1 no intervalo")}
              {th("inProgress", "Em cadência")}
              <th className="p-2 text-right">Aguardando</th>
              {th("responses", "Respostas")}
              {th("ats", "ATs")}
              {th("conv", "Conversão", "ATs ÷ LinkedIn 1 no intervalo")}
              <th className="p-2 text-right" title="Descartados entre as cadências iniciadas">
                Descarte
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="p-3 text-muted-foreground">
                  Nenhum hunter no filtro.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const expanded = open === r.hunter_id;
              const noPrazo = pct(r.onTime, r.due);
              return (
                <Fragment key={r.hunter_id}>
                  <tr className="border-t">
                    <td className="p-2">
                      <button
                        className="flex items-center gap-1 text-left font-medium"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : r.hunter_id)}
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {r.hunter}
                      </button>
                      {(r.grupo || r.subgrupo) && (
                        <span className="ml-5 block text-[11px] text-muted-foreground">
                          {[r.grupo, r.subgrupo].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    {d.steps.map((s) => (
                      <td key={s.n} className="p-2 text-right tabular-nums">
                        {num(r.sent[s.n - 1]!)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold tabular-nums">{num(r.total)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {pctText(noPrazo)}
                      {r.due > 0 && (
                        <span className="block text-[11px] text-muted-foreground">
                          {r.onTime}/{r.due}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "p-2 text-right tabular-nums",
                        r.late > 0 && "font-semibold text-destructive",
                      )}
                      title={`1–2 dias úteis: ${r.lateBands[0]} · 3–5: ${r.lateBands[1]} · mais de 5: ${r.lateBands[2]}`}
                    >
                      {num(r.late)}
                      {r.late > 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {r.lateBands.join(" / ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {r.lastSend ? dm(r.lastSend) : "—"}
                      <span
                        className={cn(
                          "block text-[11px] text-muted-foreground",
                          (r.idleDays ?? 0) >= 2 && "text-destructive",
                        )}
                      >
                        {r.idleDays === null
                          ? "nunca enviou"
                          : r.idleDays === 0
                            ? "hoje"
                            : `há ${r.idleDays} d úteis`}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{num(r.started)}</td>
                    <td className="p-2 text-right tabular-nums">{num(r.inProgress)}</td>
                    <td className="p-2 text-right tabular-nums">{num(r.waiting)}</td>
                    <td className="p-2 text-right tabular-nums">{num(r.responses)}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{num(r.ats)}</td>
                    <td className="p-2 text-right tabular-nums">{pctText(pct(r.ats, r.l1))}</td>
                    <td className="p-2 text-right tabular-nums">
                      {pctText(pct(r.discarded, r.started))}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/30">
                      <td colSpan={cols} className="p-3">
                        <LateList r={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Atrasados por faixa de dias úteis: 1–2 / 3–5 / mais de 5. “Último envio” conta dias úteis
        até hoje.
      </p>
    </Section>
  );
}

function LateList({ r }: { r: HunterRow }) {
  if (!r.late) return <p className="text-sm text-muted-foreground">Nenhum envio atrasado.</p>;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {r.late} contatos atrasados
        {r.late > r.lateList.length ? ` (mostrando os ${r.lateList.length} mais antigos)` : ""}
      </p>
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 pr-2">Contato</th>
            <th className="py-1 pr-2">Empresa</th>
            <th className="py-1 pr-2">Etapa</th>
            <th className="py-1 pr-2">Prevista</th>
            <th className="py-1 text-right">Atraso</th>
          </tr>
        </thead>
        <tbody>
          {r.lateList.map((l) => (
            <tr key={l.id} className="border-t border-border/60">
              <td className="py-1 pr-2 font-medium">{l.name}</td>
              <td className="py-1 pr-2">{l.company || "—"}</td>
              <td className="py-1 pr-2">{l.step}</td>
              <td className="py-1 pr-2">{formatBR(l.planned)}</td>
              <td className={cn("py-1 text-right", l.days > 5 && "font-semibold text-destructive")}>
                {l.days} d úteis
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mapa de calor hunters × dias (ou semanas): mostra de cara quem parou de enviar. */
export function Heatmap({ d }: { d: Dash }) {
  const max = Math.max(0, ...d.hunters.flatMap((h) => h.heat));
  const label = (b: string) => (d.heat.kind === "dia" ? dm(b) : `sem. ${dm(b)}`);
  const weekend = (b: string) => {
    if (d.heat.kind !== "dia") return false;
    const wd = new Date(`${b}T12:00:00Z`).getUTCDay();
    return wd === 0 || wd === 6;
  };
  return (
    <Section
      title={`Envios por ${d.heat.kind === "dia" ? "dia" : "semana"}`}
      hint="Quanto mais escuro, mais mensagens. Linha clara = hunter parado."
    >
      {max === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum envio no intervalo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs" aria-label="Envios por hunter e data">
            <thead>
              <tr>
                <th className="pr-2 text-left font-normal text-muted-foreground">Hunter</th>
                {d.heat.buckets.map((b) => (
                  <th
                    key={b}
                    className={cn(
                      "px-0.5 pb-1 font-normal text-muted-foreground",
                      weekend(b) && "opacity-50",
                    )}
                  >
                    <span className="block w-9 text-center">{label(b)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.hunters.map((h) => (
                <tr key={h.hunter_id}>
                  <td className="max-w-[10rem] truncate py-0.5 pr-2">{h.hunter}</td>
                  {h.heat.map((v, i) => (
                    <td key={d.heat.buckets[i]} className="p-0.5">
                      <span
                        className={cn(
                          "flex h-7 w-9 items-center justify-center rounded-sm tabular-nums",
                          !v
                            ? "bg-muted text-muted-foreground"
                            : v / max > 0.5
                              ? "text-white"
                              : "text-foreground",
                        )}
                        style={
                          v
                            ? {
                                backgroundColor: `color-mix(in oklch, var(--chart-1) ${30 + (70 * v) / max}%, var(--muted))`,
                              }
                            : undefined
                        }
                        title={`${h.hunter}: ${v} envios em ${label(d.heat.buckets[i]!)}`}
                      >
                        {v || ""}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** Ritmo real entre etapas (dias úteis) comparado ao intervalo configurado pelos hunters. */
export function Ritmo({ d }: { d: Dash }) {
  return (
    <Section
      title="Ritmo entre etapas"
      hint="Média de dias úteis entre uma etapa e a seguinte, para envios feitos no intervalo."
    >
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-1">Passagem</th>
            <th className="py-1 text-right">Real</th>
            <th className="py-1 text-right">Configurado</th>
            <th className="py-1 text-right">Envios</th>
          </tr>
        </thead>
        <tbody>
          {d.pace.map((p) => (
            <tr key={p.from} className="border-t">
              <td className="py-1">
                {p.from} → {p.to}
              </td>
              <td
                className={cn(
                  "py-1 text-right tabular-nums",
                  p.real !== null &&
                    p.planned !== null &&
                    p.real > p.planned + 1 &&
                    "text-destructive",
                )}
              >
                {p.real === null ? "—" : `${num(p.real)} d`}
              </td>
              <td className="py-1 text-right tabular-nums">
                {p.planned === null ? "—" : `${num(p.planned)} d`}
              </td>
              <td className="py-1 text-right tabular-nums text-muted-foreground">{p.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
