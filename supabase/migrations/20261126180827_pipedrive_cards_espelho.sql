-- Dashboard de Outbound, fase 5 (.claude/plans/dashboard-outbound.md): cópia dos cards do Pipedrive
-- para as métricas que dependem do card (avanço pelo histórico de etapas, perdas, valor, porte,
-- cargo, tasks no prazo) e para a conciliação.
--
-- pd_cards: um card por linha. `outbound` = funil 6 + etiqueta NTec + Canal de Entrada "Outbound";
--   cards ligados a uma AT da plataforma também são copiados (outbound = false quando não batem
--   com o filtro), para nenhuma AT ficar sem os dados do card.
-- pd_card_etapas: passagens do card pelas etapas (histórico do Pipedrive), refeitas a cada sync.
-- pd_tasks: tasks (activities) dos cards copiados.
--
-- Escrita só pela sincronização (service role: cron diário, webhook e o botão do admin). Leitura
-- só via server functions da dashboard (has_role antes).

CREATE TABLE IF NOT EXISTS public.pd_cards (
  deal_id bigint PRIMARY KEY,
  titulo text NOT NULL DEFAULT '',
  pipeline_id integer,
  stage_id integer,
  status text NOT NULL CHECK (status IN ('open', 'won', 'lost', 'deleted')),
  valor numeric(14, 2),
  moeda text,
  lost_reason text,
  add_time timestamptz,
  update_time timestamptz,
  stage_change_time timestamptz,
  won_time timestamptz,
  lost_time timestamptz,
  hunter_login text,            -- rótulo da opção do campo Hunter ("Nenhum" vira null)
  canal_entrada text,           -- rótulo do campo Canal de Entrada
  porte text,                   -- faixa de companies.porte, pelo campo Número de Funcionários
  person_id bigint,
  org_id bigint,
  cargo text,                   -- campo Cargo da pessoa do card
  etiquetas integer[] NOT NULL DEFAULT '{}',
  outbound boolean NOT NULL DEFAULT false,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pd_cards_outbound_idx ON public.pd_cards (outbound, status);
GRANT ALL ON public.pd_cards TO service_role;
ALTER TABLE public.pd_cards ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pd_card_etapas (
  deal_id bigint NOT NULL REFERENCES public.pd_cards(deal_id) ON DELETE CASCADE,
  stage_id integer NOT NULL,
  entrou_em timestamptz NOT NULL,
  saiu_em timestamptz,          -- null = etapa atual
  PRIMARY KEY (deal_id, entrou_em, stage_id),
  CONSTRAINT pd_card_etapas_ordem CHECK (saiu_em IS NULL OR saiu_em >= entrou_em)
);
GRANT ALL ON public.pd_card_etapas TO service_role;
ALTER TABLE public.pd_card_etapas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pd_tasks (
  activity_id bigint PRIMARY KEY,
  deal_id bigint NOT NULL REFERENCES public.pd_cards(deal_id) ON DELETE CASCADE,
  assunto text NOT NULL DEFAULT '',
  tipo text,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  marked_as_done_time timestamptz,
  add_time timestamptz,
  hunter_login text             -- o do card (as tasks têm o CN como dono)
);
CREATE INDEX IF NOT EXISTS pd_tasks_deal_idx ON public.pd_tasks (deal_id);
CREATE INDEX IF NOT EXISTS pd_tasks_hunter_due_idx ON public.pd_tasks (hunter_login, due_date);
GRANT ALL ON public.pd_tasks TO service_role;
ALTER TABLE public.pd_tasks ENABLE ROW LEVEL SECURITY;
