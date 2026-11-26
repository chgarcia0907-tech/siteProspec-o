-- Dashboard de Outbound, fase 7 (.claude/plans/dashboard-outbound.md): meta de tempo (dias corridos)
-- em cada etapa do funil 6 do Pipedrive, para "tempo por etapa × meta" da aba Realização e avanço.
-- Valores iniciais = days_to_rotten das etapas no Pipedrive (26/11/2026); o LO muda nos parâmetros
-- da dashboard. Leitura e escrita só via server functions (has_role antes do service role).

CREATE TABLE IF NOT EXISTS public.dashboard_tempo_etapas (
  stage_id integer PRIMARY KEY,
  meta_dias integer NOT NULL CHECK (meta_dias BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dashboard_tempo_etapas (stage_id, meta_dias) VALUES
  (108, 7),  -- AT Diag. Agendada
  (31, 7),   -- AT Diag. Realizada
  (33, 10),  -- AT Aprof. Marcada
  (34, 7),   -- Proposta Agendada
  (35, 4),   -- Negociação
  (36, 5)    -- Aprov. Verbal (Contrato)
ON CONFLICT (stage_id) DO NOTHING;

GRANT ALL ON public.dashboard_tempo_etapas TO service_role;
ALTER TABLE public.dashboard_tempo_etapas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS dashboard_tempo_etapas_touch ON public.dashboard_tempo_etapas;
CREATE TRIGGER dashboard_tempo_etapas_touch BEFORE UPDATE ON public.dashboard_tempo_etapas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
