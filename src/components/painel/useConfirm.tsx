import { useCallback, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/** Ação destrutiva aguardando confirmação. `word` exige digitar a palavra para liberar. */
export type Pending = {
  title: string;
  desc: string;
  word?: string;
  action?: string;
  run: () => Promise<void>;
} | null;

export type Ask = (p: Pending) => void;

/** Estado do diálogo de confirmação do painel: `ask` abre, `dialog` é o elemento a renderizar. */
export function useConfirm() {
  const [pending, setPending] = useState<Pending>(null);
  const ask = useCallback<Ask>((p) => setPending(p), []);
  const dialog = <ConfirmDialog pending={pending} onClose={() => setPending(null)} />;
  return { ask, dialog };
}
