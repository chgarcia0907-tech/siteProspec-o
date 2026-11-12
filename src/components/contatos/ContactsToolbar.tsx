import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL } from "@/lib/cadencia";
import { CONTACT_STATUSES, type StatusFilter } from "@/lib/contatos";

const PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1M25CO9Y4NqPjGdCi3P1hNWNglWZ3Jf7EDVIl_k9JLj0/edit";

/** Título, busca, filtro de situação, link da planilha e exportação. */
export function ContactsToolbar({
  count,
  search,
  onSearch,
  status,
  onStatus,
  onExport,
}: {
  count: number;
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
        <p className="text-sm text-muted-foreground">
          {count} contatos · edite empresa, telefone e datas direto na tabela.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou empresa"
          className="w-64"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => onStatus(v as StatusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col items-end leading-tight">
          <a
            href={PLANILHA_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir planilha
          </a>
          <span className="text-[11px] text-muted-foreground">
            atualiza automaticamente, com atraso de até 1 hora
          </span>
        </div>
        <Button variant="outline" onClick={onExport}>
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
