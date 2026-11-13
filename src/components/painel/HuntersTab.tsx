import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleter, useHunters } from "@/hooks/usePainel";
import { painelContacts } from "@/lib/painel.functions";
import { cn } from "@/lib/utils";
import type { Ask } from "./useConfirm";
import { ContactTable } from "./ContactTable";
import { HunterActions } from "./HunterActions";

/** Aba "Hunters": lista de hunters e os contatos do hunter escolhido. */
export function HuntersTab({ ask }: { ask: Ask }) {
  const { data } = useHunters();
  const [hid, setHid] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const fn = useServerFn(painelContacts);
  const deleter = useDeleter();
  const contacts = useQuery({
    queryKey: ["painel_contacts", hid],
    enabled: !!hid,
    queryFn: () => fn({ data: { hunterId: hid, q: "" } }),
  });
  const hunter = data?.hunters.find((h) => h.id === hid);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = contacts.data?.rows ?? [];
    return s ? all.filter((r) => `${r.name} ${r.company}`.toLowerCase().includes(s)) : all;
  }, [contacts.data, q]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Hunters · {data?.total ?? "…"} contatos no total
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {data?.hunters.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setHid(h.id);
                setQ("");
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                hid === h.id && "bg-accent",
              )}
            >
              <span className="truncate">{h.name}</span>
              <span className="text-xs text-muted-foreground">{h.total}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-3">
        {!hunter ? (
          <p className="text-sm text-muted-foreground">
            Escolha um hunter para ver os contatos dele.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="font-semibold">{hunter.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hunter.email} · {hunter.total} contatos · {hunter.ats} ATs · {hunter.descartados}{" "}
                  descartados
                </p>
              </div>
              <Input
                className="ml-auto max-w-xs"
                placeholder="Buscar nome ou empresa"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
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
            </div>
            <HunterActions
              hunter={hunter}
              hunters={data?.hunters ?? []}
              ask={ask}
              onDeleted={() => setHid(null)}
            />
            {contacts.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <ContactTable rows={rows} ask={ask} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
