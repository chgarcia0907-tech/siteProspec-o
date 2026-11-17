-- Resposta positiva ou negativa: ao marcar "respondeu", o hunter diz se o lead respondeu com
-- interesse (positiva) ou recusou (negativa). Substitui o uso de "descartado" para quem disse não.
-- Aditiva: respostas marcadas antes ficam sem tipo (NULL = não informado).
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS resposta_tipo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_resposta_tipo_check'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_resposta_tipo_check
      CHECK (resposta_tipo IS NULL OR resposta_tipo IN ('positiva', 'negativa'));
  END IF;
END $$;
