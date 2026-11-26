-- Dashboard de Outbound: semana da cadência de cada safra.
--
-- Até aqui a cadência da safra N era sempre a semana N+1. O 26.2 começou com prospecção e cadência
-- na mesma semana (S01 e S02) e tem semanas sem trabalho (provas), em que não há safra e a cadência
-- da safra anterior passa para a próxima semana de trabalho. `cadencia_em` guarda a segunda-feira
-- da semana da cadência: igual a `inicio` = mesma semana; o padrão é a semana seguinte.
-- A maturação conta em semanas de calendário (a pausa conta): madura a partir de
-- inicio + 7 × (maturação + 1), ou inicio + 7 × maturação quando a cadência é na mesma semana,
-- e nunca antes do fim da semana da cadência (`inicioDaMaturidade` em src/lib/safras.ts).

ALTER TABLE public.safras ADD COLUMN IF NOT EXISTS cadencia_em date;
UPDATE public.safras SET cadencia_em = inicio + 7 WHERE cadencia_em IS NULL;
ALTER TABLE public.safras ALTER COLUMN cadencia_em SET NOT NULL;

ALTER TABLE public.safras DROP CONSTRAINT IF EXISTS safras_cadencia_em_valida;
ALTER TABLE public.safras ADD CONSTRAINT safras_cadencia_em_valida CHECK (
  extract(isodow FROM cadencia_em) = 1 AND cadencia_em BETWEEN inicio AND inicio + 28
);

-- Quem grava sem a semana da cadência (versão anterior do app) fica com a semana seguinte.
CREATE OR REPLACE FUNCTION public.safras_cadencia_padrao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cadencia_em IS NULL THEN
    NEW.cadencia_em := NEW.inicio + 7;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS safras_cadencia_padrao ON public.safras;
CREATE TRIGGER safras_cadencia_padrao BEFORE INSERT ON public.safras
FOR EACH ROW EXECUTE FUNCTION public.safras_cadencia_padrao();
