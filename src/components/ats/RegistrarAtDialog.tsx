import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRegistrarAt, type MembroTime } from "@/hooks/useAts";
import {
  AT_CANAIS,
  contatoDaAt,
  formDaFicha,
  lerFicha,
  NOVA_AT_VAZIA,
  novaAtErro,
  novaAtLinha,
  type AtCanal,
  type NovaAtForm,
} from "@/lib/ats";
import { todayISO, type Contact } from "@/lib/cadencia";
import { errorMessage } from "@/lib/utils";

/**
 * Botão "Registrar AT" e o formulário. Colar a Ficha de AT do WhatsApp preenche os campos (o que
 * a ficha não deixa claro fica em branco). O contato do hunter é ligado pelo nome e pela empresa,
 * e dele vem a mensagem que converteu.
 */
export function RegistrarAtButton({
  userId,
  hunterLogin,
  time,
  contatos,
}: {
  userId: string;
  hunterLogin: string | null;
  time: readonly MembroTime[];
  contatos: readonly Contact[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NovaAtForm>(NOVA_AT_VAZIA);
  const [aviso, setAviso] = useState<string | null>(null);
  const registrar = useRegistrarAt();
  const erro = novaAtErro(form);
  const set = (p: Partial<NovaAtForm>) => setForm((f) => ({ ...f, ...p }));
  const cns = time.filter((p) => p.papel === "cn" && p.ativo);
  const contatoId = contatoDaAt(form, contatos);
  const contato = contatos.find((c) => c.id === contatoId) ?? null;

  function fechar() {
    setOpen(false);
    setForm(NOVA_AT_VAZIA);
    setAviso(null);
  }

  function colarFicha(texto: string) {
    const ficha = lerFicha(texto, todayISO());
    if (!ficha) {
      set({ ficha: texto });
      setAviso(texto.trim() ? "O texto não começa com “Ficha de AT -”." : null);
      return;
    }
    if (ficha.tipo === "remarcacao") {
      set({ ficha: texto });
      setAviso("Esta é uma Ficha de Remarcação: abra a AT na tabela e use “Remarcar”.");
      return;
    }
    const novo = formDaFicha(form, ficha, time);
    setForm(novo);
    const faltas = [
      !ficha.agendada && "a data e o horário",
      !novo.cn && ficha.cnMarcacao && `o CN (“@${ficha.cnMarcacao}”)`,
      !ficha.canal && "o canal",
    ].filter(Boolean);
    setAviso(faltas.length ? `Confira ${faltas.join(", ")}: a ficha não deixou claro.` : null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (erro) return;
    const linha = novaAtLinha(form, { userId, hunterLogin, contato });
    registrar.mutate(linha, {
      onSuccess: () => {
        toast.success(`AT de ${linha.empresa} registrada`);
        fechar();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Registrar AT
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : fechar())}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <form onSubmit={enviar} className="space-y-5" aria-label="Registrar AT">
            <DialogHeader>
              <DialogTitle>Registrar AT</DialogTitle>
              <DialogDescription>
                Cole a Ficha de AT do grupo do WhatsApp para preencher os campos, ou preencha à mão.
                A AT fica no seu nome.
              </DialogDescription>
            </DialogHeader>

            <Campo label="Ficha de AT (opcional)" htmlFor="at-ficha">
              <Textarea
                id="at-ficha"
                rows={4}
                placeholder="Ficha de AT - Empresa…"
                value={form.ficha}
                onChange={(e) => colarFicha(e.target.value)}
                className="text-dense"
              />
            </Campo>
            {aviso && (
              <p
                role="status"
                className="rounded-lg border border-warning-border bg-warning-soft/60 px-3 py-2 text-dense text-warning-text"
              >
                {aviso}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Empresa *" htmlFor="at-empresa">
                <Input
                  id="at-empresa"
                  value={form.empresa}
                  onChange={(e) => set({ empresa: e.target.value })}
                />
              </Campo>
              <Campo label="Prospect *" htmlFor="at-prospect">
                <Input
                  id="at-prospect"
                  value={form.prospect}
                  onChange={(e) => set({ prospect: e.target.value })}
                />
              </Campo>
              <Campo label="Cargo" htmlFor="at-cargo">
                <Input
                  id="at-cargo"
                  value={form.cargo}
                  onChange={(e) => set({ cargo: e.target.value })}
                />
              </Campo>
              <Campo label="Setor da empresa" htmlFor="at-setor">
                <Input
                  id="at-setor"
                  value={form.setor}
                  onChange={(e) => set({ setor: e.target.value })}
                />
              </Campo>
              <Campo label="Data e horário da AT *" htmlFor="at-quando">
                <Input
                  id="at-quando"
                  type="datetime-local"
                  value={form.quando}
                  onChange={(e) => set({ quando: e.target.value })}
                />
              </Campo>
              <Campo label="Canal" htmlFor="at-canal">
                <NativeSelect
                  id="at-canal"
                  value={form.canal}
                  onChange={(e) => set({ canal: e.target.value as AtCanal | "" })}
                  className="w-full"
                >
                  <option value="">Escolha</option>
                  {AT_CANAIS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo label="CN" htmlFor="at-cn">
                <NativeSelect
                  id="at-cn"
                  value={form.cn}
                  onChange={(e) => set({ cn: e.target.value })}
                  className="w-full"
                >
                  <option value="">Escolha</option>
                  {cns.map((p) => (
                    <option key={p.login} value={p.login}>
                      {p.nome}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo label="LinkedIn" htmlFor="at-linkedin">
                <Input
                  id="at-linkedin"
                  value={form.linkedin}
                  onChange={(e) => set({ linkedin: e.target.value })}
                />
              </Campo>
              <Campo label="Por que prospectou" htmlFor="at-motivo" className="col-span-2">
                <Textarea
                  id="at-motivo"
                  rows={3}
                  value={form.motivo}
                  onChange={(e) => set({ motivo: e.target.value })}
                  className="text-dense"
                />
              </Campo>
            </div>

            <p className="text-caption text-subtle-foreground">
              {contato
                ? `Ligada ao seu contato ${contato.name}${contato.company ? ` (${contato.company})` : ""}.`
                : "Nenhum contato seu com esse nome e empresa: a AT fica sem contato ligado."}
            </p>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!!erro || registrar.isPending} title={erro ?? ""}>
                Registrar AT
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Campo({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="text-caption font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
