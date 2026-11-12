import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUpdateContacts } from "@/hooks/useCadencia";
import type { Selection } from "@/hooks/useSelection";
import { todayISO } from "@/lib/cadencia";

/** Ações para os contatos selecionados: LinkedIn 1 enviada hoje e descartar. */
export function BulkActions({ selection }: { selection: Selection }) {
  const updateMany = useUpdateContacts();
  if (selection.size === 0) return null;

  function step1Today() {
    const ids = selection.ids();
    const today = todayISO();
    updateMany.mutate(
      { ids, patch: { step1_date: today, sent1_at: today, status: "em_cadencia" } },
      {
        onSuccess: () => {
          toast.success(`LinkedIn 1 registrada para ${ids.length} contatos`);
          selection.clear();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/60 px-3 py-2 text-sm">
      <span className="font-medium">{selection.size} selecionados</span>
      <Button size="sm" onClick={step1Today}>
        Enviei LinkedIn 1 hoje para os selecionados
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          updateMany.mutate(
            { ids: selection.ids(), patch: { status: "descartado" } },
            { onSuccess: selection.clear, onError: (e) => toast.error(e.message) },
          )
        }
      >
        Marcar como descartado
      </Button>
      <Button size="sm" variant="ghost" onClick={selection.clear}>
        Limpar seleção
      </Button>
    </div>
  );
}
