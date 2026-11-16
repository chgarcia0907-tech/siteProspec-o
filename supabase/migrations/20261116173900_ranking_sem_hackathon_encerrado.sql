-- Atividade (aba "Competição" do painel): os cards do Hackathon encerrado deixam de somar
-- atividade depois do encerramento. Um card do Hackathon (período de competição encerrado, contato
-- criado até o encerramento) avançado ou enviado agora não pode contar nos números atuais.
--
-- O histórico do próprio Hackathon fica intacto: só os eventos com data posterior ao dia do
-- encerramento (fuso de São Paulo) saem da conta. Contato criado depois do encerramento, mesmo
-- carimbado no período do Hackathon (o trigger cai no último período quando não há ativo), é
-- contato novo e conta normalmente. Mesma assinatura e mesmas colunas da versão anterior
-- (20261115180000_ranking_somente_admin.sql).
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
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start AND c.sent5_at <= c.lim AND c.sent1_at IS NOT NULL AND c.sent2_at IS NOT NULL AND c.sent3_at IS NOT NULL AND c.sent4_at IS NOT NULL),
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
