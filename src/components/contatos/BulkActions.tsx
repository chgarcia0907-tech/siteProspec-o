import { toast } from "sonner";
import { useConfirm } from "@/components/useConfirm";
import { Button } from "@/components/ui/button";
import { useUpdateContacts } from "@/hooks/useCadencia";
import type { Selection } from "@/hooks/useSelection";
import { todayISO } from "@/lib/cadencia";

/** Ações para os contatos selecionados: LinkedIn 1 enviada hoje e descartar. */
export function BulkActions({ selection }: { selection: Selection }) {
  const updateMany = useUpdateContacts();
  const { ask, dialog } = useConfirm();
  if (selection.size === 0) return dialog;

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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/35 bg-primary-soft px-3 py-2 text-dense">
      <span className="font-semibold text-heading">{selection.size} selecionados</span>
      <Button size="sm" onClick={step1Today}>
        Enviei LinkedIn 1 hoje para os selecionados
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const ids = selection.ids();
          updateMany.mutate(
            { ids, patch: { sem_whatsapp: true } },
            {
              onSuccess: () => {
                toast.success(
                  `${ids.length} contatos sem WhatsApp: etapas de WhatsApp dispensadas`,
                );
                selection.clear();
              },
              onError: (e) => toast.error(e.message),
            },
          );
        }}
      >
        Sem WhatsApp
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const ids = selection.ids();
          ask({
            title: `Descartar ${ids.length} ${ids.length === 1 ? "contato" : "contatos"}?`,
            desc: "Os contatos descartados saem das filas de envio. Dá para voltar a situação de cada um na tabela.",
            action: "Descartar",
            reversible: true,
            run: async () => {
              await updateMany.mutateAsync({ ids, patch: { status: "descartado" } });
              toast.success(
                ids.length === 1 ? "Contato descartado" : `${ids.length} contatos descartados`,
              );
              selection.clear();
            },
          });
        }}
      >
        Marcar como descartado
      </Button>
      <Button size="sm" variant="ghost" onClick={selection.clear}>
        Limpar seleção
      </Button>
      {dialog}
    </div>
  );
}
