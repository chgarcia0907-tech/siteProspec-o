import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReactNode } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { STATUS_LABEL } from "@/lib/cadencia";
import {
  CONTACT_STATUSES,
  MISSING_LABEL,
  RESPOSTA_FILTER_LABEL,
  type MissingFilter,
  type RespostaFilter,
  RETOMADA_FILTER_LABEL,
  type RetomadaFilter,
  type StatusFilter,
} from "@/lib/contatos";

const PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1M25CO9Y4NqPjGdCi3P1hNWNglWZ3Jf7EDVIl_k9JLj0/edit";

/** Título, busca, filtros de situação e pendência, link da planilha, ações e exportação. */
export function ContactsToolbar({
  count,
  search,
  onSearch,
  status,
  onStatus,
  missing,
  onMissing,
  resposta,
  onResposta,
  retomada,
  onRetomada,
  actions,
  onExport,
}: {
  count: number;
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  missing: MissingFilter;
  onMissing: (v: MissingFilter) => void;
  resposta: RespostaFilter;
  onResposta: (v: RespostaFilter) => void;
  retomada: RetomadaFilter;
  onRetomada: (v: RetomadaFilter) => void;
  /** Botões extras (ex.: preenchimento automático). */
  actions?: ReactNode;
  onExport: () => void;
}) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{count === 1 ? "1 contato" : `${count} contatos`}</p>
          <h1 className="mt-1 text-title font-bold">Contatos</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end leading-tight">
            <a
              href={PLANILHA_URL}
              target="_blank"
              rel="noreferrer"
              className="text-dense font-semibold text-primary underline-offset-4 hover:underline"
            >
              Abrir planilha
            </a>
            <span className="text-caption text-subtle-foreground">
              atualiza automaticamente, com atraso de até 1 hora
            </span>
          </div>
          <Button variant="secondary" onClick={onExport}>
            Exportar CSV
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou empresa"
          aria-label="Buscar contatos"
          className="w-72"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => onStatus(v as StatusFilter)}>
          <SelectTrigger className="w-48" aria-label="Situação">
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
        <NativeSelect
          aria-label="Pendências"
          className="w-48"
          value={missing}
          onChange={(e) => onMissing(e.target.value as MissingFilter)}
        >
          {(Object.keys(MISSING_LABEL) as MissingFilter[]).map((m) => (
            <option key={m} value={m}>
              {MISSING_LABEL[m]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Resposta"
          className="w-48"
          value={resposta}
          onChange={(e) => onResposta(e.target.value as RespostaFilter)}
        >
          {(Object.keys(RESPOSTA_FILTER_LABEL) as RespostaFilter[]).map((r) => (
            <option key={r} value={r}>
              {RESPOSTA_FILTER_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Retomada"
          className="w-52"
          value={retomada}
          onChange={(e) => onRetomada(e.target.value as RetomadaFilter)}
        >
          {(Object.keys(RETOMADA_FILTER_LABEL) as RetomadaFilter[]).map((r) => (
            <option key={r} value={r}>
              {RETOMADA_FILTER_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto">{actions}</div>
      </div>
    </div>
  );
}
