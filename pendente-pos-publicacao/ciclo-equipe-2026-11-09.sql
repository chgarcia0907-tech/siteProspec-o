-- Ciclo da equipe a partir de 09/11/2026: Lais, Mariana, Gabriela Batista, Yasmin Aguiar,
-- João Coelho e Enzo Camargos.
--
-- Não apaga contatos, pontos nem placares antigos: só define quem é a equipe do ciclo ativo e
-- desde quando ele conta. Indicadores, Competição (ranking e atividade) e a planilha
-- (?visao=ciclo) passam a mostrar só essas pessoas a partir de 09/11; o histórico continua nos
-- outros períodos do filtro, em "Competição geral" e em "Todos os hunters".
--
-- Rode no SQL Editor do Supabase (projeto ctxsmboaqbjgslctojeq) DEPOIS do deploy, em duas etapas.

-- 1) Conferência: cada nome deve achar exatamente 1 pessoa. Se algum achar 0 ou 2+, ajuste o
--    padrão correspondente nas duas consultas (ex.: 'mariana %' → 'mariana sobrenome%').
WITH alvo(padrao) AS (
  VALUES ('lais%'), ('mariana%'), ('gabriela batista%'), ('yasmin aguiar%'),
         ('joao coelho%'), ('enzo camargos%')
), perfis AS (
  SELECT id, display_name, email,
         translate(lower(coalesce(display_name, '')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') AS nome
  FROM public.profiles
)
SELECT a.padrao, count(p.id) AS encontrados,
       string_agg(coalesce(p.display_name, p.email), ', ') AS quem
FROM alvo a LEFT JOIN perfis p ON p.nome LIKE a.padrao
GROUP BY a.padrao ORDER BY a.padrao;

-- 2) Aplicação (só rode se a conferência deu 1 em todas as linhas).
DO $$
DECLARE
  padroes text[] := ARRAY['lais%', 'mariana%', 'gabriela batista%', 'yasmin aguiar%',
                          'joao coelho%', 'enzo camargos%'];
  pad text;
  ids uuid[] := '{}';
  achados uuid[];
  ativo public.periods%ROWTYPE;
  ciclo_id uuid;
  fora text;
BEGIN
  FOREACH pad IN ARRAY padroes LOOP
    SELECT array_agg(id) INTO achados FROM public.profiles
    WHERE translate(lower(coalesce(display_name, '')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') LIKE pad;
    IF coalesce(array_length(achados, 1), 0) <> 1 THEN
      RAISE EXCEPTION 'O padrão "%" achou % pessoas; ajuste antes de continuar.',
        pad, coalesce(array_length(achados, 1), 0);
    END IF;
    ids := ids || achados;
  END LOOP;

  SELECT * INTO ativo FROM public.periods WHERE status = 'active';
  IF FOUND AND ativo.kind <> 'ciclo' THEN
    RAISE EXCEPTION 'O período ativo "%" é uma competição. Encerre-o em /painel → Períodos '
      '(isso congela o placar dele) e rode este script de novo.', ativo.name;
  END IF;

  IF FOUND THEN
    ciclo_id := ativo.id;
    UPDATE public.periods SET started_at = '2026-11-09T00:00:00-03:00' WHERE id = ciclo_id;
  ELSE
    INSERT INTO public.periods (name, kind, status, started_at)
    VALUES ('Ciclo equipe 09/11', 'ciclo', 'active', '2026-11-09T00:00:00-03:00')
    RETURNING id INTO ciclo_id;
  END IF;

  -- Quem estava no ciclo e não faz parte da equipe sai da lista de membros (só a lista:
  -- contatos e conta continuam intactos; dá para readicionar pelo painel).
  SELECT string_agg(coalesce(p.display_name, p.email), ', ') INTO fora
  FROM public.period_members m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.period_id = ciclo_id AND m.user_id <> ALL (ids);
  IF fora IS NOT NULL THEN
    RAISE NOTICE 'Saem da lista de membros do ciclo: %', fora;
  END IF;
  DELETE FROM public.period_members WHERE period_id = ciclo_id AND user_id <> ALL (ids);

  INSERT INTO public.period_members (period_id, user_id)
  SELECT ciclo_id, unnest(ids)
  ON CONFLICT (period_id, user_id) DO NOTHING;
END $$;
