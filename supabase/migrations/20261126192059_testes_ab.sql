-- Dashboard de Outbound, fase 8 (.claude/plans/dashboard-outbound.md): testes A/B por propriedade
-- da prospecção. Um teste compara versões de uma dimensão (porte da empresa, setor, subsetor,
-- persona, nível ou área do contato) nas safras do teste; a versão de cada contato sai do valor da
-- dimensão. O resultado só é conclusivo com a amostra mínima (dashboard_parametros) e as safras
-- maduras. Cadastro na aba Semanas; leitura e escrita só via server functions (has_role antes do
-- service role).

CREATE TABLE IF NOT EXISTS public.ab_testes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods ON DELETE CASCADE,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  dimensao text NOT NULL
    CHECK (dimensao IN ('porte', 'setor', 'subsetor', 'persona', 'nivel', 'area')),
  descricao text,
  safra_inicial_id uuid NOT NULL REFERENCES public.safras ON DELETE RESTRICT,
  safra_final_id uuid NOT NULL REFERENCES public.safras ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
  conclusao text,               -- decisão registrada ao encerrar
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ab_testes_period_idx ON public.ab_testes (period_id);
GRANT ALL ON public.ab_testes TO service_role;
ALTER TABLE public.ab_testes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ab_testes_touch ON public.ab_testes;
CREATE TRIGGER ab_testes_touch BEFORE UPDATE ON public.ab_testes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.ab_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teste_id uuid NOT NULL REFERENCES public.ab_testes ON DELETE CASCADE,
  rotulo text NOT NULL CHECK (length(trim(rotulo)) > 0),   -- "A", "B"…
  ordem smallint NOT NULL DEFAULT 0,
  valores text[] NOT NULL CHECK (cardinality(valores) > 0), -- valores da dimensão nesta versão
  UNIQUE (teste_id, rotulo)
);
CREATE INDEX IF NOT EXISTS ab_versoes_teste_idx ON public.ab_versoes (teste_id);
GRANT ALL ON public.ab_versoes TO service_role;
ALTER TABLE public.ab_versoes ENABLE ROW LEVEL SECURITY;
