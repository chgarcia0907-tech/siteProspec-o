import { useCallback, useMemo, useState } from "react";

/** Conjunto de ids selecionados em uma tabela (checkboxes por linha e "selecionar todos"). */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback((ids: Iterable<string>) => setSelected(new Set(ids)), []);
  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({
      selected,
      size: selected.size,
      ids: () => [...selected],
      has: (id: string) => selected.has(id),
      toggle,
      selectAll,
      clear,
    }),
    [selected, toggle, selectAll, clear],
  );
}

export type Selection = ReturnType<typeof useSelection>;
