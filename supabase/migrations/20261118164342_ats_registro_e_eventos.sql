-- Registro de ATs dentro da plataforma (antes só na planilha "Registro de ATs - NTec").
--
-- Fonte da verdade:
--   - Dados da prospecção (hunter, CN, canal, mensagem que converteu, prospect, motivo...) são da
--     plataforma: o hunter registra e edita aqui.
--   - Status e horário da AT vêm do Pipedrive quando a AT tem card (pipedrive_deal_id); sem card, o
--     hunter registra remarcação, no-show etc. pela própria plataforma.
--
-- ats: uma linha por AT. status e agendada_atual são um resumo mantido por trigger a partir de
--   at_eventos; não se escrevem direto (o authenticated não tem grant nessas colunas).
-- at_eventos: log só de inserção (marcada, remarcada, no_show, realizada, cancelada,
--   etapa_pipedrive). O número de remarcações e as métricas saem dele.
-- time_comercial: substitui a aba "Time" da planilha (login ↔ usuário e opção "Hunter" no Pipedrive).
-- pipedrive_webhook_log: payload bruto de cada webhook, para auditar e reprocessar.
--
-- Leitura: todo hunter logado vê todas as ATs e todos os eventos.
-- Ainda não mexe na competição: o placar segue lendo contacts.at_marcada_em/at_registrado_em.

-- ── time_comercial ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_comercial (
  login text PRIMARY KEY,                 -- ex.: "augustus.rivas" (como na planilha e no campo Hunter)
  nome text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('hunter', 'cn')),
  user_id uuid UNIQUE REFERENCES auth.users ON DELETE SET NULL,
  apelidos text[] NOT NULL DEFAULT '{}',  -- como a pessoa aparece marcada na ficha (@Sophia...)
  pipedrive_user_id bigint UNIQUE,
  pipedrive_hunter_option_id integer,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.time_comercial TO authenticated;
GRANT ALL ON public.time_comercial TO service_role;
ALTER TABLE public.time_comercial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_comercial_select_all ON public.time_comercial;
CREATE POLICY time_comercial_select_all ON public.time_comercial
  FOR SELECT TO authenticated USING (true);
-- Escrita só via service role (painel, has_role antes).

DROP TRIGGER IF EXISTS time_comercial_touch ON public.time_comercial;
CREATE TRIGGER time_comercial_touch BEFORE UPDATE ON public.time_comercial
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── ats ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'diagnostico' CHECK (tipo IN ('diagnostico', 'aprofundamento')),

  -- Quem: o hunter pode não ter conta (AT antiga da planilha), então o login fica junto.
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  hunter_login text,
  cn_login text,
  contact_id uuid REFERENCES public.contacts ON DELETE SET NULL,

  -- Prospecção (da plataforma).
  canal text,
  resposta_etapa smallint CHECK (resposta_etapa BETWEEN 0 AND 5), -- mensagem que converteu
  resposta_modelo text,
  empresa text NOT NULL,
  prospect text NOT NULL,
  cargo text,
  setor text,
  linkedin text,
  motivo_prospeccao text,
  ficha_original text,

  -- Agenda e status (resumo de at_eventos, mantido por trigger).
  agendada_original timestamptz NOT NULL,
  agendada_atual timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'realizada', 'no_show', 'cancelada')),
  status_em timestamptz,

  -- Pipedrive.
  pipedrive_deal_id bigint UNIQUE,
  pipedrive_person_id bigint,
  pipedrive_org_id bigint,
  pipedrive_stage_id integer,
  pipedrive_activity_at_id bigint,
  pipedrive_activity_tp1_id bigint,
  pipedrive_activity_tp3_id bigint,
  pipedrive_activity_tp4_id bigint,

  origem text NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'skill', 'planilha')),
  registrada_em timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ats_user_idx ON public.ats (user_id);
CREATE INDEX IF NOT EXISTS ats_contact_idx ON public.ats (contact_id);
CREATE INDEX IF NOT EXISTS ats_agendada_atual_idx ON public.ats (agendada_atual);
CREATE INDEX IF NOT EXISTS ats_registrada_em_idx ON public.ats (registrada_em);

-- O hunter registra e edita a prospecção; status, agenda atual e IDs do Pipedrive não.
GRANT SELECT ON public.ats TO authenticated;
GRANT INSERT (
  tipo, user_id, hunter_login, cn_login, contact_id, canal, resposta_etapa, resposta_modelo,
  empresa, prospect, cargo, setor, linkedin, motivo_prospeccao, ficha_original, agendada_original
) ON public.ats TO authenticated;
GRANT UPDATE (
  tipo, hunter_login, cn_login, contact_id, canal, resposta_etapa, resposta_modelo,
  empresa, prospect, cargo, setor, linkedin, motivo_prospeccao
) ON public.ats TO authenticated;
GRANT ALL ON public.ats TO service_role;
ALTER TABLE public.ats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ats_select_all ON public.ats;
CREATE POLICY ats_select_all ON public.ats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ats_insert_own ON public.ats;
CREATE POLICY ats_insert_own ON public.ats FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS ats_update_own ON public.ats;
CREATE POLICY ats_update_own ON public.ats FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Sem DELETE para authenticated: AT registrada errada se cancela (fica no log).

-- Na inserção a agenda atual começa na original; status e registro não vêm do cliente.
CREATE OR REPLACE FUNCTION public.ats_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.agendada_atual IS NULL OR current_user = 'authenticated' THEN
    NEW.agendada_atual := NEW.agendada_original;
  END IF;
  IF current_user = 'authenticated' THEN
    NEW.status := 'agendada';
    NEW.status_em := NULL;
    NEW.origem := 'app';
    NEW.registrada_em := now();
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ats_before_insert ON public.ats;
CREATE TRIGGER ats_before_insert BEFORE INSERT ON public.ats
FOR EACH ROW EXECUTE FUNCTION public.ats_before_insert();

DROP TRIGGER IF EXISTS ats_touch ON public.ats;
CREATE TRIGGER ats_touch BEFORE UPDATE ON public.ats
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── at_eventos ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.at_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at_id uuid NOT NULL REFERENCES public.ats ON DELETE CASCADE,
  evento text NOT NULL
    CHECK (evento IN ('marcada', 'remarcada', 'no_show', 'realizada', 'cancelada', 'etapa_pipedrive')),
  ocorrido_em timestamptz NOT NULL DEFAULT now(), -- quando aconteceu (no Pipedrive, a hora da mudança)
  horario_anterior timestamptz,                   -- remarcada: preenchido pelo trigger se vier vazio
  horario_novo timestamptz,                       -- marcada/remarcada
  motivo text,
  pipedrive_stage_id integer,                     -- etapa_pipedrive
  origem text NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app', 'skill', 'pipedrive_webhook', 'pipedrive_reconciliacao', 'planilha')),
  pipedrive_ref text,                             -- id do evento/versão no Pipedrive, evita duplicar
  autor uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_eventos_horario CHECK (evento NOT IN ('marcada', 'remarcada') OR horario_novo IS NOT NULL),
  CONSTRAINT at_eventos_etapa CHECK (evento <> 'etapa_pipedrive' OR pipedrive_stage_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS at_eventos_at_idx ON public.at_eventos (at_id, ocorrido_em);
CREATE UNIQUE INDEX IF NOT EXISTS at_eventos_pipedrive_ref_key
  ON public.at_eventos (origem, pipedrive_ref) WHERE pipedrive_ref IS NOT NULL;

GRANT SELECT ON public.at_eventos TO authenticated;
GRANT INSERT (at_id, evento, ocorrido_em, horario_anterior, horario_novo, motivo)
  ON public.at_eventos TO authenticated;
GRANT ALL ON public.at_eventos TO service_role;
ALTER TABLE public.at_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS at_eventos_select_all ON public.at_eventos;
CREATE POLICY at_eventos_select_all ON public.at_eventos FOR SELECT TO authenticated USING (true);
-- Pelo app só se registra evento de AT própria (ou admin) e sem card no Pipedrive: com card, o
-- status vem da integração. 'marcada' e 'etapa_pipedrive' não se inserem pelo app.
DROP POLICY IF EXISTS at_eventos_insert_app ON public.at_eventos;
CREATE POLICY at_eventos_insert_app ON public.at_eventos FOR INSERT TO authenticated
  WITH CHECK (
    evento IN ('remarcada', 'no_show', 'realizada', 'cancelada')
    AND EXISTS (
      SELECT 1 FROM public.ats a
      WHERE a.id = at_id
        AND a.pipedrive_deal_id IS NULL
        AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
-- Log só de inserção: sem UPDATE/DELETE para authenticated.

-- Carimba origem/autor e completa o horário anterior da remarcação.
CREATE OR REPLACE FUNCTION public.at_eventos_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.origem := 'app';
    NEW.autor := auth.uid();
    NEW.pipedrive_ref := NULL;
    NEW.pipedrive_stage_id := NULL;
  END IF;
  IF NEW.evento = 'remarcada' AND NEW.horario_anterior IS NULL THEN
    SELECT agendada_atual INTO NEW.horario_anterior FROM public.ats WHERE id = NEW.at_id;
  END IF;
  IF NEW.evento = 'remarcada' AND (NEW.motivo IS NULL OR btrim(NEW.motivo) = '')
     AND NEW.origem = 'app' THEN
    RAISE EXCEPTION 'Informe o motivo da remarcação';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS at_eventos_before_insert ON public.at_eventos;
CREATE TRIGGER at_eventos_before_insert BEFORE INSERT ON public.at_eventos
FOR EACH ROW EXECUTE FUNCTION public.at_eventos_before_insert();

-- Recalcula o resumo de ats a partir do log inteiro. Eventos podem chegar fora de ordem (webhook
-- atrasado, reconciliação), então cada campo sai do evento mais recente por ocorrido_em:
--   status/status_em ← último evento de agenda ou desfecho (marcada/remarcada = 'agendada');
--   agendada_atual ← horario_novo da última marcada/remarcada;
--   pipedrive_stage_id ← último etapa_pipedrive.
CREATE OR REPLACE FUNCTION public.at_eventos_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ats a SET
    status = COALESCE(s.status, a.status),
    status_em = COALESCE(s.ocorrido_em, a.status_em),
    agendada_atual = COALESCE(h.horario_novo, a.agendada_atual),
    pipedrive_stage_id = COALESCE(p.pipedrive_stage_id, a.pipedrive_stage_id)
  FROM (SELECT 1) AS um
  LEFT JOIN LATERAL (
    SELECT CASE WHEN e.evento IN ('marcada', 'remarcada') THEN 'agendada' ELSE e.evento END AS status,
           e.ocorrido_em
    FROM at_eventos e
    WHERE e.at_id = NEW.at_id AND e.evento <> 'etapa_pipedrive'
    ORDER BY e.ocorrido_em DESC, e.created_at DESC LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT e.horario_novo FROM at_eventos e
    WHERE e.at_id = NEW.at_id AND e.evento IN ('marcada', 'remarcada')
    ORDER BY e.ocorrido_em DESC, e.created_at DESC LIMIT 1
  ) h ON true
  LEFT JOIN LATERAL (
    SELECT e.pipedrive_stage_id FROM at_eventos e
    WHERE e.at_id = NEW.at_id AND e.evento = 'etapa_pipedrive'
    ORDER BY e.ocorrido_em DESC, e.created_at DESC LIMIT 1
  ) p ON true
  WHERE a.id = NEW.at_id;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.at_eventos_apply() FROM anon, public;

DROP TRIGGER IF EXISTS at_eventos_apply ON public.at_eventos;
CREATE TRIGGER at_eventos_apply AFTER INSERT ON public.at_eventos
FOR EACH ROW EXECUTE FUNCTION public.at_eventos_apply();

-- Toda AT nova ganha o evento 'marcada' (a carga da planilha traz o próprio histórico).
CREATE OR REPLACE FUNCTION public.ats_log_marcada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.origem <> 'planilha' THEN
    INSERT INTO at_eventos (at_id, evento, ocorrido_em, horario_novo, origem, autor)
    VALUES (NEW.id, 'marcada', NEW.registrada_em, NEW.agendada_original,
            CASE WHEN NEW.origem = 'skill' THEN 'skill' ELSE 'app' END, NEW.created_by);
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.ats_log_marcada() FROM anon, public;

DROP TRIGGER IF EXISTS ats_log_marcada ON public.ats;
CREATE TRIGGER ats_log_marcada AFTER INSERT ON public.ats
FOR EACH ROW EXECUTE FUNCTION public.ats_log_marcada();

-- ── pipedrive_webhook_log ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipedrive_webhook_log (
  id bigserial PRIMARY KEY,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  evento text,           -- ex.: "change.deal", "change.activity"
  objeto_id bigint,
  payload jsonb NOT NULL,
  processado_em timestamptz,
  erro text
);
CREATE INDEX IF NOT EXISTS pipedrive_webhook_log_pendente_idx
  ON public.pipedrive_webhook_log (recebido_em) WHERE processado_em IS NULL;
GRANT ALL ON public.pipedrive_webhook_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pipedrive_webhook_log_id_seq TO service_role;
ALTER TABLE public.pipedrive_webhook_log ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: só o endpoint do webhook (service role) lê e escreve.
