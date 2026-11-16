import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCompanies,
  useProfile,
  useSectorTemplates,
  useSectors,
  useTemplates,
  useUpdateContact,
} from "@/hooks/useCadencia";
import { renderTemplate, whatsappLink, type Contact, type StepDef } from "@/lib/cadencia";
import { markSentPatch, missingForMessage, pickTemplate } from "@/lib/fila";

/** Ações da fila do dia: marcar envio, copiar/abrir mensagem e completar dados do lead. */
export function useQueueActions(ref: string) {
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
  const { data: companies } = useCompanies();
  const { data: sectors } = useSectors();
  const { data: sectorTemplates } = useSectorTemplates();
  const companyById = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c])), [companies]);
  const sectorName = useMemo(() => new Map((sectors ?? []).map((s) => [s.id, s.name])), [sectors]);
  const update = useUpdateContact();
  /** Lead que precisa da empresa preenchida antes de gerar a mensagem. */
  const [needCompany, setNeedCompany] = useState<string | null>(null);
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };

  const patch = (contact: Contact, p: Partial<Contact>, msg?: string, onDone?: () => void) =>
    update.mutate(
      { id: contact.id, patch: p },
      {
        onSuccess: () => {
          onDone?.();
          if (msg) toast.success(msg);
        },
        onError: (e) => toast.error(e.message),
      },
    );

  /** Setor (ramo) da empresa vinculada ao contato, se houver. */
  function sectorOf(contact: Contact): { id: string; name: string } | null {
    const co = contact.company_id ? companyById.get(contact.company_id) : undefined;
    return co ? { id: co.sector_id, name: sectorName.get(co.sector_id) ?? "" } : null;
  }

  /** Modelo usado para o contato na etapa: o da cadência do setor ou o padrão. */
  function templateFor(contact: Contact, step: StepDef) {
    return pickTemplate(step, sectorOf(contact)?.id, sectorTemplates, templates);
  }

  function messageFor(contact: Contact, step: StepDef): string | null {
    const body = templateFor(contact, step)?.body ?? "";
    if (!body.trim()) {
      toast.error("Modelo ainda não carregado.");
      return null;
    }
    const missing = missingForMessage(contact, step, body);
    if (missing) {
      setNeedCompany(contact.id);
      toast.error(
        missing === "empresa"
          ? "Preencha a empresa deste lead"
          : "Preencha a área e o cargo deste lead antes de copiar",
      );
      return null;
    }
    return renderTemplate(body, contact, hunter, {});
  }

  return {
    needCompany,
    companies: companies ?? [],
    sectorOf,
    templateFor,
    markSent: (contact: Contact, step: StepDef) =>
      patch(
        contact,
        markSentPatch(contact, step, ref),
        `${step.label} registrada para ${contact.name}`,
      ),
    async copyMessage(contact: Contact, step: StepDef) {
      const text = messageFor(contact, step);
      if (text === null) return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Mensagem copiada");
      } catch {
        toast.error("Não foi possível copiar");
      }
    },
    openWhatsApp(contact: Contact, step: StepDef) {
      const text = messageFor(contact, step);
      if (text === null) return;
      const link = whatsappLink(contact.phone, text);
      if (link) window.open(link, "_blank", "noopener");
    },
    saveCompany: (contact: Contact, company: string, gender: Contact["company_gender"]) =>
      patch(
        contact,
        { company: company.trim(), company_gender: gender },
        "Empresa salva — agora é só copiar a mensagem",
        () => setNeedCompany(null),
      ),
    patchContact: (contact: Contact, p: Partial<Contact>, msg?: string) => patch(contact, p, msg),
  };
}

export type QueueActions = ReturnType<typeof useQueueActions>;
