import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { deltaPct, pct, type Kpi } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { num, pctText, type Dash } from "./format";

/** Cartões do topo: o resultado (ATs), o esforço e o que está travado agora. */
export function Kpis({ d }: { d: Dash }) {
  const k = d.kpis;
  const conv = pct(k.ats.value, k.l1.value);
  const convPrev = pct(k.ats.prev ?? 0, k.l1.prev ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tile label="ATs marcadas" kpi={k.ats} highlight />
      <Tile label="Respostas" kpi={k.respostas} />
      <Tile label="Mensagens enviadas" kpi={k.envios} />
      <Tile label="LinkedIn" kpi={k.linkedin} />
      <Tile label="WhatsApp" kpi={k.whatsapp} />
      <Tile
        label="Conversão LinkedIn 1 → AT"
        value={pctText(conv)}
        sub={`${num(k.ats.value)} ATs ÷ ${num(k.l1.value)} LinkedIn 1 · antes ${pctText(convPrev)}`}
      />
      <Tile
        label="Importados · empresas"
        value={`${num(k.importados.value)} · ${num(k.empresas.value)}`}
        sub={`antes ${num(k.importados.prev ?? 0)} · ${num(k.empresas.prev ?? 0)}`}
      />
      <Tile
        label="Envios atrasados agora"
        value={num(k.atrasados)}
        tone={k.atrasados ? "bad" : undefined}
      />
      <Tile
        label="Hunters parados (2+ dias úteis)"
        value={num(k.parados)}
        tone={k.parados ? "bad" : undefined}
      />
      <Tile
        label="Tempo até a resposta"
        value={d.responseTime.avg === null ? "—" : `${num(d.responseTime.avg)} d úteis`}
        sub={`média desde o LinkedIn 1 · ${num(d.responseTime.n)} respostas`}
      />
    </div>
  );
}

function Tile({
  label,
  kpi,
  value,
  sub,
  highlight,
  tone,
}: {
  label: string;
  kpi?: Kpi;
  value?: string;
  sub?: string;
  highlight?: boolean;
  tone?: "bad" | undefined;
}) {
  const delta = kpi ? deltaPct(kpi) : null;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("rounded-lg border bg-card p-3", highlight && "border-primary/40 bg-accent/40")}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "bad" && "text-destructive",
        )}
      >
        {value ?? num(kpi!.value)}
      </p>
      {kpi ? (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {delta !== null && delta !== 0 && (
            <span className="inline-flex items-center font-medium text-foreground">
              {delta > 0 ? (
                <ArrowUpRight className="h-3 w-3" aria-label="subiu" />
              ) : (
                <ArrowDownRight className="h-3 w-3" aria-label="caiu" />
              )}
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
          <span>antes: {num(kpi.prev ?? 0)}</span>
        </p>
      ) : (
        sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
