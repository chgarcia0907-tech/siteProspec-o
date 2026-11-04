UPDATE public.message_templates SET body = regexp_replace(body, '\[RAPPORT\]\s*\n\s*\n', ''), updated_at = now() WHERE step = 1;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS rapport;