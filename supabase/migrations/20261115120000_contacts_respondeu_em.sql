-- Data da resposta: até aqui "respondeu" era só uma situação, sem data, e o painel não
-- conseguia medir taxa nem tempo de resposta por período.
-- respondeu_em é carimbado por trigger quando a situação passa a 'respondeu'. Descartar depois
-- da resposta mantém a data (a resposta aconteceu); voltar para uma situação de cadência
-- (aguardando, em cadência, concluído) é desfazer a marcação, então a data é apagada.
-- Respostas marcadas antes desta migração ficam sem data (não dá para saber quando foram).
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS respondeu_em timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_respondeu_em()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'respondeu' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'respondeu' THEN
      NEW.respondeu_em := COALESCE(NEW.respondeu_em, now());
    END IF;
  ELSIF NEW.status IN ('aguardando', 'em_cadencia', 'concluido') THEN
    NEW.respondeu_em := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_respondeu_em ON public.contacts;
CREATE TRIGGER trg_stamp_respondeu_em
BEFORE INSERT OR UPDATE OF status, respondeu_em ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_respondeu_em();
