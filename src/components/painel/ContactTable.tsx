import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeleter } from "@/hooks/usePainel";
import { useSelection } from "@/hooks/useSelection";
import { STATUS_LABEL, formatBR } from "@/lib/cadencia";
import type { painelContacts } from "@/lib/painel.functions";
import type { Ask } from "./useConfirm";

export type PainelContact = Awaited<ReturnType<typeof painelContacts>>["rows"][number];

/** Tabela de contatos do painel, com exclusão individual e em lote. */
export function ContactTable({
  rows,
  names,
  ask,
  onDeleted,
}: {
  rows: PainelContact[];
  names?: Map<string, string>;
  ask: Ask;
  onDeleted?: () => void;
}) {
  const sel = useSelection();
  const deleter = useDeleter();
  const { clear } = sel;
  useEffect(() => clear(), [rows, clear]);
  const all = rows.length > 0 && sel.size === rows.length;
  const hasAct = rows.some((r) => r.atividades?.length);
  const remove = (ids: string[]) => async () => {
    await deleter({ mode: "ids", ids });
    onDeleted?.();
  };

  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">Nenhum contato.</p>;
  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
          <span>{sel.size} selecionados</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              ask({
                title: "Excluir selecionados",
                desc: `${sel.size} contatos serão excluídos permanentemente.`,
                run: remove(sel.ids()),
              })
            }
          >
            Excluir selecionados
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="table-dense w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 p-2">
                <Checkbox
                  checked={all}
                  onCheckedChange={(v) => (v ? sel.selectAll(rows.map((r) => r.id)) : sel.clear())}
                  aria-label="Selecionar todos"
                />
              </th>
              {names && <th className="p-2">Hunter</th>}
              <th className="p-2">Nome</th>
              <th className="p-2">Cargo</th>
              <th className="p-2">Empresa</th>
              <th className="p-2">Telefone</th>
              <th className="p-2">Situação</th>
              {hasAct && <th className="p-2">Atividade no período</th>}
              <th className="p-2">Importado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <Checkbox
                    checked={sel.has(r.id)}
                    onCheckedChange={() => sel.toggle(r.id)}
                    aria-label={`Selecionar ${r.name}`}
                  />
                </td>
                {names && <td className="p-2 whitespace-nowrap">{names.get(r.user_id) ?? "—"}</td>}
                <td className="p-2 font-medium">{r.name}</td>
                <td className="max-w-[260px] truncate p-2 text-muted-foreground">{r.headline}</td>
                <td className="p-2">{r.company}</td>
                <td className="p-2 whitespace-nowrap">{r.phone}</td>
                <td className="p-2 whitespace-nowrap">
                  {STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status}
                </td>
                {hasAct && (
                  <td className="p-2 text-xs text-muted-foreground">
                    {(r.atividades ?? [])
                      .map((a) => a.replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2"))
                      .join(" · ")}
                  </td>
                )}
                <td className="p-2 whitespace-nowrap">{formatBR(r.created_at.slice(0, 10))}</td>
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      ask({
                        title: "Excluir contato",
                        desc: `"${r.name}" será excluído permanentemente.`,
                        run: remove([r.id]),
                      })
                    }
                  >
                    Excluir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
