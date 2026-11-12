import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  adminDeleteContacts,
  adminSetCompetition,
  adminStatus,
  adminVerify,
} from "@/lib/admin.functions";
import { useCompetitionSettings } from "@/hooks/useCadencia";
import { HolidaysAdmin } from "@/components/HolidaysAdmin";

function failMsg(r: { status: string; remaining?: number; lockedUntil?: string }) {
  if (r.status === "not_configured") return "Senha de administrador ainda não configurada";
  if (r.status === "locked") {
    const t = r.lockedUntil
      ? new Date(r.lockedUntil).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "";
    return `Muitas tentativas erradas. Tente novamente após ${t}.`;
  }
  if (r.status === "wrong") return `Senha incorreta. Restam ${r.remaining} tentativas.`;
  return "Não foi possível concluir.";
}

export function AdminArea() {
  const qc = useQueryClient();
  const status = useServerFn(adminStatus);
  const verify = useServerFn(adminVerify);
  const del = useServerFn(adminDeleteContacts);
  const setComp = useServerFn(adminSetCompetition);
  const { data: st } = useQuery({ queryKey: ["admin_status"], queryFn: () => status() });
  const { data: comp } = useCompetitionSettings();

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [counts, setCounts] = useState<{ mine: number; all: number } | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [confirming, setConfirming] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startV = start ?? comp?.start_date ?? "2026-10-01";
  const endV = end ?? comp?.end_date ?? "";

  const lock = () => {
    setUnlocked(false);
    setPassword("");
    setCounts(null);
    setConfirming(false);
  };

  async function unlock() {
    setBusy(true);
    try {
      const r = await verify({ data: { password } });
      if (r.status === "ok") {
        setUnlocked(true);
        setCounts(r.counts);
      } else toast.error(failMsg(r));
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    setBusy(true);
    try {
      const r = await del({ data: { password, scope } });
      if (r.status === "ok") {
        toast.success(`${r.deleted} contatos excluídos`);
        qc.invalidateQueries();
        const v = await verify({ data: { password } });
        if (v.status === "ok") setCounts(v.counts);
        setConfirming(false);
      } else {
        toast.error(failMsg(r));
        lock();
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveComp() {
    setBusy(true);
    try {
      const r = await setComp({ data: { password, start: startV, end: endV || null } });
      if (r.status === "ok") {
        toast.success("Período da competição salvo");
        qc.invalidateQueries();
      } else if (r.status === "invalid") toast.error("A data de fim deve ser depois do início");
      else {
        toast.error(failMsg(r));
        lock();
      }
    } finally {
      setBusy(false);
    }
  }

  const n = scope === "mine" ? (counts?.mine ?? 0) : (counts?.all ?? 0);

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Área do administrador</CardTitle>
        <CardDescription>Exclusão de contatos, período da competição e feriados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {st && !st.configured ? (
          <p className="text-sm text-muted-foreground">
            Senha de administrador ainda não configurada
          </p>
        ) : !unlocked ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              unlock();
            }}
          >
            <Input
              type="password"
              aria-label="Senha de administrador"
              placeholder="Senha de administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" variant="outline" disabled={!password || busy}>
              Entrar
            </Button>
          </form>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">Excluir contatos</p>
              <RadioGroup
                value={scope}
                onValueChange={(v) => {
                  setScope(v as "mine" | "all");
                  setConfirming(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="mine" id="sc-mine" />
                  <Label htmlFor="sc-mine">Apenas meus contatos ({counts?.mine ?? 0})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="sc-all" />
                  <Label htmlFor="sc-all">Contatos de TODOS os hunters ({counts?.all ?? 0})</Label>
                </div>
              </RadioGroup>
              {!confirming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={n === 0}
                  onClick={() => setConfirming(true)}
                >
                  Excluir contatos
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <span>
                    {n} contatos {scope === "all" ? "de TODOS os hunters" : "seus"} serão excluídos
                    permanentemente.
                  </span>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={runDelete}>
                    Confirmar exclusão
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Período da competição</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="c-start">Início</Label>
                  <Input
                    id="c-start"
                    type="date"
                    value={startV}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-end">Fim (opcional)</Label>
                  <Input
                    id="c-end"
                    type="date"
                    value={endV}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                <Button size="sm" disabled={busy || !startV} onClick={saveComp}>
                  Salvar período
                </Button>
              </div>
            </div>
            <HolidaysAdmin
              password={password}
              onFail={(r) => {
                toast.error(failMsg(r));
                lock();
              }}
            />
            <Button variant="ghost" size="sm" onClick={lock}>
              Sair da área do administrador
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
