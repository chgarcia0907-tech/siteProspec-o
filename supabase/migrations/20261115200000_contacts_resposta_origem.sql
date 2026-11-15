-- Mensagem que gerou a resposta: quando o lead responde ou a AT é marcada, o hunter informa
-- qual etapa da cadência trouxe a resposta. Até aqui o painel só deduzia (última mensagem
-- enviada antes da resposta), o que erra quando o lead responde a uma mensagem antiga.
--
-- resposta_etapa: número da etapa em STEPS (1 a 5, o canal sai da etapa) ou 0 para
--   "outro canal" (ligação, e-mail, indicação...). Nulo = ainda não informado.
-- resposta_modelo: carimbado por trigger quando resposta_etapa muda, com o código do modelo
--   em uso naquela etapa (o do setor da empresa, senão o padrão), para a métrica por mensagem
--   continuar valendo depois que o modelo for editado. Sem código, guarda "Setor <nome>" ou
--   "Padrão", como a fila de envios mostra.
-- Voltar o contato para a cadência (sem AT e numa situação de cadência) apaga as duas colunas,
-- do mesmo jeito que apaga respondeu_em.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS resposta_etapa smallint
    CHECK (resposta_etapa BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS resposta_modelo text;

CREATE OR REPLACE FUNCTION public.stamp_resposta_origem()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sector uuid;
  v_sector_name text;
  v_code text;
  v_own boolean := false;
BEGIN
  IF NEW.at_marcada_em IS NULL AND NEW.status IN ('aguardando', 'em_cadencia', 'concluido') THEN
    NEW.resposta_etapa := NULL;
    NEW.resposta_modelo := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.resposta_etapa IS NOT DISTINCT FROM OLD.resposta_etapa THEN
    NEW.resposta_modelo := OLD.resposta_modelo;
    RETURN NEW;
  END IF;

  IF NEW.resposta_etapa IS NULL OR NEW.resposta_etapa = 0 THEN
    NEW.resposta_modelo := NULL;
    RETURN NEW;
  END IF;

  SELECT co.sector_id, s.name INTO v_sector, v_sector_name
  FROM companies co JOIN sectors s ON s.id = co.sector_id
  WHERE co.id = NEW.company_id;

  IF v_sector IS NOT NULL THEN
    SELECT true, btrim(st.code) INTO v_own, v_code
    FROM sector_templates st
    WHERE st.sector_id = v_sector AND st.step = NEW.resposta_etapa AND btrim(st.body) <> '';
  END IF;

  IF v_own THEN
    NEW.resposta_modelo := COALESCE(NULLIF(v_code, ''), 'Setor ' || v_sector_name);
  ELSE
    SELECT btrim(mt.code) INTO v_code FROM message_templates mt WHERE mt.step = NEW.resposta_etapa;
    NEW.resposta_modelo := COALESCE(NULLIF(v_code, ''), 'Padrão');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_resposta_origem ON public.contacts;
CREATE TRIGGER trg_stamp_resposta_origem
BEFORE INSERT OR UPDATE OF status, at_marcada_em, resposta_etapa, resposta_modelo ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_resposta_origem();
