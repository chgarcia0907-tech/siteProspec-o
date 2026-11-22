-- Evento "reaberta": a AT volta para "agendada" sem mudar a data. Vem do Pipedrive quando o card
-- volta para uma etapa anterior à AT (ex.: de "AT Diag. Realizada" para "AT Diag. Agendada") sem
-- Resultado na task. Não usa "remarcada" porque isso contaria uma remarcação que não houve.
-- Pelo app não se registra (a política at_eventos_insert_app continua só com os quatro eventos).

ALTER TABLE public.at_eventos DROP CONSTRAINT IF EXISTS at_eventos_evento_check;
ALTER TABLE public.at_eventos ADD CONSTRAINT at_eventos_evento_check CHECK (
  evento IN ('marcada', 'remarcada', 'reaberta', 'no_show', 'realizada', 'cancelada', 'etapa_pipedrive')
);

-- Mesmo recálculo da migração 20261118164342, com "reaberta" valendo "agendada".
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
    SELECT CASE WHEN e.evento IN ('marcada', 'remarcada', 'reaberta') THEN 'agendada' ELSE e.evento END AS status,
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
