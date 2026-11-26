import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AtPendente, CCard } from "@/lib/conciliacao";
import { NOME_ETAPA } from "@/lib/pipedrive";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolher, entre os cards do outbound sem AT, o card de uma AT (busca pelo título ou número). */
export function EscolherCardDialog({
  at,
  cards,
  nomeHunter,
  onLigar,
  onClose,
}: {
  at: AtPendente;
  cards: readonly CCard[];
  nomeHunter: string;
  onLigar: (dealId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = norm(busca.trim());
  const lista = cards
    .filter((c) => !termo || norm(`${c.deal_id} ${c.titulo}`).includes(termo))
    .slice(0, 50);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Card da AT de {at.prospect}</DialogTitle>
          <DialogDescription>
            {at.empresa} · {nomeHunter}. Escolha entre os cards do outbound que ainda não têm AT.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Buscar card pelo título ou número"
          placeholder="Buscar pelo título ou número"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
        {lista.length === 0 ? (
          <p className="text-dense text-muted-foreground">
            Nenhum card do outbound sem AT com esse termo. Se o card é novo, use "Sincronizar agora"
            e tente de novo.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border" aria-label="Cards">
            {lista.map((c) => (
              <li key={c.deal_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-dense text-heading">{c.titulo || `#${c.deal_id}`}</p>
                  <p className="text-caption text-muted-foreground">
                    #{c.deal_id} · {c.hunter_login ?? "sem hunter"} ·{" "}
                    {(c.stage_id !== null && NOME_ETAPA[c.stage_id]) || "etapa desconhecida"}
                  </p>
                </div>
                <Button
                  size="sm"
                  aria-label={`Ligar ao card ${c.deal_id}`}
                  onClick={async () => {
                    await onLigar(c.deal_id);
                    onClose();
                  }}
                >
                  Ligar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
