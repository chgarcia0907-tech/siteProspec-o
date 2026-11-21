import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dataHoraSP, linkDoCard, type AtLinha } from "@/lib/ats";
import { AtStatusBadge } from "./AtStatusBadge";

const COLS = 7;

/** Tabela das ATs (compacta, DESIGN.md seção 5): só leitura; o detalhe abre pelo botão da linha. */
export function AtsTabela({
  linhas,
  isLoading,
  nomeDe,
  onAbrir,
}: {
  linhas: readonly AtLinha[];
  isLoading: boolean;
  /** Nome de exibição de um login do time (cai no próprio login). */
  nomeDe: (login: string | null) => string;
  onAbrir: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table className="table-dense">
        <TableHeader>
          <TableRow>
            <TableHead>Data da AT</TableHead>
            <TableHead>Empresa e prospect</TableHead>
            <TableHead>Hunter</TableHead>
            <TableHead>CN</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-32">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={COLS} className="text-muted-foreground">
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">
                Nenhuma AT neste filtro.
              </TableCell>
            </TableRow>
          )}
          {linhas.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap">
                <span className="text-heading tabular-nums">{dataHoraSP(a.agendada_atual)}</span>
                {a.remarcacoes > 0 && (
                  <span className="block text-caption text-subtle-foreground">
                    era {dataHoraSP(a.agendada_original)}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="font-semibold text-heading">{a.empresa}</span>
                <span className="block text-caption text-muted-foreground">
                  {a.prospect}
                  {a.cargo ? ` · ${a.cargo}` : ""}
                </span>
              </TableCell>
              <TableCell>{nomeDe(a.hunter_login)}</TableCell>
              <TableCell>{nomeDe(a.cn_login)}</TableCell>
              <TableCell>{a.canal ?? "—"}</TableCell>
              <TableCell>
                <AtStatusBadge status={a.status} remarcacoes={a.remarcacoes} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {a.pipedrive_deal_id != null && (
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={linkDoCard(a.pipedrive_deal_id)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir o card de ${a.empresa} no Pipedrive`}
                      >
                        <ExternalLink aria-hidden strokeWidth={1.75} />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAbrir(a.id)}
                    aria-label={`Abrir a AT de ${a.empresa}`}
                  >
                    Abrir
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
