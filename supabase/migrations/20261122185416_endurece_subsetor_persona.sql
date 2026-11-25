-- Endurece a migração 20261122180804_setor_subsetor_persona (já aplicada; ela não foi alterada):
--   * o pai de um setor não pode ser trocado depois de criado;
--   * match_persona tira acento solto (texto decomposto) sem depender de normalize();
--   * match_persona e suggest_persona deixam de ser executáveis por anon;
--   * stamp_resposta_origem trata mensagem só com espaços como vazia, como o trim() do JS.
-- Só funções, trigger e permissões: nenhuma tabela muda.

-- Falha rápido em vez de travar esperando um bloqueio (vale só nesta transação).
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.sector_check_level()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- O pai não muda depois de criado: trocar o pai moveria as empresas do subsetor de setor.
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'O setor pai não pode ser trocado';
  END IF;
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um setor não pode ser subsetor de si mesmo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sectors WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Subsetor não pode ter subsetores';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sectors_check_level ON public.sectors;
CREATE TRIGGER sectors_check_level BEFORE INSERT OR UPDATE OF parent_id ON public.sectors
FOR EACH ROW EXECUTE FUNCTION public.sector_check_level();

-- Acento solto (texto decomposto) sai pelo intervalo U+0300-U+036F; o resto é igual ao anterior.
CREATE OR REPLACE FUNCTION public.match_persona(texto text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  t text;
  s text;
BEGIN
  t := lower(translate(
    regexp_replace(coalesce(texto, ''), '[\u0300-\u036f]', '', 'g'),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
  ));
  IF btrim(t) = '' THEN
    RETURN NULL;
  END IF;

  -- owner_tecnologia
  s := regexp_replace(t, '(desenvolvimento de negocios|desenvolvimento comercial|business development)', ' ', 'g');
  IF s ~ '(^|[^a-z0-9])(cio|cto|ti|sistemas|tecnologia|tech lead|arquitet(o|a|os|as)|desenvolvimento)([^a-z0-9]|$)' THEN
    RETURN 'owner_tecnologia';
  END IF;

  -- patrocinador_executivo
  s := regexp_replace(t, '(product owner|process owner)', ' ', 'g');
  IF s ~ '(^|[^a-z0-9])(ceo|coo|cfo|presidente(s)?|vice-presidente(s)?|vp|diretor(a|es|as)?|soci(o|a|os|as)|fundador(a|es|as)?|cofundador(a|es|as)?|owner(s)?)([^a-z0-9]|$)' THEN
    RETURN 'patrocinador_executivo';
  END IF;

  -- owner_operacao
  IF t ~ '(^|[^a-z0-9])(gerente(s)?|head(s)?|gestor(a|es|as)?|encarregad(o|a|os|as))([^a-z0-9]|$)' THEN
    RETURN 'owner_operacao';
  END IF;
  IF t ~ '(^|[^a-z0-9])(coordenador(a|es|as)?)([^a-z0-9]|$)' AND t ~ '(operac|logistic|producao|engenharia|manutencao)' THEN
    RETURN 'owner_operacao';
  END IF;

  -- owner_processo
  IF t ~ '(^|[^a-z0-9])(analista(s)?|assistente(s)?|especialista(s)?|supervisor(a|es|as)?|lider(es)?|coordenador(a|es|as)?)([^a-z0-9]|$)' THEN
    RETURN 'owner_processo';
  END IF;

  RETURN NULL;
END $$;

-- Quem grava contatos (authenticated) e o service role disparam o trigger, que chama estas funções.
REVOKE ALL ON FUNCTION public.match_persona(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suggest_persona(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_persona(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suggest_persona(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.stamp_resposta_origem()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sector uuid;
  v_sub uuid;
  v_sector_name text;
  v_sub_name text;
  v_persona text;
  v_code text;
  v_level_name text;
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

  SELECT co.sector_id, co.subsector_id, s.name, sub.name
    INTO v_sector, v_sub, v_sector_name, v_sub_name
  FROM companies co
  JOIN sectors s ON s.id = co.sector_id
  LEFT JOIN sectors sub ON sub.id = co.subsector_id
  WHERE co.id = NEW.company_id;

  IF v_sector IS NOT NULL THEN
    -- Persona efetiva: a gravada, senão a sugerida pelo cargo (como o app mostra na fila).
    v_persona := COALESCE(NEW.persona, public.suggest_persona(NEW.job_title, NEW.headline));
    -- Primeira mensagem não vazia: subsetor+persona, subsetor, setor+persona, setor.
    SELECT true, btrim(st.code), lv.name INTO v_own, v_code, v_level_name
    FROM (VALUES
      (1, v_sub, v_persona, v_sub_name),
      (2, v_sub, ''::text, v_sub_name),
      (3, v_sector, v_persona, v_sector_name),
      (4, v_sector, ''::text, v_sector_name)
    ) AS lv(ord, sid, persona, name)
    JOIN sector_templates st
      ON st.sector_id = lv.sid AND st.persona = lv.persona
     AND st.step = NEW.resposta_etapa AND st.body ~ '\S'
    ORDER BY lv.ord
    LIMIT 1;
  END IF;

  IF v_own THEN
    NEW.resposta_modelo := COALESCE(NULLIF(v_code, ''), 'Setor ' || v_level_name);
  ELSE
    SELECT btrim(mt.code) INTO v_code FROM message_templates mt WHERE mt.step = NEW.resposta_etapa;
    NEW.resposta_modelo := COALESCE(NULLIF(v_code, ''), 'Padrão');
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';
