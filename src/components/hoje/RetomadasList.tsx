import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { RetomadaDialog } from "@/components/RetomadaDialog";
import { Button } from "@/components/ui/button";
import { cargoSemEmpresa, formatBR, type Contact } from "@/lib/cadencia";
import { concluirRetomada, desmarcarRetomada, diasDeAtraso, textoRetomada } from "@/lib/retomada";
import { cn } from "@/lib/utils";

/**
 * Aba "Retomadas" de Envios de hoje: contatos que pediram para ser procurados depois, a partir do
 * dia combinado (as atrasadas primeiro). Ação principal: "Retomei o contato".
 */
export function RetomadasList({
  items,
  hoje,
  onPatch,
}: {
  /** Fila do dia (`retomadasDoDia`). */
  items: readonly Contact[];
  hoje: string;
  onPatch: (c: Contact, patch: Partial<Contact>, mensagem: string) => void;
}) {
  const [trocando, setTrocando] = useState<Contact | null>(null);

  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
        <CalendarClock className="size-6 text-subtle-foreground" strokeWidth={1.75} aria-hidden />
        <p className="text-card-title font-semibold text-heading">Nenhuma retomada para hoje</p>
        <p className="text-dense text-muted-foreground">
          As próximas aparecem aqui no dia combinado. Marque em Contatos, pelo botão "Retomar
          depois".
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      {items.map((c) => {
        const atrasada = diasDeAtraso(c, hoje) > 0;
        const cargo = cargoSemEmpresa(c.job_title, c.company);
        return (
          <article
            key={c.id}
            aria-label={`Retomada de ${c.name}`}
            className={cn("rounded-xl border bg-card p-4", atrasada && "border-warning-border")}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-card-title font-semibold">{c.name}</h3>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-caption font-semibold",
                      atrasada
                        ? "bg-warning-soft text-warning-text"
                        : "bg-primary-soft text-primary-text-strong",
                    )}
                  >
                    {textoRetomada(c, hoje)}
                  </span>
                </div>
                <p className="truncate text-dense text-muted-foreground">
                  {[cargo, c.company].filter(Boolean).join(" · ") || "Sem cargo e empresa"}
                </p>
                <p className="text-dense">
                  <span className="text-muted-foreground">
                    Combinado para {formatBR(c.retomar_em)}
                  </span>
                  {c.retomar_motivo && <span> · “{c.retomar_motivo}”</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => setTrocando(c)}>
                  Trocar a data
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onPatch(c, desmarcarRetomada(), "Retomada desmarcada")}
                >
                  Desmarcar
                </Button>
                <Button onClick={() => onPatch(c, concluirRetomada(), "Retomada registrada")}>
                  Retomei o contato
                </Button>
              </div>
            </div>
          </article>
        );
      })}
      {trocando && (
        <RetomadaDialog
          contato={trocando}
          hoje={hoje}
          onSalvar={(patch, mensagem) => onPatch(trocando, patch, mensagem)}
          onClose={() => setTrocando(null)}
        />
      )}
    </div>
  );
}
