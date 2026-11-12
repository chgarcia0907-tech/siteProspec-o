import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { errorMessage } from "@/lib/utils";
import type { Pending } from "./useConfirm";

export function ConfirmDialog({ pending, onClose }: { pending: Pending; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(""), [pending]);
  const wordOk =
    !pending?.word || typed.trim() === pending.word || typed.trim().toUpperCase() === pending.word;

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.desc} Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pending?.word && (
          <div className="space-y-1">
            <Label htmlFor="conf">
              Digite <strong>{pending.word}</strong> para confirmar
            </Label>
            <Input
              id="conf"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy || !wordOk}
            onClick={async (e) => {
              e.preventDefault();
              if (!pending) return;
              setBusy(true);
              try {
                await pending.run();
                onClose();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {pending?.action ?? "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
