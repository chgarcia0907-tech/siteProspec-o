import { useCallback, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Ação destrutiva aguardando confirmação. `word` exige digitar a palavra para liberar;
 * `reversible` tira o aviso de que a ação não pode ser desfeita.
 */
export type Pending = {
  title: string;
  desc: string;
  word?: string;
  action?: string;
  reversible?: boolean;
  run: () => Promise<void>;
} | null;

export type Ask = (p: Pending) => void;

/** Estado do diálogo de confirmação de ações destrutivas: `ask` abre, `dialog` é o elemento a renderizar. */
export function useConfirm() {
  const [pending, setPending] = useState<Pending>(null);
  const ask = useCallback<Ask>((p) => setPending(p), []);
  const dialog = <ConfirmDialog pending={pending} onClose={() => setPending(null)} />;
  return { ask, dialog };
}
