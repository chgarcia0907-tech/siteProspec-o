import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { painelContacts, painelDelete, painelHunters, painelIsAdmin, painelSetPeriod } from "@/lib/painel.functions";
import { deleteHunter, transferContacts } from "@/lib/periodos.functions";
import { getCompetition } from "@/lib/admin.functions";
import { STATUS_LABEL, addDaysISO, formatBR, spParts } from "@/lib/cadencia";
import { mondayOf } from "@/lib/competition";
import { PeriodosTab, selectCls, type Pending } from "@/components/painel/PeriodosTab";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — Cadência Outbound" },
      { name: "description", content: "Acompanhe hunters, competição e contatos de toda a equipe." },
      { property: "og:title", content: "Painel do administrador — Cadência Outbound" },
      { property: "og:description", content: "Acompanhe hunters, competição e contatos de toda a equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

type Row = { id: string; user_id: string; name: string; headline: string; company: string; phone: string; status: string; connected_at: string | null; created_at: string; atividades?: string[] };

function Painel() {
  const isAdmin = useServerFn(painelIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["painel_admin"], queryFn: () => isAdmin() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.admin)
    return (
      <p className="text-sm text-muted-foreground">
        Acesso restrito ao administrador. <Link to="/hoje" className="underline">Voltar</Link>
      </p>
    );
  return <PainelAdmin />;
}

function PainelAdmin() {
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = (p: Pending) => { setTyped(""); setPending(p); };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Painel do administrador</h1>
      <Tabs defaultValue="hunters">
        <TabsList>
          <TabsTrigger value="hunters">Hunters</TabsTrigger>
          <TabsTrigger value="periodos">Períodos e grupos</TabsTrigger>
          <TabsTrigger value="competicao">Competição</TabsTrigger>
          <TabsTrigger value="busca">Busca geral</TabsTrigger>
        </TabsList>
        <TabsContent value="hunters"><HuntersTab ask={ask} /></TabsContent>
        <TabsContent value="periodos"><PeriodosTab ask={ask} /></TabsContent>
        <TabsContent value="competicao"><CompTab /></TabsContent>
        <TabsContent value="busca"><BuscaTab ask={ask} /></TabsContent>
      </Tabs>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.desc} Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.word && (
            <div className="space-y-1">
              <Label htmlFor="conf">Digite <strong>{pending.word}</strong> para confirmar</Label>
              <Input id="conf" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy || (!!pending?.word && typed.trim() !== pending.word && typed.trim().toUpperCase() !== pending.word)}
              onClick={async (e) => {
                e.preventDefault();
                if (!pending) return;
                setBusy(true);
                try { await pending.run(); setPending(null); }
                catch (err) { toast.error(err instanceof Error && err.message ? err.message : "Não foi possível concluir"); }
                finally { setBusy(false); }
              }}
            >
              {pending?.action ?? "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function useDeleter() {
  const del = useServerFn(painelDelete);
  const qc = useQueryClient();
  return async (input: { mode: "ids"; ids: string[] } | { mode: "hunter"; hunterId: string }) => {
    const r = await del({ data: input });
    toast.success(`${r.deleted} contatos excluídos`);
    qc.invalidateQueries();
  };
}

function ContactTable({ rows, names, ask, onDeleted }: { rows: Row[]; names?: Map<string, string>; ask: (p: Pending) => void; onDeleted?: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const deleter = useDeleter();
  useEffect(() => setSel(new Set()), [rows]);
  const all = rows.length > 0 && sel.size === rows.length;
  const hasAct = rows.some((r) => r.atividades?.length);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">Nenhum contato.</p>;
  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
          <span>{sel.size} selecionados</span>
          <Button size="sm" variant="destructive" onClick={() => ask({
            title: "Excluir selecionados",
            desc: `${sel.size} contatos serão excluídos permanentemente.`,
            run: async () => { await deleter({ mode: "ids", ids: [...sel] }); onDeleted?.(); },
          })}>Excluir selecionados</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="table-dense w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 p-2"><Checkbox checked={all} onCheckedChange={(v) => setSel(v ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Selecionar todos" /></th>
              {names && <th className="p-2">Hunter</th>}
              <th className="p-2">Nome</th><th className="p-2">Cargo</th><th className="p-2">Empresa</th>
              <th className="p-2">Telefone</th><th className="p-2">Situação</th>{hasAct && <th className="p-2">Atividade no período</th>}<th className="p-2">Importado</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Selecionar ${r.name}`} /></td>
                {names && <td className="p-2 whitespace-nowrap">{names.get(r.user_id) ?? "—"}</td>}
                <td className="p-2 font-medium">{r.name}</td>
                <td className="max-w-[260px] truncate p-2 text-muted-foreground">{r.headline}</td>
                <td className="p-2">{r.company}</td>
                <td className="p-2 whitespace-nowrap">{r.phone}</td>
                <td className="p-2 whitespace-nowrap">{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status}</td>
                {hasAct && <td className="p-2 text-xs text-muted-foreground">{(r.atividades ?? []).map((a) => a.replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2")).join(" · ")}</td>}
                <td className="p-2 whitespace-nowrap">{formatBR(r.created_at.slice(0, 10))}</td>
                <td className="p-2">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => ask({
                    title: "Excluir contato",
                    desc: `"${r.name}" será excluído permanentemente.`,
                    run: async () => { await deleter({ mode: "ids", ids: [r.id] }); onDeleted?.(); },
                  })}>Excluir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useHunters() {
  const fn = useServerFn(painelHunters);
  return useQuery({ queryKey: ["painel_hunters"], queryFn: () => fn() });
}

function HuntersTab({ ask }: { ask: (p: Pending) => void }) {
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
    const all = (contacts.data?.rows ?? []) as Row[];
    return s ? all.filter((r) => `${r.name} ${r.company}`.toLowerCase().includes(s)) : all;
  }, [contacts.data, q]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Hunters · {data?.total ?? "…"} contatos no total</CardTitle></CardHeader>
        <CardContent className="space-y-1 p-2">
          {data?.hunters.map((h) => (
            <button key={h.id} onClick={() => { setHid(h.id); setQ(""); }}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${hid === h.id ? "bg-accent" : ""}`}>
              <span className="truncate">{h.name}</span>
              <span className="text-xs text-muted-foreground">{h.total}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-3">
        {!hunter ? (
          <p className="text-sm text-muted-foreground">Escolha um hunter para ver os contatos dele.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="font-semibold">{hunter.name}</p>
                <p className="text-xs text-muted-foreground">{hunter.email} · {hunter.total} contatos · {hunter.ats} ATs · {hunter.descartados} descartados</p>
              </div>
              <Input className="ml-auto max-w-xs" placeholder="Buscar nome ou empresa" value={q} onChange={(e) => setQ(e.target.value)} />
              <Button variant="destructive" size="sm" disabled={!hunter.total} onClick={() => ask({
                title: `Limpar contatos de ${hunter.name}`,
                desc: `Todos os ${hunter.total} contatos deste hunter serão excluídos.`,
                word: "EXCLUIR",
                run: () => deleter({ mode: "hunter", hunterId: hunter.id }),
              })}>Limpar todos deste hunter</Button>
            </div>
            <HunterActions hunter={hunter} hunters={data?.hunters ?? []} ask={ask} onDeleted={() => setHid(null)} />
            {contacts.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : <ContactTable rows={rows} ask={ask} />}
          </>
        )}
      </div>
    </div>
  );
}

type HunterInfo = { id: string; name: string; email: string; total: number };

function HunterActions({ hunter, hunters, ask, onDeleted }: { hunter: HunterInfo; hunters: HunterInfo[]; ask: (p: Pending) => void; onDeleted: () => void }) {
  const transfer = useServerFn(transferContacts);
  const del = useServerFn(deleteHunter);
  const qc = useQueryClient();
  const [dest, setDest] = useState("");
  useEffect(() => setDest(""), [hunter.id]);
  const destName = hunters.find((h) => h.id === dest)?.name ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="text-muted-foreground">Transferir todos os contatos para</span>
      <select aria-label="Hunter de destino" className={selectCls} value={dest} onChange={(e) => setDest(e.target.value)}>
        <option value="">Escolha o hunter…</option>
        {hunters.filter((h) => h.id !== hunter.id).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
      <Button size="sm" variant="outline" disabled={!dest || !hunter.total} onClick={() => ask({
        title: `Transferir contatos de ${hunter.name}`,
        desc: `Os ${hunter.total} contatos de ${hunter.name} passam para ${destName}, com todo o histórico (envios, ATs, propostas e vendas). Todos os leads e ATs vinculados passarão a pontuar para ${destName} nos períodos ainda não encerrados. Placares já encerrados não mudam.`,
        word: "TRANSFERIR",
        action: "Transferir",
        run: async () => {
          const r = await transfer({ data: { fromId: hunter.id, toId: dest, confirm: "TRANSFERIR" } });
          toast.success(`${r.moved} contatos transferidos para ${destName}`);
          await qc.invalidateQueries();
        },
      })}>Transferir</Button>
      <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={hunter.total > 0}
        title={hunter.total > 0 ? "Transfira ou exclua os contatos antes" : ""}
        onClick={() => ask({
          title: `Excluir a conta de ${hunter.name}`,
          desc: `A conta ${hunter.email} será apagada e o e-mail ficará livre para um novo cadastro. Placares já encerrados mantêm o nome dele.`,
          word: "EXCLUIR",
          run: async () => {
            await del({ data: { id: hunter.id, confirm: "EXCLUIR" } });
            toast.success("Conta excluída");
            onDeleted();
            await qc.invalidateQueries();
          },
        })}>Excluir hunter</Button>
      {hunter.total > 0 && <span className="w-full text-xs text-muted-foreground">Para excluir este hunter, transfira ou exclua os {hunter.total} contatos dele antes.</span>}
    </div>
  );
}

const WEEKDAYS_BACK = 26;
function weeksList(today: string) {
  const cur = mondayOf(today);
  return Array.from({ length: WEEKDAYS_BACK }, (_, i) => {
    const from = addDaysISO(cur, -7 * i);
    return { from, to: addDaysISO(from, 6) };
  });
}

function BuscaTab({ ask }: { ask: (p: Pending) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<{ from: string; to: string; label: string } | null>(null);
  const today = spParts().iso;
  const weeks = useMemo(() => weeksList(today), [today]);
  const fn = useServerFn(painelContacts);
  const { data: hs } = useHunters();
  const names = useMemo(() => new Map((hs?.hunters ?? []).map((h) => [h.id, h.name])), [hs]);
  const enabled = term.length >= 2 || !!range;
  const res = useQuery({
    queryKey: ["painel_busca", term, range?.from, range?.to],
    enabled,
    queryFn: () => fn({ data: { hunterId: null, q: term, from: range?.from ?? null, to: range?.to ?? null } }),
  });
  const day = (iso: string, label: string) => setRange({ from: iso, to: iso, label });
  const week = (from: string, label?: string) =>
    setRange({ from, to: addDaysISO(from, 6), label: label ?? `Semana de ${formatBR(from)} a ${formatBR(addDaysISO(from, 6))}` });
  const isDay = range && range.from === range.to;
  const n = res.data?.rows.length ?? 0;

  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <Input placeholder="Nome ou empresa (opcional com filtro de data)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Dia:</span>
        <Button size="sm" variant={isDay && range?.from === today ? "default" : "outline"} onClick={() => day(today, "Hoje")}>Hoje</Button>
        <Button size="sm" variant={isDay && range?.from === addDaysISO(today, -1) ? "default" : "outline"} onClick={() => day(addDaysISO(today, -1), "Ontem")}>Ontem</Button>
        <Input aria-label="Escolher dia" type="date" className="h-9 w-40" max={today} value={isDay ? range!.from : ""} onChange={(e) => e.target.value && day(e.target.value, formatBR(e.target.value))} />
        <span className="ml-3 text-muted-foreground">Semana (seg–dom):</span>
        <Button size="sm" variant={!isDay && range?.from === weeks[0]!.from ? "default" : "outline"} onClick={() => week(weeks[0]!.from, "Esta semana")}>Esta semana</Button>
        <Button size="sm" variant={!isDay && range?.from === weeks[1]!.from ? "default" : "outline"} onClick={() => week(weeks[1]!.from, "Semana passada")}>Semana passada</Button>
        <select aria-label="Escolher semana" className={selectCls} value={!isDay && range ? range.from : ""} onChange={(e) => e.target.value && week(e.target.value)}>
          <option value="">Escolher semana…</option>
          {weeks.map((w) => <option key={w.from} value={w.from}>{formatBR(w.from)} a {formatBR(w.to)}</option>)}
        </select>
        {range && <Button size="sm" variant="ghost" onClick={() => setRange(null)}>Limpar data</Button>}
      </div>
      {range && <p className="text-xs text-muted-foreground">Período: <strong>{range.label}</strong> ({formatBR(range.from)}{range.to !== range.from ? ` a ${formatBR(range.to)}` : ""}) · contatos importados ou com envio/avanço no funil nesse intervalo</p>}
      {enabled && (res.isLoading ? <p className="text-sm text-muted-foreground">Buscando…</p> : (
        <>
          <p className="text-xs text-muted-foreground">{n} resultados{n >= (range ? 2000 : 300) ? ` (mostrando os ${range ? 2000 : 300} primeiros)` : ""}</p>
          <ContactTable rows={(res.data?.rows ?? []) as Row[]} names={names} ask={ask} />
        </>
      ))}
    </div>
  );
}

function CompTab() {
  const fn = useServerFn(getCompetition);
  const save = useServerFn(painelSetPeriod);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["painel_comp"], queryFn: () => fn() });
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const s = start ?? data?.start ?? "";
  const e = end ?? data?.end ?? "";
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Período da competição</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label htmlFor="ps">Início</Label><Input id="ps" type="date" value={s} onChange={(x) => setStart(x.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pe">Fim (opcional)</Label><Input id="pe" type="date" value={e} onChange={(x) => setEnd(x.target.value)} /></div>
          <Button size="sm" disabled={!s} onClick={async () => {
            const r = await save({ data: { start: s, end: e || null } });
            if (r.ok) { toast.success("Período salvo"); qc.invalidateQueries(); } else toast.error("A data de fim deve ser depois do início");
          }}>Salvar período</Button>
          {data?.primeiroAt && <p className="text-xs text-muted-foreground">1º AT: {data.primeiroAt.hunter} em {formatBR(data.primeiroAt.data)}</p>}
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-md border">
        <table className="table-dense w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>{["#", "Hunter", "ATs", "Leads", "Propostas", "Aprov.", "Vendidos", "Funil", "Bônus", "Total", "LinkedIn 1", "Conversão", "Final"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data?.rows.map((r, i) => (
              <tr key={r.hunter_id} className={`border-t ${i < 3 ? "font-medium" : ""}`}>
                <td className="p-2">{i + 1}º</td><td className="p-2">{r.hunter}</td><td className="p-2">{r.ats}</td>
                <td className="p-2">{r.leads}</td><td className="p-2">{r.propostas}</td><td className="p-2">{r.aprovacoes}</td>
                <td className="p-2">{r.vendidos}</td><td className="p-2">{r.pontos_funil}</td>
                <td className="p-2">{r.bonus_primeiro_at + r.bonus_semanas}</td><td className="p-2">{r.total_pontos}</td>
                <td className="p-2">{r.linkedin1}</td><td className="p-2">{n(r.taxa_conversao)}%</td>
                <td className="p-2 font-semibold">{n(r.pontuacao_final)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!data?.weeks.length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Semanas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.weeks.map((w) => (
              <p key={w.inicio}>{formatBR(w.inicio)} a {formatBR(w.fim)}{w.parcial ? " (parcial)" : ""}: {w.vencedores.join(", ")} — {w.max} ATs</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
