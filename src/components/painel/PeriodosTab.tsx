import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addMembers, allocateMembers, closePeriod, createPeriod, deleteGroupOrSub, periodsOverview, removeMembers, saveGroup, saveSubgroup,
} from "@/lib/periodos.functions";
import { spParts } from "@/lib/cadencia";

export type Pending = { title: string; desc: string; word?: string; action?: string; run: () => Promise<void> } | null;
export const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Não foi possível concluir");

export function useOverview() {
  const fn = useServerFn(periodsOverview);
  return useQuery({ queryKey: ["periods_overview"], queryFn: () => fn() });
}
type Overview = NonNullable<ReturnType<typeof useOverview>["data"]>;

const fmtDate = (ts: string) => new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function PeriodosTab({ ask }: { ask: (p: Pending) => void }) {
  const { data, isLoading } = useOverview();
  const [pid, setPid] = useState<string | null>(null);
  const active = data?.periods.find((p) => p.status === "active");
  const period = data?.periods.find((p) => p.id === (pid ?? active?.id ?? data?.periods[0]?.id));
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="sel-period">Período</Label>
          <select id="sel-period" className={selectCls} value={period?.id ?? ""} onChange={(e) => setPid(e.target.value)}>
            {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === "active" ? " (ativo)" : " (encerrado)"}</option>)}
          </select>
        </div>
        <NewPeriod disabledReason={active ? `Encerre "${active.name}" para criar outro período.` : null} onCreated={setPid} />
      </div>
      {period && <PeriodDetail key={period.id} data={data} period={period} ask={ask} />}
    </div>
  );
}

function NewPeriod({ disabledReason, onCreated }: { disabledReason: string | null; onCreated: (id: string) => void }) {
  const fn = useServerFn(createPeriod);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(spParts().iso);
  const [kind, setKind] = useState<"competicao" | "ciclo">("ciclo");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" disabled={!!disabledReason} title={disabledReason ?? ""} onClick={() => setOpen(true)}>Novo período</Button>
      {disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo período</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="np-name">Nome</Label><Input id="np-name" placeholder="Ex.: Hunters 26.2" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="np-start">Início</Label><Input id="np-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1">
              <Label htmlFor="np-kind">Tipo</Label>
              <select id="np-kind" className={`${selectCls} w-full`} value={kind} onChange={(e) => setKind(e.target.value as "competicao" | "ciclo")}>
                <option value="ciclo">Ciclo da equipe (ranking semanal e geral)</option>
                <option value="competicao">Competição (estilo Hacka)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {kind === "ciclo"
                  ? "Só os membros entram no ranking, e contam todos os contatos deles pela data de cada etapa (leads antigos que avançam também pontuam)."
                  : "Contam só os contatos importados durante o período."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Novos cadastros entram automaticamente neste período, sem grupo. Membros já existentes você adiciona depois.</p>
          </div>
          <DialogFooter>
            <Button disabled={busy || !name.trim() || !start} onClick={async () => {
              setBusy(true);
              try {
                const r = await fn({ data: { name: name.trim(), start, kind } });
                toast.success("Período criado");
                await qc.invalidateQueries();
                onCreated(r.id); setOpen(false); setName("");
              } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
            }}>Criar período</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PeriodDetail({ data, period, ask }: { data: Overview; period: Overview["periods"][number]; ask: (p: Pending) => void }) {
  const qc = useQueryClient();
  const close = useServerFn(closePeriod);
  const sGroup = useServerFn(saveGroup);
  const sSub = useServerFn(saveSubgroup);
  const delGS = useServerFn(deleteGroupOrSub);
  const alloc = useServerFn(allocateMembers);
  const remove = useServerFn(removeMembers);

  const groups = data.groups.filter((g) => g.period_id === period.id);
  const subsOf = (gid: string) => data.subgroups.filter((s) => s.group_id === gid);
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  const sName = new Map(data.subgroups.map((s) => [s.id, s.name]));
  const members = data.members.filter((m) => m.period_id === period.id);
  const unallocated = members.filter((m) => !m.group_id);
  const closed = period.status === "closed";

  const [newGroup, setNewGroup] = useState("");
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [onlyUnalloc, setOnlyUnalloc] = useState(false);
  const [g, setG] = useState("");
  const [s, setS] = useState("");
  const [adding, setAdding] = useState(false);
  const [endDate, setEndDate] = useState(spParts().iso);
  useEffect(() => setS(""), [g]);

  const shown = onlyUnalloc ? unallocated : members;
  const refresh = () => qc.invalidateQueries();
  const run = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); toast.success(ok); await refresh(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
          <span className="font-semibold">{period.name}</span>
          <Badge variant={closed ? "secondary" : "default"}>{closed ? "Encerrado" : "Ativo"}</Badge>
          <Badge variant="outline">{period.kind === "ciclo" ? "Ciclo" : "Competição"}</Badge>
          <span className="text-muted-foreground">
            Início {fmtDate(period.started_at)}{period.closed_at ? ` · Encerrado em ${new Date(period.closed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""} · {members.length} membros
          </span>
          {!closed && (
            <span className="ml-auto flex items-center gap-2">
              <Label htmlFor="end-date" className="text-xs text-muted-foreground">Conta até</Label>
              <Input id="end-date" type="date" className="h-8 w-[150px]" value={endDate} max={spParts().iso} onChange={(e) => setEndDate(e.target.value)} />
            </span>
          )}
          {!closed && (
            <Button size="sm" variant="destructive" disabled={!endDate} onClick={() => ask({
              title: `Encerrar e consolidar "${period.name}"`,
              desc: `O placar oficial será congelado com os resultados até ${endDate.split("-").reverse().join("/")}. Os contatos continuam rodando a cadência normalmente, e os avanços posteriores seguem contando para a maturação desta safra, mas não alteram o placar oficial.`,
              word: period.name,
              action: "Encerrar período",
              run: async () => {
                const r = await close({ data: { id: period.id, confirmName: period.name, end: endDate } });
                toast.success(`Período encerrado · placar congelado para ${r.hunters} hunters`);
                await refresh();
              },
            })}>Encerrar e consolidar</Button>
          )}
        </CardContent>
      </Card>

      {unallocated.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <span className="font-medium">{unallocated.length} {unallocated.length === 1 ? "membro aguardando" : "membros aguardando"} alocação em grupo</span>
          <Button size="sm" variant="outline" onClick={() => setOnlyUnalloc(true)}>Mostrar</Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Grupos e subgrupos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {groups.length === 0 && <p className="text-xs text-muted-foreground">Nenhum grupo criado neste período.</p>}
            {groups.map((gr) => (
              <div key={gr.id} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{gr.name}</span>
                  <span className="text-xs text-muted-foreground">{members.filter((m) => m.group_id === gr.id).length} membros</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 text-destructive" onClick={() => ask({
                    title: `Excluir grupo "${gr.name}"`,
                    desc: "Os subgrupos dele também serão excluídos. Os membros e os contatos continuam intactos e voltam para \"Sem grupo\".",
                    run: async () => { await delGS({ data: { kind: "group", id: gr.id } }); toast.success("Grupo excluído"); await refresh(); },
                  })}>Excluir</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {subsOf(gr.id).map((sg) => (
                    <Badge key={sg.id} variant="secondary" className="gap-1">
                      {sg.name}
                      <button aria-label={`Excluir subgrupo ${sg.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => ask({
                        title: `Excluir subgrupo "${sg.name}"`,
                        desc: "Os membros continuam no grupo, apenas ficam sem subgrupo.",
                        run: async () => { await delGS({ data: { kind: "subgroup", id: sg.id } }); toast.success("Subgrupo excluído"); await refresh(); },
                      })}>×</button>
                    </Badge>
                  ))}
                </div>
                <form className="flex gap-1" onSubmit={async (e) => {
                  e.preventDefault();
                  const n = (newSub[gr.id] ?? "").trim();
                  if (!n) return;
                  await run(() => sSub({ data: { groupId: gr.id, name: n } }), "Subgrupo criado");
                  setNewSub((x) => ({ ...x, [gr.id]: "" }));
                }}>
                  <Input className="h-8" placeholder="Novo subgrupo (opcional)" value={newSub[gr.id] ?? ""} onChange={(e) => setNewSub((x) => ({ ...x, [gr.id]: e.target.value }))} />
                  <Button size="sm" variant="outline" type="submit">Criar</Button>
                </form>
              </div>
            ))}
            <form className="flex gap-1" onSubmit={async (e) => {
              e.preventDefault();
              if (!newGroup.trim()) return;
              await run(() => sGroup({ data: { periodId: period.id, name: newGroup.trim() } }), "Grupo criado");
              setNewGroup("");
            }}>
              <Input className="h-8" placeholder="Novo grupo" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
              <Button size="sm" type="submit">Criar grupo</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
            <CardTitle className="text-sm">Membros do período</CardTitle>
            <label className="flex items-center gap-1 text-xs"><Checkbox checked={onlyUnalloc} onCheckedChange={(v) => setOnlyUnalloc(!!v)} /> Só sem grupo</label>
            <Button size="sm" className="ml-auto" variant="outline" onClick={() => setAdding(true)}>Adicionar membros existentes</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sel.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
                <span>{sel.size} selecionados</span>
                <select aria-label="Grupo" className={selectCls} value={g} onChange={(e) => setG(e.target.value)}>
                  <option value="">Sem grupo</option>
                  {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select aria-label="Subgrupo" className={selectCls} value={s} disabled={!g || !subsOf(g).length} onChange={(e) => setS(e.target.value)}>
                  <option value="">Sem subgrupo</option>
                  {g && subsOf(g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <Button size="sm" onClick={async () => {
                  await run(() => alloc({ data: { periodId: period.id, userIds: [...sel], groupId: g || null, subgroupId: s || null } }), "Alocação salva");
                  setSel(new Set());
                }}>Aplicar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => ask({
                  title: "Remover do período",
                  desc: `${sel.size} membros sairão de "${period.name}". As contas e os contatos deles não são apagados.`,
                  action: "Remover",
                  run: async () => { await remove({ data: { periodId: period.id, userIds: [...sel] } }); setSel(new Set()); toast.success("Membros removidos do período"); await refresh(); },
                })}>Remover do período</Button>
              </div>
            )}
            <div className="overflow-x-auto rounded-md border">
              <table className="table-dense w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 p-2"><Checkbox checked={shown.length > 0 && shown.every((m) => sel.has(m.user_id))} onCheckedChange={(v) => setSel(v ? new Set(shown.map((m) => m.user_id)) : new Set())} aria-label="Selecionar todos" /></th>
                    <th className="p-2">Membro</th><th className="p-2">Grupo</th><th className="p-2">Subgrupo</th><th className="p-2">Contatos no período</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2"><Checkbox checked={sel.has(m.user_id)} onCheckedChange={() => setSel((x) => { const n = new Set(x); n.has(m.user_id) ? n.delete(m.user_id) : n.add(m.user_id); return n; })} aria-label={`Selecionar ${m.name}`} /></td>
                      <td className="p-2 font-medium">{m.name}</td>
                      <td className="p-2">{m.group_id ? gName.get(m.group_id) : <Badge variant="outline" className="text-muted-foreground">Sem grupo</Badge>}</td>
                      <td className="p-2 text-muted-foreground">{m.subgroup_id ? sName.get(m.subgroup_id) : "—"}</td>
                      <td className="p-2">{m.contacts}</td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhum membro.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <AddMembersDialog open={adding} onOpenChange={setAdding} data={data} periodId={period.id} groups={groups} subsOf={subsOf} />
    </div>
  );
}

function AddMembersDialog({ open, onOpenChange, data, periodId, groups, subsOf }: {
  open: boolean; onOpenChange: (o: boolean) => void; data: Overview; periodId: string;
  groups: Overview["groups"]; subsOf: (gid: string) => Overview["subgroups"];
}) {
  const fn = useServerFn(addMembers);
  const qc = useQueryClient();
  const others = data.periods.filter((p) => p.id !== periodId); // já vem do mais recente ao mais antigo
  const [source, setSource] = useState<string>("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [g, setG] = useState("");
  const [s, setS] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSource(others[0]?.id ?? "all"); setSel(new Set()); setQ(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setS(""), [g]);

  const already = new Set(data.members.filter((m) => m.period_id === periodId).map((m) => m.user_id));
  const list = useMemo(() => {
    const base = source === "all"
      ? data.hunters.map((h) => ({ id: h.id, name: h.name, info: h.email }))
      : data.members.filter((m) => m.period_id === source).map((m) => {
          const gn = data.groups.find((x) => x.id === m.group_id)?.name;
          const sn = data.subgroups.find((x) => x.id === m.subgroup_id)?.name;
          return { id: m.user_id, name: m.name, info: [gn, sn].filter(Boolean).join(" · ") || "Sem grupo" };
        });
    const t = q.trim().toLowerCase();
    return base.filter((x) => !already.has(x.id) && (!t || x.name.toLowerCase().includes(t)));
  }, [source, q, data, periodId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Adicionar membros existentes</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="am-src">1. Membros de qual período?</Label>
            <select id="am-src" className={`${selectCls} w-full`} value={source} onChange={(e) => { setSource(e.target.value); setSel(new Set()); }}>
              {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="all">Todos os membros cadastrados</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>2. Selecione os membros</Label>
            <div className="flex gap-2">
              <Input placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => setSel(sel.size === list.length ? new Set() : new Set(list.map((x) => x.id)))}>
                {sel.size === list.length && list.length ? "Desmarcar todos" : `Selecionar todos (${list.length})`}
              </Button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {list.map((x) => (
                <label key={x.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sel.has(x.id)} onCheckedChange={() => setSel((c) => { const n = new Set(c); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n; })} />
                  <span>{x.name}</span><span className="text-xs text-muted-foreground">{x.info}</span>
                </label>
              ))}
              {!list.length && <p className="text-xs text-muted-foreground">Ninguém para adicionar (todos já estão neste período).</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label>3. Alocar em (opcional)</Label>
            <div className="flex gap-2">
              <select aria-label="Grupo" className={selectCls} value={g} onChange={(e) => setG(e.target.value)}>
                <option value="">Sem grupo</option>
                {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <select aria-label="Subgrupo" className={selectCls} value={s} disabled={!g || !subsOf(g).length} onChange={(e) => setS(e.target.value)}>
                <option value="">Sem subgrupo</option>
                {g && subsOf(g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy || !sel.size} onClick={async () => {
            setBusy(true);
            try {
              const r = await fn({ data: { periodId, userIds: [...sel], groupId: g || null, subgroupId: s || null } });
              toast.success(`${r.added} membros adicionados`);
              await qc.invalidateQueries();
              onOpenChange(false);
            } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
          }}>Adicionar {sel.size || ""} selecionados</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
