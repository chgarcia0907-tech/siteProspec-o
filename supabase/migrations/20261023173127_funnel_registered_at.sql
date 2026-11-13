ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lead_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS proposta_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS vendido_registrado_em timestamptz;

-- Backfill: etapas gravadas com data futura (agendamento) recebem como registro o momento da última atualização.
UPDATE public.contacts SET lead_registrado_em = updated_at WHERE lead_em IS NOT NULL AND lead_em > (updated_at AT TIME ZONE 'America/Sao_Paulo')::date;
UPDATE public.contacts SET proposta_registrado_em = updated_at WHERE proposta_em IS NOT NULL AND proposta_em > (updated_at AT TIME ZONE 'America/Sao_Paulo')::date;
UPDATE public.contacts SET aprovacao_registrado_em = updated_at WHERE aprovacao_em IS NOT NULL AND aprovacao_em > (updated_at AT TIME ZONE 'America/Sao_Paulo')::date;
UPDATE public.contacts SET vendido_registrado_em = updated_at WHERE vendido_em IS NOT NULL AND vendido_em > (updated_at AT TIME ZONE 'America/Sao_Paulo')::date;