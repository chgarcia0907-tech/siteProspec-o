-- Contato sem número de WhatsApp: as etapas de WhatsApp saem da cadência dele (filas, atrasados,
-- pendência de telefone e conclusão). Aditiva: todos os contatos existentes seguem como estão.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sem_whatsapp BOOLEAN NOT NULL DEFAULT false;
