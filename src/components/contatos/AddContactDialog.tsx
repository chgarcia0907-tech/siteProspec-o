import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CompanySelect } from "@/components/CompanySelect";
import { SectorSelect } from "@/components/SectorSelect";
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
import { useAddContact } from "@/hooks/useCadencia";
import { todayISO, type Contact } from "@/lib/cadencia";
import { manualAtError, manualAtRow, sameNameContacts, type ManualAtInput } from "@/lib/contatos";
import type { Company } from "@/lib/empresas";
import { errorMessage } from "@/lib/utils";

const empty = (): ManualAtInput => ({
  name: "",
  job_title: "",
  sector: "",
  phone: "",
  company_id: null,
  company: "",
  atDate: todayISO(),
});

/**
 * Botão e diálogo para cadastrar à mão um contato cuja AT foi marcada fora da cadência
 * (por e-mail, por exemplo). O contato entra como "respondeu" com a AT na data informada e
 * origem "outro canal", sem aparecer nas filas de envio.
 */
export function AddContactButton({
  companies,
  contacts,
}: {
  companies: readonly Company[];
  contacts: readonly Contact[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualAtInput>(empty);
  const add = useAddContact();
  const error = manualAtError(form);
  const duplicates = sameNameContacts(contacts, form.name);
  const set = (patch: Partial<ManualAtInput>) => setForm((f) => ({ ...f, ...patch }));

  function close() {
    setOpen(false);
    setForm(empty());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    add.mutate(manualAtRow(form), {
      onSuccess: () => {
        toast.success(`AT registrada para ${form.name.trim()}`);
        close();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Adicionar contato
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Adicionar contato</DialogTitle>
              <DialogDescription>
                Para uma AT marcada fora da cadência, como por e-mail. O contato entra como
                respondeu, com a AT na data informada e origem em outro canal.
              </DialogDescription>
            </DialogHeader>

            {duplicates.length > 0 && (
              <p
                role="alert"
                className="rounded-lg border border-warning-border bg-warning-soft/60 px-3 py-2 text-dense text-warning-text"
              >
                Já existe um contato com esse nome. Para não duplicar, marque a AT nele pelo
                “Avançar no funil”, escolhendo “Outro canal”.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome *" htmlFor="add-nome" className="col-span-2">
                <Input
                  id="add-nome"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Cargo na empresa" htmlFor="add-cargo">
                <Input
                  id="add-cargo"
                  value={form.job_title}
                  onChange={(e) => set({ job_title: e.target.value })}
                />
              </Field>
              <Field label="Área">
                <SectorSelect
                  value={form.sector}
                  onChange={(v) => set({ sector: v })}
                  className="w-full"
                />
              </Field>
              <Field label="Empresa" htmlFor="add-empresa">
                <div className="space-y-2">
                  {companies.length > 0 && (
                    <CompanySelect
                      companies={companies}
                      value={form.company_id}
                      onChange={(id) => set({ company_id: id })}
                      emptyLabel="Texto livre (sem cadastro)"
                      className="h-9 w-full text-dense"
                    />
                  )}
                  {!form.company_id && (
                    <Input
                      id="add-empresa"
                      placeholder="Nome da empresa"
                      value={form.company}
                      onChange={(e) => set({ company: e.target.value })}
                    />
                  )}
                </div>
              </Field>
              <Field label="Telefone/WhatsApp" htmlFor="add-tel">
                <Input
                  id="add-tel"
                  placeholder="(11) 90000-0000"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
              <Field label="Data da AT *" htmlFor="add-at">
                <Input
                  id="add-at"
                  type="date"
                  value={form.atDate}
                  onChange={(e) => set({ atDate: e.target.value })}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!!error || add.isPending}>
                Registrar AT
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
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
