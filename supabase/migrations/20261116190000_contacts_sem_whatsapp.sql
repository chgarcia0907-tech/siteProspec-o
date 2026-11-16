-- Contato sem número de WhatsApp: as etapas de WhatsApp saem da cadência dele (filas, atrasados,
-- pendência de telefone e conclusão). Aditiva: todos os contatos existentes seguem como estão.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sem_whatsapp BOOLEAN NOT NULL DEFAULT false;

--
-- Atividade: "concluídas" (cadência inteira) também vale para contato sem WhatsApp, que não tem
-- as etapas 2 e 4. Mesma regra de `computedStatus` (cadencia.ts); o resto da função é igual à versão
-- de 20261116173900_ranking_sem_hackathon_encerrado.sql.
CREATE OR REPLACE FUNCTION public.ranking(period_start DATE)
RETURNS TABLE (
  hunter_id UUID,
  hunter_name TEXT,
  importados BIGINT,
  enviadas1 BIGINT,
  enviadas2 BIGINT,
  enviadas3 BIGINT,
  enviadas4 BIGINT,
  enviadas5 BIGINT,
  concluidas BIGINT,
  respostas BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, COALESCE(p.display_name, p.email, 'Hunter'),
    COUNT(c.id) FILTER (WHERE c.created_at::date >= period_start AND c.created_at::date <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent1_at >= period_start AND c.sent1_at <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent2_at >= period_start AND c.sent2_at <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent3_at >= period_start AND c.sent3_at <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent4_at >= period_start AND c.sent4_at <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start AND c.sent5_at <= c.lim),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start AND c.sent5_at <= c.lim AND c.sent1_at IS NOT NULL AND (c.sem_whatsapp OR c.sent2_at IS NOT NULL) AND c.sent3_at IS NOT NULL AND (c.sem_whatsapp OR c.sent4_at IS NOT NULL)),
    COUNT(c.id) FILTER (WHERE c.status = 'respondeu' AND c.updated_at::date >= period_start AND c.updated_at::date <= c.lim)
  FROM public.profiles p
  LEFT JOIN (
    SELECT ct.*,
      -- Último dia que ainda conta: o do encerramento, para card do Hackathon; sem limite nos demais.
      CASE WHEN hp.id IS NOT NULL AND ct.created_at <= hp.closed_at
        THEN (hp.closed_at AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE 'infinity'::date
      END AS lim
    FROM public.contacts ct
    LEFT JOIN public.periods hp
      ON hp.id = ct.period_id AND hp.kind = 'competicao' AND hp.status = 'closed'
  ) c ON c.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY p.id, p.display_name, p.email
$$;

REVOKE ALL ON FUNCTION public.ranking(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking(DATE) TO authenticated;
