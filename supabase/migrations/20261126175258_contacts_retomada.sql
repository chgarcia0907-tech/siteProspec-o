-- Retomada (fase 4 da dashboard de outbound, .claude/plans/dashboard-outbound.md): o hunter marca
-- o prospect que pediu para ser procurado depois, com a data e o motivo, e o contato aparece na
-- fila "Retomadas" de Envios de hoje nesse dia. Não reinicia a cadência nem muda a situação do
-- contato; ele mantém a safra original.
--
-- retomar_em            dia combinado para retomar (null = não está para retomar)
-- retomar_motivo        o que o prospect disse (opcional)
-- retomada_marcada_em   quando o hunter marcou (trigger; muda a cada nova data)
-- retomado_em           quando o hunter registrou que retomou (null = pendente)
--
-- O hunter grava pelo RLS de contacts que já existe (só os próprios contatos).

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS retomar_em date,
  ADD COLUMN IF NOT EXISTS retomar_motivo text,
  ADD COLUMN IF NOT EXISTS retomada_marcada_em timestamptz,
  ADD COLUMN IF NOT EXISTS retomado_em timestamptz;

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_retomar_motivo_len;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_retomar_motivo_len
  CHECK (retomar_motivo IS NULL OR length(retomar_motivo) <= 300);

-- Fila do dia: retomadas pendentes por hunter e data.
CREATE INDEX IF NOT EXISTS contacts_retomar_idx ON public.contacts (user_id, retomar_em)
  WHERE retomar_em IS NOT NULL AND retomado_em IS NULL;

-- Carimbo: data nova (ou primeira) marca agora e volta a ficar pendente; sem data, limpa tudo.
CREATE OR REPLACE FUNCTION public.stamp_retomada()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.retomar_em IS NULL THEN
    NEW.retomar_motivo := NULL;
    NEW.retomada_marcada_em := NULL;
    NEW.retomado_em := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.retomar_em IS DISTINCT FROM OLD.retomar_em THEN
    NEW.retomada_marcada_em := now();
    NEW.retomado_em := NULL;
  END IF;
  NEW.retomar_motivo := NULLIF(btrim(NEW.retomar_motivo), '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_retomada ON public.contacts;
CREATE TRIGGER trg_stamp_retomada
BEFORE INSERT OR UPDATE OF retomar_em, retomar_motivo, retomado_em ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_retomada();
