import { useState } from "react";
import { toast } from "sonner";
import { useProfile, useTemplates, useUpdateContact } from "@/hooks/useCadencia";
import { renderTemplate, whatsappLink, type Contact, type StepDef } from "@/lib/cadencia";
import { markSentPatch, missingForMessage } from "@/lib/fila";

/** Ações da fila do dia: marcar envio, copiar/abrir mensagem e completar dados do lead. */
export function useQueueActions(ref: string) {
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
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

  function messageFor(contact: Contact, step: StepDef): string | null {
    const body = templates?.[step.n]?.body ?? "";
    if (!body.trim()) {
      toast.error("Modelo ainda não carregado.");
      return null;
    }
    const missing = missingForMessage(contact, step);
    if (missing) {
      setNeedCompany(contact.id);
      toast.error(
        missing === "empresa"
          ? "Preencha a empresa deste lead"
          : "Preencha o setor e o cargo deste lead antes de copiar",
      );
      return null;
    }
    return renderTemplate(body, contact, hunter, {});
  }

  return {
    needCompany,
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
