import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { deltaPct, pct, type Kpi } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { num, pctText, type Dash } from "./format";

/**
 * Os 4 KPIs que respondem "a equipe está no ritmo?": o resultado (ATs, a métrica-guia), o
 * esforço, a conversão e o que está travado agora (DESIGN.md, seção 7).
 */
export function KpisPrincipais({ d }: { d: Dash }) {
  const k = d.kpis;
  const conv = pct(k.ats.value, k.l1.value);
  const convPrev = pct(k.ats.prev ?? 0, k.l1.prev ?? 0);
  return (
    <div className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-4">
      <Tile label="ATs marcadas" kpi={k.ats} guide />
      <Tile label="Mensagens enviadas" kpi={k.envios} />
      <Tile
        label="Conversão LinkedIn 1 → AT"
        value={pctText(conv)}
        sub={`${num(k.ats.value)} ATs ÷ ${num(k.l1.value)} LinkedIn 1 · antes ${pctText(convPrev)}`}
      />
      <Tile label="Envios atrasados agora" value={num(k.atrasados)} alert={k.atrasados > 0} />
    </div>
  );
}

/** Faixa de KPIs secundários, abaixo dos principais. */
export function KpisSecundarios({ d }: { d: Dash }) {
  const k = d.kpis;
  return (
    <div className="grid grid-cols-6 divide-x divide-border overflow-hidden rounded-xl border bg-card">
      <Tile small label="Respostas" kpi={k.respostas} />
      <Tile small label="LinkedIn" kpi={k.linkedin} />
      <Tile small label="WhatsApp" kpi={k.whatsapp} />
      <Tile
        small
        label="Importados · empresas"
        value={`${num(k.importados.value)} · ${num(k.empresas.value)}`}
        sub={`antes ${num(k.importados.prev ?? 0)} · ${num(k.empresas.prev ?? 0)}`}
      />
      <Tile
        small
        label="Hunters parados (2+ dias úteis)"
        value={num(k.parados)}
        alert={k.parados > 0}
      />
      <Tile
        small
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
  guide,
  alert,
  small,
}: {
  label: string;
  kpi?: Kpi;
  value?: string;
  sub?: string;
  /** Métrica-guia (ATs marcadas): rótulo em azul. */
  guide?: boolean;
  /** Em alerta: fundo e valor em vermelho. */
  alert?: boolean;
  small?: boolean;
}) {
  const delta = kpi ? deltaPct(kpi) : null;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        small ? "px-4 py-3.5" : "rounded-xl border bg-card p-5",
        guide && "border-primary/35 bg-primary-soft",
        alert &&
          (small ? "bg-destructive-soft/50" : "border-destructive-border bg-destructive-soft/50"),
      )}
    >
      <p
        className={cn(
          small ? "text-caption" : "text-dense",
          guide ? "font-semibold text-primary-text-strong" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-display font-bold tabular-nums",
          small ? "mt-1 text-section" : guide ? "mt-3 text-big" : "mt-3 text-kpi",
          alert ? "text-destructive-text" : "text-heading",
        )}
      >
        {value ?? num(kpi!.value)}
      </p>
      {kpi ? (
        <p
          className={cn(
            "mt-1 flex flex-wrap items-center gap-1 text-muted-foreground",
            small ? "text-caption" : "text-dense",
          )}
        >
          {delta !== null && delta !== 0 && (
            <span
              className={cn(
                "inline-flex items-center font-semibold",
                delta > 0 ? "text-success" : "text-destructive-text",
              )}
            >
              {delta > 0 ? (
                <ArrowUpRight className="size-3.5" aria-label="subiu" />
              ) : (
                <ArrowDownRight className="size-3.5" aria-label="caiu" />
              )}
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
          <span>antes: {num(kpi.prev ?? 0)}</span>
        </p>
      ) : (
        sub && (
          <p className={cn("mt-1 text-muted-foreground", small ? "text-caption" : "text-dense")}>
            {sub}
          </p>
        )
      )}
    </div>
  );
}
