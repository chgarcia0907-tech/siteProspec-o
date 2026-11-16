import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { adminDeleteContacts, adminStatus, adminVerify } from "@/lib/admin.functions";
import { HolidaysAdmin } from "@/components/configuracoes/HolidaysAdmin";
import { useConfirm } from "@/components/useConfirm";
import { Lock } from "lucide-react";

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

/**
 * Área do administrador (senha): feriados e, isolada numa zona de risco no fim, a exclusão de
 * contatos, que pede a palavra EXCLUIR no diálogo padrão (useConfirm).
 */
export function AdminArea() {
  const qc = useQueryClient();
  const status = useServerFn(adminStatus);
  const verify = useServerFn(adminVerify);
  const del = useServerFn(adminDeleteContacts);
  const { data: st } = useQuery({ queryKey: ["admin_status"], queryFn: () => status() });
  const { ask, dialog } = useConfirm();

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [counts, setCounts] = useState<{ mine: number; all: number } | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [busy, setBusy] = useState(false);

  const lock = () => {
    setUnlocked(false);
    setPassword("");
    setCounts(null);
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
    const r = await del({ data: { password, scope } });
    if (r.status === "ok") {
      toast.success(`${r.deleted} contatos excluídos`);
      qc.invalidateQueries();
      const v = await verify({ data: { password } });
      if (v.status === "ok") setCounts(v.counts);
    } else {
      toast.error(failMsg(r));
      lock();
    }
  }

  const n = scope === "mine" ? (counts?.mine ?? 0) : (counts?.all ?? 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-subtle-foreground" strokeWidth={1.75} aria-hidden />
            Área do administrador
          </CardTitle>
          <CardDescription>
            Feriados e exclusão de contatos. Exige a senha de administrador.
          </CardDescription>
        </div>
        {unlocked && (
          <Button variant="ghost" size="sm" onClick={lock}>
            Sair da área do administrador
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {st && !st.configured ? (
          <p className="text-dense text-muted-foreground">
            Senha de administrador ainda não configurada
          </p>
        ) : !unlocked ? (
          <form
            className="flex max-w-md gap-2"
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
            <Button type="submit" variant="secondary" disabled={!password || busy}>
              Entrar
            </Button>
          </form>
        ) : (
          <>
            <HolidaysAdmin
              password={password}
              onFail={(r) => {
                toast.error(failMsg(r));
                lock();
              }}
            />
            <section
              aria-label="Zona de risco"
              className="space-y-3 rounded-lg border border-destructive-border p-4"
            >
              <div>
                <p className="text-dense font-semibold text-destructive-text">Zona de risco</p>
                <p className="text-dense text-muted-foreground">
                  Excluir contatos apaga também as datas e o funil deles. Não dá para desfazer.
                </p>
              </div>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="mine" id="sc-mine" />
                  <Label htmlFor="sc-mine">Apenas meus contatos ({counts?.mine ?? 0})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="sc-all" />
                  <Label htmlFor="sc-all">Contatos de TODOS os hunters ({counts?.all ?? 0})</Label>
                </div>
              </RadioGroup>
              <Button
                variant="destructive"
                size="sm"
                disabled={n === 0}
                onClick={() =>
                  ask({
                    title: `Excluir ${n} contatos?`,
                    desc: `${n} contatos ${scope === "all" ? "de TODOS os hunters" : "seus"} serão excluídos permanentemente.`,
                    word: "EXCLUIR",
                    action: "Excluir contatos",
                    run: runDelete,
                  })
                }
              >
                Excluir contatos
              </Button>
            </section>
          </>
        )}
        {dialog}
      </CardContent>
    </Card>
  );
}
