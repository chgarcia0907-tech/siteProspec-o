
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  offset1 INT NOT NULL DEFAULT 0,
  offset2 INT NOT NULL DEFAULT 1,
  offset3 INT NOT NULL DEFAULT 2,
  offset4 INT NOT NULL DEFAULT 3,
  offset5 INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_own" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  step INT NOT NULL CHECK (step BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, step)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_own" ON public.templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  connected_at DATE,
  step1_date DATE,
  sent1_at DATE,
  sent2_at DATE,
  sent3_at DATE,
  sent4_at DATE,
  sent5_at DATE,
  status TEXT NOT NULL DEFAULT 'aguardando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contacts_user_idx ON public.contacts (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER templates_touch BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ranking(period_start DATE)
RETURNS TABLE (
  hunter_id UUID,
  hunter_name TEXT,
  importados BIGINT,
  enviadas1 BIGINT,
  enviadas2 BIGINT,
  enviadas3 BIGINT,
  enviadas4 BIGINT,
  enviadas5 BIGINT,
  concluidas BIGINT,
  respostas BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, COALESCE(p.display_name, p.email, 'Hunter'),
    COUNT(c.id) FILTER (WHERE c.created_at::date >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent1_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent2_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent3_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent4_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start AND c.sent1_at IS NOT NULL AND c.sent2_at IS NOT NULL AND c.sent3_at IS NOT NULL AND c.sent4_at IS NOT NULL),
    COUNT(c.id) FILTER (WHERE c.status = 'respondeu' AND c.updated_at::date >= period_start)
  FROM public.profiles p
  LEFT JOIN public.contacts c ON c.user_id = p.id
  GROUP BY p.id, p.display_name, p.email
$$;
GRANT EXECUTE ON FUNCTION public.ranking(DATE) TO authenticated;
