import { CompanyGenderToggle } from "@/components/CompanyGender";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useContacts,
  useProfile,
  useSettings,
  useHolidays,
  useTemplates,
  useUpdateContact,
} from "@/hooks/useCadencia";
import {
  DEFAULT_OFFSETS,
  STEPS,
  computedStatus,
  formatBR,
  isActive,
  plannedDates,
  onlyDigits,
  renderTemplate,
  SECTORS,
  todayISO,
  whatsappLink,
  type Contact,
  type StepDef,
} from "@/lib/cadencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChannelBadge } from "@/components/StatusBadge";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Envios de hoje — Cadência Outbound" },
      {
        name: "description",
        content: "Veja quem precisa receber cada mensagem hoje e quem está atrasado.",
      },
      { property: "og:title", content: "Envios de hoje" },
      {
        property: "og:description",
        content: "Veja quem precisa receber cada mensagem hoje e quem está atrasado.",
      },
    ],
  }),
  component: Hoje,
});

type QueueItem = { contact: Contact; planned: string | null; late: boolean };

function Hoje() {
  const [ref, setRef] = useState(todayISO());
  const [tab, setTab] = useState("1");
  const { data: contacts } = useContacts();
  const { data: settings } = useSettings();
  const holidays = useHolidays();
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };
  const update = useUpdateContact();
  const [needCompany, setNeedCompany] = useState<string | null>(null);
  const offsets = settings ?? DEFAULT_OFFSETS;

  const queues = useMemo(() => {
    const result: Record<number, QueueItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const c of contacts ?? []) {
      if (!isActive(c)) continue;
      const planned = plannedDates(c, offsets, holidays);
      for (const step of STEPS) {
        if (c[step.sentField]) continue;
        if (step.n === 1) {
          if (!c.step1_date) result[1]!.push({ contact: c, planned: null, late: false });
          else if (planned[1]! <= ref)
            result[1]!.push({
              contact: c,
              planned: planned[1]!,
              late: planned[1]! < ref,
            });
          continue;
        }
        const p = planned[step.n];
        if (!p || p > ref) continue;
        result[step.n]!.push({ contact: c, planned: p, late: p < ref });
      }
    }
    for (const key of Object.keys(result)) {
      const k = Number(key);
      result[k]!.sort((a, b) => {
        if (a.late !== b.late) return a.late ? -1 : 1;
        return (a.planned ?? "") < (b.planned ?? "") ? -1 : 1;
      });
    }
    return result;
  }, [contacts, offsets, holidays, ref]);

  function markSent(contact: Contact, step: StepDef) {
    const patch: Partial<Contact> = { [step.sentField]: ref } as Partial<Contact>;
    if (step.n === 1 && !contact.step1_date) patch.step1_date = ref;
    const merged = { ...contact, ...patch } as Contact;
    patch.status = computedStatus(merged);
    update.mutate(
      { id: contact.id, patch },
      {
        onSuccess: () => toast.success(`${step.label} registrada para ${contact.name}`),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function messageFor(contact: Contact, step: StepDef): string | null {
    const body = templates?.[step.n]?.body ?? "";
    if (!body.trim()) {
      toast.error("Modelo ainda não carregado.");
      return null;
    }
    if (!contact.company.trim()) {
      setNeedCompany(contact.id);
      toast.error("Preencha a empresa deste lead");
      return null;
    }
    if (step.n === 1 && (!contact.sector || !contact.job_title.trim())) {
      setNeedCompany(contact.id);
      toast.error("Preencha o setor e o cargo deste lead antes de copiar");
      return null;
    }
    return renderTemplate(body, contact, hunter, {});
  }

  async function copyMessage(contact: Contact, step: StepDef) {
    const text = messageFor(contact, step);
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function openWhatsApp(contact: Contact, step: StepDef) {
    const text = messageFor(contact, step);
    if (text === null) return;
    const link = whatsappLink(contact.phone, text);
    if (link) window.open(link, "_blank", "noopener");
  }

  function saveCompany(
    contact: Contact,
    company: string,
    company_gender: Contact["company_gender"],
  ) {
    update.mutate(
      { id: contact.id, patch: { company: company.trim(), company_gender } },
      {
        onSuccess: () => {
          setNeedCompany(null);
          toast.success("Empresa salva — agora é só copiar a mensagem");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function patchContact(contact: Contact, patch: Partial<Contact>, msg?: string) {
    update.mutate(
      { id: contact.id, patch },
      {
        onSuccess: () => msg && toast.success(msg),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Envios de hoje</h1>
          <p className="text-sm text-muted-foreground">
            Fila do dia {formatBR(ref)} — atrasados aparecem em vermelho no topo.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            type="date"
            className="w-44"
            value={ref}
            onChange={(e) => setRef(e.target.value || todayISO())}
          />
          <Button variant="outline" onClick={() => setRef(todayISO())}>
            Hoje
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          {STEPS.map((step) => (
            <TabsTrigger key={step.n} value={String(step.n)} className="gap-2">
              {step.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold">
                {queues[step.n]!.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {STEPS.map((step) => (
          <TabsContent key={step.n} value={String(step.n)} className="mt-4">
            <QueueList
              step={step}
              items={queues[step.n]!}
              onMark={markSent}
              onCopy={copyMessage}
              onWhats={openWhatsApp}
              needCompany={needCompany}
              onSaveCompany={saveCompany}
              onPatch={patchContact}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function QueueList({
  step,
  items,
  onMark,
  onCopy,
  onWhats,
  needCompany,
  onSaveCompany,
  onPatch,
}: {
  step: StepDef;
  items: QueueItem[];
  onMark: (c: Contact, s: StepDef) => void;
  onCopy: (c: Contact, s: StepDef) => void;
  onWhats: (c: Contact, s: StepDef) => void;
  needCompany: string | null;
  onSaveCompany: (c: Contact, company: string, g: Contact["company_gender"]) => void;
  onPatch: (c: Contact, p: Partial<Contact>, msg?: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nada na fila de {step.label} para esta data.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(({ contact, planned, late }) => {
        const hasPhone = onlyDigits(contact.phone).length >= 10;
        const noCompany = !contact.company.trim();
        return (
          <div
            key={contact.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2",
              late && "border-destructive/50 bg-destructive/5",
            )}
          >
            <div className="min-w-56 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{contact.name}</span>
                {late && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Atrasado — previsto {formatBR(planned)}
                  </span>
                )}
                {noCompany && <Warn>sem empresa</Warn>}
                {step.n === 1 && !contact.sector && <Warn>sem setor</Warn>}
                {step.n === 1 && !contact.job_title.trim() && <Warn>sem cargo</Warn>}
                <FunnelBadge contact={contact} />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {contact.company ? `${contact.company} · ` : ""}
                {contact.headline || "Sem cargo"}
              </p>
            </div>
            <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
            <span className="text-xs text-muted-foreground">
              {step.n === 1 && !planned
                ? "Sem data de LinkedIn 1"
                : `Previsto ${formatBR(planned)}`}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onCopy(contact, step)}>
                Copiar mensagem
              </Button>
              {step.channel === "whatsapp" &&
                (hasPhone ? (
                  <Button size="sm" variant="outline" onClick={() => onWhats(contact, step)}>
                    Abrir WhatsApp
                  </Button>
                ) : (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                    sem telefone
                  </span>
                ))}
              <Button size="sm" onClick={() => onMark(contact, step)}>
                Marcar como enviado
              </Button>
              <FunnelControl
                contact={contact}
                onPatch={(p) => onPatch(contact, p, "Funil atualizado")}
              />
            </div>
            <LeadFields
              key={`${contact.id}-${contact.name}`}
              contact={contact}
              showStep1={step.n === 1}
              onPatch={(p) => onPatch(contact, p)}
            />
            {needCompany === contact.id && noCompany && (
              <CompanyFix
                initialGender={contact.company_gender ?? "feminino"}
                onSave={(v, g) => onSaveCompany(contact, v, g)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompanyFix({
  initialGender,
  onSave,
}: {
  initialGender: Contact["company_gender"];
  onSave: (v: string, g: Contact["company_gender"]) => void;
}) {
  const [v, setV] = useState("");
  const [g, setG] = useState(initialGender);
  return (
    <form
      className="flex w-full items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSave(v, g);
      }}
    >
      <span className="text-xs font-medium text-warning">Preencha a empresa deste lead</span>
      <Input
        autoFocus
        aria-label="Empresa do lead"
        className="h-7 w-56 text-xs"
        placeholder="Empresa"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <CompanyGenderToggle value={g} onChange={setG} />
      <Button size="sm" type="submit" disabled={!v.trim()}>
        Salvar empresa
      </Button>
    </form>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
      {children}
    </span>
  );
}

function LeadFields({
  contact,
  showStep1,
  onPatch,
}: {
  contact: Contact;
  showStep1: boolean;
  onPatch: (p: Partial<Contact>) => void;
}) {
  const [cargo, setCargo] = useState(contact.job_title);
  const [nome, setNome] = useState(contact.name);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
      <Input
        aria-label="Nome do lead"
        placeholder="Nome"
        className="h-7 w-52 text-xs"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() =>
          nome.trim() && nome.trim() !== contact.name
            ? onPatch({ name: nome.trim() })
            : setNome(contact.name)
        }
      />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {contact.company.trim() || "Empresa"}
        <CompanyGenderToggle
          value={contact.company_gender ?? "feminino"}
          onChange={(g) => onPatch({ company_gender: g })}
        />
      </span>
      {showStep1 && (
        <>
          <Select value={contact.sector} onValueChange={(v) => onPatch({ sector: v })}>
            <SelectTrigger
              aria-label="Setor"
              className={cn("h-7 w-48 text-xs", !contact.sector && "border-warning")}
            >
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col">
            <Input
              aria-label="Cargo na empresa"
              placeholder="Cargo na empresa"
              className={cn("h-7 w-52 text-xs", !contact.job_title.trim() && "border-warning")}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              onBlur={() =>
                cargo.trim() !== contact.job_title && onPatch({ job_title: cargo.trim() })
              }
            />
            {contact.headline && (
              <p
                className="mt-0.5 w-52 truncate text-[11px] text-muted-foreground"
                title={contact.headline}
              >
                {contact.headline}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
