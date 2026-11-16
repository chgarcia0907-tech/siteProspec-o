import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useDeleter, type HunterInfo } from "@/hooks/usePainel";
import { deleteHunter, transferContacts } from "@/lib/periodos.functions";
import type { Ask } from "@/components/useConfirm";

/**
 * Ações sobre o hunter: transferir os contatos para outro e, na zona de risco no fim da tela,
 * limpar os contatos ou excluir a conta (só sem contatos).
 */
export function HunterActions({
  hunter,
  hunters,
  ask,
  onDeleted,
}: {
  hunter: HunterInfo;
  hunters: HunterInfo[];
  ask: Ask;
  onDeleted: () => void;
}) {
  const transfer = useServerFn(transferContacts);
  const del = useServerFn(deleteHunter);
  const deleter = useDeleter();
  const qc = useQueryClient();
  const [dest, setDest] = useState("");
  useEffect(() => setDest(""), [hunter.id]);
  const destName = hunters.find((h) => h.id === dest)?.name ?? "";
  return (
    <div className="space-y-4">
      <section
        aria-label="Transferir contatos"
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 text-dense"
      >
        <span className="font-semibold text-heading">Transferir todos os contatos para</span>
        <NativeSelect
          aria-label="Hunter de destino"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
        >
          <option value="">Escolha o hunter…</option>
          {hunters
            .filter((h) => h.id !== hunter.id)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="secondary"
          disabled={!dest || !hunter.total}
          onClick={() =>
            ask({
              title: `Transferir contatos de ${hunter.name}`,
              desc: `Os ${hunter.total} contatos de ${hunter.name} passam para ${destName}, com todo o histórico (envios, ATs, propostas e vendas). Todos os leads e ATs vinculados passarão a pontuar para ${destName} nos períodos ainda não encerrados. Placares já encerrados não mudam.`,
              word: "TRANSFERIR",
              action: "Transferir",
              run: async () => {
                const r = await transfer({
                  data: { fromId: hunter.id, toId: dest, confirm: "TRANSFERIR" },
                });
                toast.success(`${r.moved} contatos transferidos para ${destName}`);
                await qc.invalidateQueries();
              },
            })
          }
        >
          Transferir
        </Button>
      </section>

      <section
        aria-label="Zona de risco"
        className="space-y-3 rounded-lg border border-destructive-border p-4"
      >
        <p className="text-dense font-semibold text-destructive-text">Zona de risco</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="destructive"
            size="sm"
            disabled={!hunter.total}
            onClick={() =>
              ask({
                title: `Limpar contatos de ${hunter.name}`,
                desc: `Todos os ${hunter.total} contatos deste hunter serão excluídos.`,
                word: "EXCLUIR",
                run: () => deleter({ mode: "hunter", hunterId: hunter.id }),
              })
            }
          >
            Limpar todos deste hunter
          </Button>
          <Button
            size="sm"
            variant="destructive-ghost"
            disabled={hunter.total > 0}
            title={hunter.total > 0 ? "Transfira ou exclua os contatos antes" : ""}
            onClick={() =>
              ask({
                title: `Excluir a conta de ${hunter.name}`,
                desc: `A conta ${hunter.email} será apagada e o e-mail ficará livre para um novo cadastro. Placares já encerrados mantêm o nome dele.`,
                word: "EXCLUIR",
                run: async () => {
                  await del({ data: { id: hunter.id, confirm: "EXCLUIR" } });
                  toast.success("Conta excluída");
                  onDeleted();
                  await qc.invalidateQueries();
                },
              })
            }
          >
            Excluir hunter
          </Button>
        </div>
        {hunter.total > 0 && (
          <p className="text-caption text-muted-foreground">
            Para excluir este hunter, transfira ou exclua os {hunter.total} contatos dele antes.
          </p>
        )}
      </section>
    </div>
  );
}
