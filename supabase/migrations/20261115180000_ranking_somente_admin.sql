-- O ranking passou a ser só do administrador (aba "Competição" do painel). A função continua
-- SECURITY DEFINER (agrega contatos de todos os hunters), mas devolve vazio para quem não é admin.
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
    COUNT(c.id) FILTER (WHERE c.created_at::date >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent1_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent2_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent3_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent4_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start),
    COUNT(c.id) FILTER (WHERE c.sent5_at >= period_start AND c.sent1_at IS NOT NULL AND c.sent2_at IS NOT NULL AND c.sent3_at IS NOT NULL AND c.sent4_at IS NOT NULL),
    COUNT(c.id) FILTER (WHERE c.status = 'respondeu' AND c.updated_at::date >= period_start)
  FROM public.profiles p
  LEFT JOIN public.contacts c ON c.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY p.id, p.display_name, p.email
$$;

REVOKE ALL ON FUNCTION public.ranking(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking(DATE) TO authenticated;
