-- Dashboard de Outbound, fase 2 (.claude/plans/dashboard-outbound.md): alocação de cada hunter
-- por safra e o porte da empresa.
--
-- alocacoes: uma linha por safra × hunter × vigência. Troca de setor no meio da semana = nova
--   linha com `vigente_desde` (o contato fica no setor da linha vigente no dia em que foi criado).
--   As metas da safra do hunter são as da linha vigente mais recente. Dois hunters com o mesmo
--   rótulo de `dupla` na safra formam uma dupla (métricas continuam individuais).
--   Leitura e escrita só via service role (server functions da dashboard, has_role antes). A regra
--   "editar só até o início da safra" depende do dia de hoje e fica na server function.
-- companies.porte: faixa de funcionários, as mesmas do campo "Número de Funcionários" do
--   Pipedrive. Opcional; o hunter escolhe em Empresas (RLS de companies já existente).

-- ── alocacoes ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safra_id uuid NOT NULL REFERENCES public.safras(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE RESTRICT,
  subsector_id uuid REFERENCES public.sectors(id) ON DELETE RESTRICT,
  dupla text CHECK (dupla IS NULL OR (btrim(dupla) <> '' AND length(dupla) <= 20)),
  meta_empresas integer NOT NULL DEFAULT 0 CHECK (meta_empresas >= 0),
  meta_contatos integer NOT NULL DEFAULT 0 CHECK (meta_contatos >= 0),
  motivo_meta_zero text,
  vigente_desde date NOT NULL,
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alocacoes_vigencia_key UNIQUE (safra_id, user_id, vigente_desde),
  -- Hunter sem prospecção na semana: metas zeradas exigem o motivo.
  CONSTRAINT alocacoes_motivo_meta_zero CHECK (
    meta_empresas > 0 OR meta_contatos > 0
    OR (motivo_meta_zero IS NOT NULL AND btrim(motivo_meta_zero) <> '')
  )
);
CREATE INDEX IF NOT EXISTS alocacoes_safra_idx ON public.alocacoes (safra_id);
CREATE INDEX IF NOT EXISTS alocacoes_user_idx ON public.alocacoes (user_id);
GRANT ALL ON public.alocacoes TO service_role;
ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated.

DROP TRIGGER IF EXISTS alocacoes_touch ON public.alocacoes;
CREATE TRIGGER alocacoes_touch BEFORE UPDATE ON public.alocacoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Coerência que não cabe num CHECK: safra no esquema de alocação, vigência dentro da semana,
-- setor de primeiro nível, subsetor daquele setor e no máximo dois hunters por dupla.
CREATE OR REPLACE FUNCTION public.alocacoes_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.safras%ROWTYPE;
BEGIN
  SELECT * INTO s FROM safras WHERE id = NEW.safra_id;
  IF NOT s.usa_alocacao THEN
    RAISE EXCEPTION 'A safra % não usa alocação', s.numero;
  END IF;
  IF NEW.vigente_desde < s.inicio OR NEW.vigente_desde > s.inicio + 6 THEN
    RAISE EXCEPTION 'A vigência fica dentro da semana da safra';
  END IF;
  IF EXISTS (SELECT 1 FROM sectors WHERE id = NEW.sector_id AND parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'O setor alocado é um setor de primeiro nível';
  END IF;
  IF NEW.subsector_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM sectors WHERE id = NEW.subsector_id AND parent_id = NEW.sector_id
  ) THEN
    RAISE EXCEPTION 'O subsetor não pertence ao setor alocado';
  END IF;
  NEW.dupla := NULLIF(btrim(NEW.dupla), '');
  IF NEW.dupla IS NOT NULL AND (
    SELECT count(DISTINCT a.user_id) FROM alocacoes a
    WHERE a.safra_id = NEW.safra_id AND a.dupla = NEW.dupla
      AND a.user_id <> NEW.user_id AND a.id <> NEW.id
  ) >= 2 THEN
    RAISE EXCEPTION 'A dupla % já tem dois hunters nesta safra', NEW.dupla;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS alocacoes_valida ON public.alocacoes;
CREATE TRIGGER alocacoes_valida BEFORE INSERT OR UPDATE ON public.alocacoes
FOR EACH ROW EXECUTE FUNCTION public.alocacoes_valida();

-- Safra com alocação não deixa de usar alocação (as linhas ficariam órfãs da regra).
CREATE OR REPLACE FUNCTION public.safras_usa_alocacao_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.usa_alocacao AND NOT NEW.usa_alocacao
     AND EXISTS (SELECT 1 FROM alocacoes WHERE safra_id = NEW.id) THEN
    RAISE EXCEPTION 'A safra % tem alocações: exclua-as antes de desligar a alocação', NEW.numero;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS safras_usa_alocacao_valida ON public.safras;
CREATE TRIGGER safras_usa_alocacao_valida BEFORE UPDATE OF usa_alocacao ON public.safras
FOR EACH ROW EXECUTE FUNCTION public.safras_usa_alocacao_valida();

-- ── companies.porte ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS porte text;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_porte_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_porte_check CHECK (
  porte IS NULL OR porte IN (
    '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'
  )
);
