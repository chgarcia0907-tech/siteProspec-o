-- Tipo do período: competição (Hacka, contatos do próprio período) ou ciclo da equipe
-- (todos os contatos dos membros, contados pela data de cada etapa).
ALTER TABLE public.periods ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'competicao';
ALTER TABLE public.periods DROP CONSTRAINT IF EXISTS periods_kind_check;
ALTER TABLE public.periods ADD CONSTRAINT periods_kind_check CHECK (kind IN ('competicao','ciclo'));
