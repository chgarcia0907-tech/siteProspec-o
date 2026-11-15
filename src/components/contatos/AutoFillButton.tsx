import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBulkPatchContacts } from "@/hooks/useCadencia";
import type { Contact } from "@/lib/cadencia";
import type { Company } from "@/lib/empresas";
import { autoFillPatch, autoFillSummary } from "@/lib/enriquecimento";
import { errorMessage } from "@/lib/utils";

/** Completa empresa e área vazias de todos os contatos do hunter a partir do headline. */
export function AutoFillButton({
  contacts,
  companies,
}: {
  contacts: readonly Contact[];
  companies: readonly Company[];
}) {
  const [open, setOpen] = useState(false);
  const save = useBulkPatchContacts();
  const items = useMemo(
    () =>
      contacts.flatMap((c) => {
        const patch = autoFillPatch(c, companies);
        return patch ? [{ id: c.id, patch }] : [];
      }),
    [contacts, companies],
  );
  const sum = autoFillSummary(items.map((i) => i.patch));
  const parts = [
    sum.linked && `${sum.linked} vinculados a empresas cadastradas`,
    sum.named && `${sum.named} com a empresa tirada do headline`,
    sum.areas && `${sum.areas} com a área pelo cargo`,
  ].filter(Boolean);

  return (
    <>
      <Button
        variant="outline"
        disabled={items.length === 0 || save.isPending}
        title={items.length === 0 ? "Nada para preencher automaticamente" : undefined}
        onClick={() => setOpen(true)}
      >
        Preencher empresa e área{items.length ? ` (${items.length})` : ""}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !save.isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preencher empresa e área automaticamente</AlertDialogTitle>
            <AlertDialogDescription>
              {items.length} contatos serão completados a partir do headline: {parts.join("; ")}. Só
              campos vazios são preenchidos; o que você já escreveu não muda. Confira depois o que
              ficou em branco usando o filtro de pendências.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={save.isPending}
              onClick={(e) => {
                e.preventDefault();
                save.mutate(items, {
                  onSuccess: (n) => {
                    toast.success(`${n} contatos completados`);
                    setOpen(false);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                });
              }}
            >
              {save.isPending ? "Preenchendo…" : "Preencher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
