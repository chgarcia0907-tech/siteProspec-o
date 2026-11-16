-- Empresas prospectadas pelo hunter, com o ramo de atuação (setor) escolhido manualmente,
-- e cadências de mensagens personalizadas por setor (escritas pelo admin no painel).

-- Ramos de atuação. Leitura para logados; escrita só via service role (server functions do painel).
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sectors_name_key ON public.sectors (lower(btrim(name)));
GRANT SELECT ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY sectors_read ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE TRIGGER sectors_touch BEFORE UPDATE ON public.sectors
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cadência do setor: uma mensagem por etapa. Etapa sem mensagem usa o modelo padrão (message_templates).
CREATE TABLE public.sector_templates (
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  step integer NOT NULL CHECK (step BETWEEN 1 AND 5),
  code text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sector_id, step)
);
GRANT SELECT ON public.sector_templates TO authenticated;
GRANT ALL ON public.sector_templates TO service_role;
ALTER TABLE public.sector_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY sector_templates_read ON public.sector_templates FOR SELECT TO authenticated USING (true);
CREATE TRIGGER sector_templates_touch BEFORE UPDATE ON public.sector_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Empresas do hunter (RLS igual a contacts: cada um vê e edita só as suas).
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  gender text NOT NULL DEFAULT 'feminino' CHECK (gender IN ('masculino', 'feminino', 'sem_artigo')),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE RESTRICT,
  week_start date NOT NULL,
  period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_user_name_key ON public.companies (user_id, lower(btrim(name)));
CREATE INDEX companies_user_week_idx ON public.companies (user_id, week_start);
CREATE INDEX companies_sector_idx ON public.companies (sector_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_own ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER companies_touch BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Mesmo carimbo de período dos contatos (ativo, senão o último).
CREATE TRIGGER companies_stamp_period BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_period();

-- Vínculo do contato com a empresa. contacts.company/company_gender continuam existindo
-- (planilha, ranking e mensagens leem deles) e são copiados da empresa vinculada.
ALTER TABLE public.contacts
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX contacts_company_idx ON public.contacts (company_id);

CREATE OR REPLACE FUNCTION public.contact_copy_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE co public.companies%ROWTYPE;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT * INTO co FROM public.companies WHERE id = NEW.company_id;
    IF NOT FOUND OR co.user_id <> NEW.user_id THEN
      -- Contato transferido para outro hunter: perde o vínculo e mantém o nome da empresa.
      IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        NEW.company_id := NULL;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Empresa inválida para este contato';
    END IF;
    NEW.company := co.name;
    NEW.company_gender := co.gender;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contacts_copy_company BEFORE INSERT OR UPDATE OF company_id, company, company_gender, user_id
ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.contact_copy_company();

-- Renomear a empresa (ou trocar a concordância) atualiza os contatos vinculados.
CREATE OR REPLACE FUNCTION public.company_sync_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.gender IS DISTINCT FROM OLD.gender THEN
    UPDATE public.contacts SET company = NEW.name, company_gender = NEW.gender
    WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER companies_sync_contacts AFTER UPDATE OF name, gender ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.company_sync_contacts();
