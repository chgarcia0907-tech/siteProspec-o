CREATE TABLE public.periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX periods_one_active ON public.periods ((status)) WHERE status = 'active';
GRANT SELECT ON public.periods TO authenticated;
GRANT ALL ON public.periods TO service_role;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY periods_read ON public.periods FOR SELECT TO authenticated USING (true);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, name)
);
GRANT SELECT ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_read ON public.groups FOR SELECT TO authenticated USING (true);

CREATE TABLE public.subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);
GRANT SELECT ON public.subgroups TO authenticated;
GRANT ALL ON public.subgroups TO service_role;
ALTER TABLE public.subgroups ENABLE ROW LEVEL SECURITY;
CREATE POLICY subgroups_read ON public.subgroups FOR SELECT TO authenticated USING (true);

CREATE TABLE public.period_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  subgroup_id uuid REFERENCES public.subgroups(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);
CREATE INDEX idx_period_members_user ON public.period_members(user_id);
GRANT SELECT ON public.period_members TO authenticated;
GRANT ALL ON public.period_members TO service_role;
ALTER TABLE public.period_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY period_members_read ON public.period_members FOR SELECT TO authenticated USING (true);

CREATE TABLE public.period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE RESTRICT,
  hunter_id uuid NOT NULL,
  hunter_name text NOT NULL DEFAULT '',
  group_name text NOT NULL DEFAULT '',
  subgroup_name text NOT NULL DEFAULT '',
  points numeric NOT NULL DEFAULT 0,
  contacts_count integer NOT NULL DEFAULT 0,
  sent1 integer NOT NULL DEFAULT 0,
  sent2 integer NOT NULL DEFAULT 0,
  sent3 integer NOT NULL DEFAULT 0,
  sent4 integer NOT NULL DEFAULT 0,
  sent5 integer NOT NULL DEFAULT 0,
  ats_count integer NOT NULL DEFAULT 0,
  leads_count integer NOT NULL DEFAULT 0,
  propostas_count integer NOT NULL DEFAULT 0,
  aprovacoes_count integer NOT NULL DEFAULT 0,
  vendas_count integer NOT NULL DEFAULT 0,
  weekly_wins integer NOT NULL DEFAULT 0,
  first_at_bonus boolean NOT NULL DEFAULT false,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, hunter_id)
);
GRANT SELECT ON public.period_snapshots TO authenticated;
GRANT ALL ON public.period_snapshots TO service_role;
ALTER TABLE public.period_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY period_snapshots_read ON public.period_snapshots FOR SELECT TO authenticated USING (true);

-- Período inaugural, iniciando na data atual da competição
INSERT INTO public.periods (name, status, started_at)
SELECT 'Hacka 26.2', 'active', COALESCE((SELECT start_date FROM public.competition_settings WHERE id = 1), now()::date)::timestamptz;

-- Contatos: nova coluna opcional + backfill
ALTER TABLE public.contacts ADD COLUMN period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
UPDATE public.contacts SET period_id = (SELECT id FROM public.periods WHERE name = 'Hacka 26.2') WHERE period_id IS NULL;
CREATE INDEX idx_contacts_period_id ON public.contacts(period_id);
CREATE INDEX idx_contacts_user_period ON public.contacts(user_id, period_id);

-- Todos os perfis atuais entram no Hacka 26.2 (sem grupo)
INSERT INTO public.period_members (period_id, user_id)
SELECT (SELECT id FROM public.periods WHERE name = 'Hacka 26.2'), p.id FROM public.profiles p
ON CONFLICT DO NOTHING;

-- Carimbo automático de período em novos contatos: ativo, senão o último encerrado
CREATE OR REPLACE FUNCTION public.stamp_contact_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.period_id IS NULL THEN
    SELECT id INTO NEW.period_id FROM public.periods
      ORDER BY (status = 'active') DESC, started_at DESC LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contacts_stamp_period BEFORE INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_period();

-- Novos membros entram automaticamente no período ativo; nunca bloqueia o cadastro
CREATE OR REPLACE FUNCTION public.join_active_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    INSERT INTO public.period_members (period_id, user_id)
    SELECT id, NEW.id FROM public.periods WHERE status = 'active' LIMIT 1
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_join_active_period AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.join_active_period();