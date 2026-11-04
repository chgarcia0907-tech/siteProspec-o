CREATE OR REPLACE FUNCTION public.stamp_funnel_registered_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.at_marcada_em IS NOT NULL AND NEW.at_registrado_em IS NULL THEN NEW.at_registrado_em := now(); END IF;
    IF NEW.lead_em IS NOT NULL AND NEW.lead_registrado_em IS NULL THEN NEW.lead_registrado_em := now(); END IF;
    IF NEW.proposta_em IS NOT NULL AND NEW.proposta_registrado_em IS NULL THEN NEW.proposta_registrado_em := now(); END IF;
    IF NEW.aprovacao_em IS NOT NULL AND NEW.aprovacao_registrado_em IS NULL THEN NEW.aprovacao_registrado_em := now(); END IF;
    IF NEW.vendido_em IS NOT NULL AND NEW.vendido_registrado_em IS NULL THEN NEW.vendido_registrado_em := now(); END IF;
    RETURN NEW;
  END IF;
  IF OLD.at_marcada_em IS NULL AND NEW.at_marcada_em IS NOT NULL AND NEW.at_registrado_em IS NULL THEN NEW.at_registrado_em := now(); END IF;
  IF OLD.lead_em IS NULL AND NEW.lead_em IS NOT NULL AND NEW.lead_registrado_em IS NULL THEN NEW.lead_registrado_em := now(); END IF;
  IF OLD.proposta_em IS NULL AND NEW.proposta_em IS NOT NULL AND NEW.proposta_registrado_em IS NULL THEN NEW.proposta_registrado_em := now(); END IF;
  IF OLD.aprovacao_em IS NULL AND NEW.aprovacao_em IS NOT NULL AND NEW.aprovacao_registrado_em IS NULL THEN NEW.aprovacao_registrado_em := now(); END IF;
  IF OLD.vendido_em IS NULL AND NEW.vendido_em IS NOT NULL AND NEW.vendido_registrado_em IS NULL THEN NEW.vendido_registrado_em := now(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_funnel_registered_at ON public.contacts;
CREATE TRIGGER trg_stamp_funnel_registered_at
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_funnel_registered_at();