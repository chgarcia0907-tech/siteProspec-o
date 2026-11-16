import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHunters } from "@/hooks/usePainel";
import { painelContacts } from "@/lib/painel.functions";
import { cn } from "@/lib/utils";
import type { Ask } from "@/components/useConfirm";
import { ContactTable } from "./ContactTable";
import { HunterActions } from "./HunterActions";

/** Aba "Hunters": lista de hunters e os contatos do hunter escolhido. */
export function HuntersTab({ ask }: { ask: Ask }) {
  const { data } = useHunters();
  const [hid, setHid] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const fn = useServerFn(painelContacts);
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
    <div className="grid grid-cols-[260px_minmax(0,1fr)] items-start gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Hunters · {data?.total ?? "…"} contatos no total</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 p-2 pt-0">
          {data?.hunters.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setHid(h.id);
                setQ("");
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-dense transition-colors hover:bg-control",
                hid === h.id && "bg-primary-soft text-heading",
              )}
            >
              <span className="truncate">{h.name}</span>
              <span className="text-caption text-muted-foreground tabular-nums">{h.total}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        {!hunter ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
            <p className="text-card-title font-semibold text-heading">Escolha um hunter</p>
            <p className="text-dense text-muted-foreground">
              Escolha um hunter para ver os contatos dele.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <h2 className="text-section font-semibold">{hunter.name}</h2>
                <p className="text-dense text-muted-foreground">
                  {hunter.email} · {hunter.total} contatos · {hunter.ats} ATs · {hunter.descartados}{" "}
                  descartados
                </p>
              </div>
              <Input
                className="ml-auto max-w-xs"
                aria-label="Buscar contatos do hunter"
                placeholder="Buscar nome ou empresa"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {contacts.isLoading ? (
              <p className="text-dense text-muted-foreground">Carregando…</p>
            ) : (
              <ContactTable rows={rows} ask={ask} />
            )}
            <HunterActions
              hunter={hunter}
              hunters={data?.hunters ?? []}
              ask={ask}
              onDeleted={() => setHid(null)}
            />
          </>
        )}
      </div>
    </div>
  );
}
