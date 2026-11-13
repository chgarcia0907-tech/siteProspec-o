import { Button } from "@/components/ui/button";
import type { Paged } from "@/lib/paginate";

/** Rodapé de paginação: intervalo exibido e botões anterior/próxima. */
export function TablePagination<T>({
  paged,
  onPage,
  noun = "itens",
}: {
  paged: Paged<T>;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (paged.pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span>
        {paged.from}–{paged.to} de {paged.total} {noun}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={paged.page === 0}
        onClick={() => onPage(paged.page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {paged.page + 1} de {paged.pageCount}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={paged.page >= paged.pageCount - 1}
        onClick={() => onPage(paged.page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}
