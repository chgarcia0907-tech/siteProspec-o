CREATE OR REPLACE FUNCTION public.grant_admin_on_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'guilherme.jeronimo@polijunior.com.br' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_confirm() FROM anon, authenticated, public;
DELETE FROM public.user_roles WHERE role = 'admin' AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'outbound@polijunior.com.br');
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'guilherme.jeronimo@polijunior.com.br' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;