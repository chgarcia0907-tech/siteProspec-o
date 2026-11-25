-- Cadência por setor, subsetor e persona.
--
-- A mensagem de cada etapa passa a depender de três coisas: setor da empresa, subsetor opcional
-- (ex.: Indústria > Metalurgia) e persona do contato (4 papéis fixos do GTM do NTec).
--
--   sectors.parent_id         subsetor = linha de sectors com pai (só um nível, garantido por trigger)
--   companies.subsector_id    subsetor da empresa; sector_id continua sendo o setor de primeiro nível
--   contacts.persona          nulo = "sugerida" (calculada na hora); gravada = confirmada pelo hunter
--   sector_templates.persona  '' = qualquer persona (as linhas atuais); PK vira (sector_id, persona, step)
--
-- Compatível com a versão publicada do app: o upsert dela manda as linhas sem persona, o padrão ''
-- entra e o conflito cai na nova chave primária. Nenhum subsetor é semeado (o admin cria pela tela).
--
-- Pares TS/SQL (ao mudar um lado, crie outra migração para o outro; nunca edite esta):
--   suggestPersona/matchPersona (src/lib/personas.ts)  <->  suggest_persona/match_persona abaixo
--   resolveTemplate (src/lib/fila.ts)                  <->  stamp_resposta_origem abaixo
--   (ordem: subsetor+persona, subsetor, setor+persona, setor, modelo padrão)

-- ---------------------------------------------------------------------------------------------
-- Subsetores
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.sectors(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS sectors_parent_idx ON public.sectors (parent_id);

-- O nome passa a ser único dentro do mesmo pai (setores de primeiro nível ficam sob o uuid zero).
DROP INDEX IF EXISTS public.sectors_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS sectors_name_key ON public.sectors (
  (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  (lower(btrim(name)))
);

CREATE OR REPLACE FUNCTION public.sector_check_level()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um setor não pode ser subsetor de si mesmo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sectors WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Subsetor não pode ter subsetores';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.sectors WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Um setor com subsetores não pode virar subsetor';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sectors_check_level ON public.sectors;
CREATE TRIGGER sectors_check_level BEFORE INSERT OR UPDATE OF parent_id ON public.sectors
FOR EACH ROW EXECUTE FUNCTION public.sector_check_level();

-- ---------------------------------------------------------------------------------------------
-- Empresa: subsetor
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subsector_id uuid REFERENCES public.sectors(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS companies_subsector_idx ON public.companies (subsector_id);

-- O hunter grava companies pelo RLS, então o banco confere: sector_id é de primeiro nível e o
-- subsetor, quando vem, é filho dele.
CREATE OR REPLACE FUNCTION public.company_check_sector()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sectors WHERE id = NEW.sector_id AND parent_id IS NULL) THEN
    RAISE EXCEPTION 'O setor da empresa deve ser um setor, não um subsetor';
  END IF;
  IF NEW.subsector_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sectors WHERE id = NEW.subsector_id AND parent_id = NEW.sector_id
  ) THEN
    RAISE EXCEPTION 'Subsetor não pertence ao setor da empresa';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS companies_check_sector ON public.companies;
CREATE TRIGGER companies_check_sector BEFORE INSERT OR UPDATE OF sector_id, subsector_id ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.company_check_sector();

-- ---------------------------------------------------------------------------------------------
-- Contato: persona (nula = sugerida)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS persona text
    CONSTRAINT contacts_persona_check CHECK (
      persona IN ('owner_processo', 'owner_operacao', 'patrocinador_executivo', 'owner_tecnologia')
    );

-- ---------------------------------------------------------------------------------------------
-- Cadência: persona na chave ('' = qualquer persona)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.sector_templates
  ADD COLUMN IF NOT EXISTS persona text NOT NULL DEFAULT ''
    CONSTRAINT sector_templates_persona_check CHECK (
      persona IN ('', 'owner_processo', 'owner_operacao', 'patrocinador_executivo', 'owner_tecnologia')
    );
ALTER TABLE public.sector_templates DROP CONSTRAINT IF EXISTS sector_templates_pkey;
ALTER TABLE public.sector_templates ADD PRIMARY KEY (sector_id, persona, step);

-- ---------------------------------------------------------------------------------------------
-- Sugestão de persona pelo cargo (espelho de src/lib/personas.ts)
-- Texto sem acento e em minúsculas, palavra inteira, primeira regra que casar vence:
-- tecnologia, patrocinador, operação, processo.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_persona(texto text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  t text;
  s text;
BEGIN
  t := lower(translate(
    coalesce(texto, ''),
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

-- Cargo, senão headline, senão Owner da Operação.
CREATE OR REPLACE FUNCTION public.suggest_persona(cargo text, headline text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(public.match_persona(cargo), public.match_persona(headline), 'owner_operacao');
$$;

-- ---------------------------------------------------------------------------------------------
-- resposta_modelo: mesma escolha de resolveTemplate (src/lib/fila.ts)
-- ---------------------------------------------------------------------------------------------
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
     AND st.step = NEW.resposta_etapa AND btrim(st.body) <> ''
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
-- O trigger trg_stamp_resposta_origem (migração 20261115200000) continua o mesmo.
