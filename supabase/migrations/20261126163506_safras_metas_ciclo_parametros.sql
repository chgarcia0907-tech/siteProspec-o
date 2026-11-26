-- Dashboard de Outbound, fase 1 (.claude/plans/dashboard-outbound.md): semanas de prospecção
-- (safras) de cada ciclo, metas do ciclo, parâmetros configuráveis da dashboard e a meta semanal
-- de passos de cadência.
--
-- A safra de um contato não é gravada: sai de contacts.created_at (fuso de São Paulo) e das
-- datas das safras (src/lib/safras.ts). Por isso as semanas valem também para trás.
--
-- Leitura e escrita só via service role (server functions da dashboard, com has_role antes).

-- ── safras ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),           -- S01 = 1
  inicio date NOT NULL,                                 -- sempre uma segunda-feira
  fim date NOT NULL,                                    -- último dia útil exibido (normalmente sexta)
  -- false = semana anterior ao esquema de alocação (ex.: S01 e S02 do 26.2): entra nas métricas
  -- por safra, mas não cobra meta de safra nem gera "contato sem alocação".
  usa_alocacao boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safras_numero_key UNIQUE (period_id, numero),
  CONSTRAINT safras_inicio_segunda CHECK (extract(isodow FROM inicio) = 1),
  CONSTRAINT safras_fim_na_semana CHECK (fim >= inicio AND fim <= inicio + 6)
);
CREATE INDEX IF NOT EXISTS safras_inicio_idx ON public.safras (inicio);
GRANT ALL ON public.safras TO service_role;
ALTER TABLE public.safras ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated.

DROP TRIGGER IF EXISTS safras_touch ON public.safras;
CREATE TRIGGER safras_touch BEFORE UPDATE ON public.safras
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Safra só em período do tipo ciclo, e duas safras nunca dividem a mesma semana (um contato cai
-- em uma safra só). A semana vai de segunda a domingo, mesmo quando a safra termina na sexta.
CREATE OR REPLACE FUNCTION public.safras_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM periods p WHERE p.id = NEW.period_id AND p.kind = 'ciclo') THEN
    RAISE EXCEPTION 'Safras só existem em períodos do tipo ciclo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM safras s
    WHERE s.id <> NEW.id AND s.inicio = NEW.inicio
  ) THEN
    RAISE EXCEPTION 'Já existe uma safra na semana de %', to_char(NEW.inicio, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS safras_valida ON public.safras;
CREATE TRIGGER safras_valida BEFORE INSERT OR UPDATE ON public.safras
FOR EACH ROW EXECUTE FUNCTION public.safras_valida();

-- ── ciclo_metas ─────────────────────────────────────────────────────────────────────────────
-- Metas do ciclo inteiro, escolhidas pelo LO na dashboard. Nula = sem meta.
CREATE TABLE IF NOT EXISTS public.ciclo_metas (
  period_id uuid PRIMARY KEY REFERENCES public.periods(id) ON DELETE CASCADE,
  ats_avancaram integer CHECK (ats_avancaram >= 0),   -- métrica central
  ats_marcadas integer CHECK (ats_marcadas >= 0),
  ats_realizadas integer CHECK (ats_realizadas >= 0),
  contatos integer CHECK (contatos >= 0),
  vendas integer CHECK (vendas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ciclo_metas TO service_role;
ALTER TABLE public.ciclo_metas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ciclo_metas_touch ON public.ciclo_metas;
CREATE TRIGGER ciclo_metas_touch BEFORE UPDATE ON public.ciclo_metas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── dashboard_parametros ────────────────────────────────────────────────────────────────────
-- Uma linha só (id = true). Valores iniciais da spec; o LO muda na dashboard.
CREATE TABLE IF NOT EXISTS public.dashboard_parametros (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  maturacao_semanas integer NOT NULL DEFAULT 3 CHECK (maturacao_semanas BETWEEN 0 AND 12),
  amostra_minima_ab integer NOT NULL DEFAULT 500 CHECK (amostra_minima_ab > 0),
  min_ats_segmento integer NOT NULL DEFAULT 10 CHECK (min_ats_segmento > 0),
  avanco_fica_pct integer NOT NULL DEFAULT 50 CHECK (avanco_fica_pct BETWEEN 0 AND 100),
  avanco_troca_pct integer NOT NULL DEFAULT 35 CHECK (avanco_troca_pct BETWEEN 0 AND 100),
  esforco_alerta_pct integer NOT NULL DEFAULT 70 CHECK (esforco_alerta_pct BETWEEN 0 AND 100),
  dias_contato_parado integer NOT NULL DEFAULT 3 CHECK (dias_contato_parado > 0),
  concentracao_ats_pct integer NOT NULL DEFAULT 30 CHECK (concentracao_ats_pct BETWEEN 0 AND 100),
  nao_realizadas_pct integer NOT NULL DEFAULT 15 CHECK (nao_realizadas_pct BETWEEN 0 AND 100),
  semanas_seguidas integer NOT NULL DEFAULT 2 CHECK (semanas_seguidas > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_parametros_faixas CHECK (avanco_troca_pct <= avanco_fica_pct)
);
INSERT INTO public.dashboard_parametros (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT ALL ON public.dashboard_parametros TO service_role;
ALTER TABLE public.dashboard_parametros ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS dashboard_parametros_touch ON public.dashboard_parametros;
CREATE TRIGGER dashboard_parametros_touch BEFORE UPDATE ON public.dashboard_parametros
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── goals.passos_semana ─────────────────────────────────────────────────────────────────────
-- Passos de cadência (todas as etapas) por semana, com a mesma herança hunter → grupo → equipe.
-- Entra no esforço combinado: (contatos adicionados + passos) ÷ (meta de contatos + passos_semana).
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS passos_semana integer CHECK (passos_semana >= 0);
