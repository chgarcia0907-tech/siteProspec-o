CREATE TABLE public.sync_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sync_settings TO service_role;
REVOKE ALL ON public.sync_settings FROM anon, authenticated;
ALTER TABLE public.sync_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.sync_settings (token) VALUES (encode(extensions.gen_random_bytes(32), 'hex'));