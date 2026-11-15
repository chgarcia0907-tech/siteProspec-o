-- Metas do painel de indicadores. Uma linha por escopo:
--   user_id e group_id nulos = padrão da equipe; group_id = meta do grupo; user_id = meta do hunter.
-- Cada meta vale campo a campo: o hunter herda do grupo e o grupo do padrão o que estiver nulo.
-- Leitura e escrita só via service role (server functions do painel, com has_role antes).
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  -- Mensagens enviadas por dia útil (todas as etapas).
  envios_dia integer CHECK (envios_dia >= 0),
  -- Cadências iniciadas (LinkedIn 1) por semana.
  l1_semana integer CHECK (l1_semana >= 0),
  -- ATs marcadas por semana (aceita meia AT, ex.: 1,5).
  ats_semana numeric(6, 1) CHECK (ats_semana >= 0),
  -- Percentual mínimo de etapas enviadas até a data prevista.
  no_prazo_pct integer CHECK (no_prazo_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_one_scope CHECK (user_id IS NULL OR group_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS goals_scope_key ON public.goals (
  COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: hunters não leem nem escrevem metas diretamente.

DROP TRIGGER IF EXISTS goals_touch ON public.goals;
CREATE TRIGGER goals_touch BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
