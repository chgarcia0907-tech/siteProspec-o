-- Cadências por setor e persona do NTec (documento "Mensagens por Setor e Persona · NTec", 22/11/2026,
-- versão revisada: dor como padrão do segmento, case em "mapeamos, desenvolvemos, resultado" e dados de mercado).
--
-- Rodar no SQL Editor do Supabase de produção (ctxsmboaqbjgslctojeq), uma vez, depois de aplicada
-- a migração 20261122185416_endurece_subsetor_persona.sql. Tudo roda numa transação: se uma
-- conferência falhar, nada é gravado.
--
-- O que faz:
--   1. Acha (ou cria) os setores Logística, Real Estate, Indústria, Energia e Saúde e os subsetores
--      de Indústria: Alimentício, Automobilístico + autopeças e Farmacêutica e cosméticos.
--      O nome é comparado sem acento, sem maiúsculas e com alguns apelidos (lista em `alvo`).
--      Setores encontrados inativos voltam a ficar ativos.
--   2. SUBSTITUI a cadência inteira desses 8 setores (apaga as linhas atuais deles e grava as novas).
--      Setores fora da lista não são tocados.
--   3. Grava, por setor, 14 mensagens (112 no total):
--        qualquer persona ('')     etapas 1-3 = Owner da Operação (o documento manda substituir a aba
--                                  "Qualquer persona" por elas) e etapas 4-5 = pedido direto e despedida
--        owner_processo            etapas 1-3
--        patrocinador_executivo    etapas 1-3
--        owner_tecnologia          etapas 1-3 (TEC-TI-*, iguais em todos os setores)
--      Etapas 4-5 das personas caem na aba "Qualquer persona" (ordem do resolveTemplate:
--      subsetor+persona, subsetor, setor+persona, setor, modelo padrão). A persona TI vai também
--      nos subsetores porque, senão, o "qualquer persona" do subsetor venceria o setor+TI.
--
-- Antes de rodar, veja (e guarde, se quiser) o que existe hoje:
--   SELECT s.name, p.name AS pai, s.active, t.persona, t.step, t.code
--   FROM sectors s LEFT JOIN sectors p ON p.id = s.parent_id
--   LEFT JOIN sector_templates t ON t.sector_id = s.id
--   ORDER BY coalesce(p.name, s.name), s.parent_id NULLS FIRST, s.name, t.persona, t.step;

BEGIN;

CREATE FUNCTION pg_temp.norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(translate(coalesce(t, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')));
$$;

-- Setores-alvo: chave do código da mensagem, nome usado se for preciso criar, pai e apelidos
-- (já sem acento e em minúsculas) aceitos para achar o setor que já existe.
CREATE TEMP TABLE alvo (
  chave text PRIMARY KEY,
  nome text NOT NULL,
  pai text,
  apelidos text[] NOT NULL,
  ordem int NOT NULL,
  id uuid
) ON COMMIT DROP;

INSERT INTO alvo (chave, nome, pai, apelidos, ordem) VALUES
  ('LOG', 'Logística', NULL, ARRAY['logistica', 'logistica e transporte', 'transporte e logistica'], 1),
  ('RE', 'Real Estate', NULL, ARRAY['real estate', 'construtoras e incorporadoras', 'construcao civil', 'construcao', 'imobiliario'], 2),
  ('IND', 'Indústria', NULL, ARRAY['industria'], 3),
  ('ENE', 'Energia', NULL, ARRAY['energia'], 4),
  ('SAU', 'Saúde', NULL, ARRAY['saude'], 5),
  ('ALI', 'Alimentício', 'IND', ARRAY['alimenticio', 'alimentos', 'alimentos e bebidas'], 1),
  ('AUT', 'Automobilístico + autopeças', 'IND', ARRAY['automobilistico + autopecas', 'automobilistico e autopecas', 'automobilistico', 'automotivo', 'autopecas'], 2),
  ('FAR', 'Farmacêutica e cosméticos', 'IND', ARRAY['farmaceutica e cosmeticos', 'farmaceutico e cosmeticos', 'farmaceutica', 'farmaceutico'], 3);

DO $$
DECLARE
  a record;
  v_pai uuid;
  v_ids uuid[];
  v_id uuid;
BEGIN
  -- Setores de primeiro nível primeiro, depois os subsetores (precisam do id do pai).
  FOR a IN SELECT * FROM alvo ORDER BY (pai IS NOT NULL), ordem LOOP
    v_pai := (SELECT id FROM alvo WHERE chave = a.pai);

    SELECT array_agg(s.id) INTO v_ids
    FROM sectors s
    WHERE s.parent_id IS NOT DISTINCT FROM v_pai
      AND pg_temp.norm(s.name) = ANY (a.apelidos);

    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
      RAISE EXCEPTION 'Mais de um setor casa com "%": renomeie ou ajuste os apelidos', a.nome;
    END IF;

    IF v_ids IS NULL THEN
      INSERT INTO sectors (name, parent_id, sort)
      VALUES (
        a.nome,
        v_pai,
        coalesce((SELECT max(sort) + 1 FROM sectors WHERE parent_id IS NOT DISTINCT FROM v_pai), 0)
      )
      RETURNING id INTO v_id;
      RAISE NOTICE 'Criado: %', a.nome;
    ELSE
      v_id := v_ids[1];
      UPDATE sectors SET active = true WHERE id = v_id AND NOT active;
      RAISE NOTICE 'Encontrado: % (%)', a.nome, (SELECT name FROM sectors WHERE id = v_id);
    END IF;

    UPDATE alvo SET id = v_id WHERE chave = a.chave;
  END LOOP;
END $$;

-- Substitui a cadência inteira dos 8 setores.
DELETE FROM sector_templates WHERE sector_id IN (SELECT id FROM alvo);

INSERT INTO sector_templates (sector_id, persona, step, code, body)
SELECT a.id, v.persona, v.step, v.code, v.body
FROM (VALUES
  ('LOG', '', 1, 'LOG-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em operações logísticas do porte [DA_EMPRESA] é a conferência ainda passar por planilha de divergência. É ela que costuma travar primeiro com mais volume.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria (229 segundos por peça) e desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na operação [DA_EMPRESA]?$msg$),
  ('LOG', '', 2, 'LOG-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

O custo logístico já consome 12,3% do faturamento das empresas brasileiras (Fundação Dom Cabral). É comum boa parte disso estar em conferência e retrabalho. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', '', 3, 'LOG-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

O ILOS estima que o custo logístico chegou a 15,5% do PIB brasileiro em 2025. Uma parte costuma estar no que ninguém mede, como conferir de novo o que já foi conferido.

No outlet que atendemos, primeiro cronometramos a auditoria, depois desenvolvemos a plataforma que gera os documentos sozinha. Em 10 mil itens por mês, cada minuto a menos por item devolve mais de 160 horas ao time.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('LOG', '', 4, 'LOG-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em logística, é comum o gargalo aparecer como hora extra e planilha, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na operação [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('LOG', '', 5, 'LOG-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. O custo logístico já consome 12,3% do faturamento das empresas brasileiras (Fundação Dom Cabral).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de conferência, estoque e expedição [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('LOG', 'owner_processo', 1, 'LOG-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em centros de distribuição, um dos retrabalhos que mais encontramos é a mesma informação ser digitada duas vezes, da planilha para o relatório. É ali que o erro costuma aparecer.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, acompanhamos a auditoria e depois desenvolvemos um sistema em que o dado entra uma vez e os documentos saem prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a planilha mais gera retrabalho no seu dia a dia?$msg$),
  ('LOG', 'owner_processo', 2, 'LOG-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Na conferência, isso costuma virar divergência para caçar depois. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', 'owner_processo', 3, 'LOG-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Em logística, é comum o custo do erro aparecer depois, em devolução, reentrega e inventário refeito. O ILOS estima que o custo logístico chegou a 15,5% do PIB brasileiro em 2025.

No outlet que atendemos, mapeamos cada passo da auditoria antes de desenvolver qualquer tela. Depois entregamos o sistema, e os documentos passaram a sair prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na conferência [DA_EMPRESA]?$msg$),
  ('LOG', 'patrocinador_executivo', 1, 'LOG-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo logístico já consome 12,3% do faturamento das empresas brasileiras (Fundação Dom Cabral). Em operações que crescem, é comum cada pedido a mais exigir mais gente conferindo.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria e depois desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto os gargalos da operação [DA_EMPRESA] custam por ano, antes do orçamento de 2027?$msg$),
  ('LOG', 'patrocinador_executivo', 2, 'LOG-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Com a Selic em 13,75%, crescer sem aumentar estrutura costuma virar prioridade em 2027. Em logística, conferência e retrabalho costumam ser o primeiro lugar a olhar. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', 'patrocinador_executivo', 3, 'LOG-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('RE', '', 1, 'RE-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em construtoras do porte [DA_EMPRESA] é o diário de obra só virar planilha no fim do dia.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a Modera, mapeamos o caminho da informação até o escritório e desenvolvemos um app de obras que funciona offline. O cliente nos avaliou como o melhor time de tecnologia com que já trabalhou.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos os principais gargalos nas obras [DA_EMPRESA]?$msg$),
  ('RE', '', 2, 'RE-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A Deloitte estima que obras imobiliárias chegam a durar até 13 meses a mais por ineficiência. É comum parte disso ser informação do canteiro que chega tarde. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', '', 3, 'RE-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Segundo a Deloitte, a ineficiência custou cerca de R$ 59 bilhões à construção entre 2023 e 2025. É comum o atraso começar pequeno, num checklist que fica no papel até o fim da semana.

Na Modera, o app que desenvolvemos registra a obra no celular, mesmo sem sinal, sem depender de papel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a informação do canteiro mais atrasa [NA_EMPRESA]?$msg$),
  ('RE', '', 4, 'RE-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em construtoras, é comum o gargalo aparecer como medição refeita e planilha, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso nas obras [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('RE', '', 5, 'RE-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. A ineficiência custou cerca de R$ 59 bilhões à construção entre 2023 e 2025 (Deloitte para a Fiesp).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de obras, planejamento ou engenharia [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('RE', 'owner_processo', 1, 'RE-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em construtoras e incorporadoras, um dos retrabalhos que mais encontramos é cada área manter sua planilha e alguém consolidar tudo no fim do dia. É ali que as versões costumam se desencontrar.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a CTE, primeiro mapeamos quem usava cada informação da obra, depois desenvolvemos um sistema único em que cada perfil acessa só o que precisa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde as planilhas paralelas mais geram retrabalho nas obras?$msg$),
  ('RE', 'owner_processo', 2, 'RE-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em obra, isso costuma virar medição e pedido de compra refeitos. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', 'owner_processo', 3, 'RE-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A Deloitte estima que obras imobiliárias chegam a durar até 13 meses a mais por ineficiência. É comum parte disso nascer em informação espalhada em planilhas paralelas.

Na CTE, juntamos essas planilhas num sistema único, com um perfil para cada área. Na Modera, levamos o registro da obra para o celular, offline.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso pesa mais nas obras [DA_EMPRESA]?$msg$),
  ('RE', 'patrocinador_executivo', 1, 'RE-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Ineficiência e atrasos custaram cerca de R$ 59 bilhões à construção entre 2023 e 2025 (Deloitte para a Fiesp). É comum parte disso vir de informação do campo que chega tarde.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a Modera e a CTE, desenvolvemos sistemas de gestão de obras que levam o registro do canteiro ao escritório.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto esses atrasos custam por ano, antes do orçamento de 2027?$msg$),
  ('RE', 'patrocinador_executivo', 2, 'RE-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Com a Selic em 13,75%, cada mês a mais de obra pesa mais no custo financeiro. É comum parte do atraso vir de informação de campo que chega tarde. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', 'patrocinador_executivo', 3, 'RE-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para as obras [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('IND', '', 1, 'IND-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em fábricas do porte [DA_EMPRESA] é apontamento e paradas ainda irem do papel para a planilha. É aí que a perda costuma ficar invisível.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria (229 segundos por peça) e desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos no chão de fábrica [DA_EMPRESA]?$msg$),
  ('IND', '', 2, 'IND-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção industrial caiu 0,8% em setembro, o segundo mês seguido de queda (IBGE). Nesse cenário, é comum a cobrança ser produzir mais com a mesma equipe. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', '', 3, 'IND-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A Siemens estima que as 500 maiores indústrias do mundo perdem cerca de 11% da receita com paradas não planejadas. É comum a parada nem chegar ao relatório quando o apontamento é no papel.

Nosso jeito de trabalhar é primeiro medir o processo e depois desenvolver o app que registra no momento em que acontece. Foi assim no outlet que atendemos, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('IND', '', 4, 'IND-WT02', $msg$[SAUDACAO], [FIRST NAME]! Na indústria, é comum o gargalo aparecer como hora extra e apontamento refeito, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('IND', '', 5, 'IND-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. As 500 maiores indústrias do mundo perdem cerca de 11% da receita com paradas não planejadas (Siemens, 2024).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de produção, qualidade ou manutenção [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('IND', 'owner_processo', 1, 'IND-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

No chão de fábrica, um dos retrabalhos que mais encontramos é o mesmo apontamento ser escrito no papel e digitado de novo na planilha. Somado no mês, costuma virar dias de trabalho.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, acompanhamos a auditoria e depois desenvolvemos um sistema em que o dado entra uma vez e os documentos saem prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o apontamento manual mais gera retrabalho?$msg$),
  ('IND', 'owner_processo', 2, 'IND-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em apontamento de produção, isso costuma virar relatório refeito. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', 'owner_processo', 3, 'IND-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Com a produção industrial em queda há dois meses (IBGE), é comum o time ser cobrado por mais resultado sem ganhar gente. O apontamento manual costuma ser a primeira hora que dá para devolver.

No outlet que atendemos, o sistema que desenvolvemos passou a gerar os relatórios da auditoria sozinho, em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('IND', 'patrocinador_executivo', 1, 'IND-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

As 500 maiores indústrias do mundo perdem cerca de 11% da receita com paradas não planejadas (Siemens, 2024). É comum parte dessa perda nem ser medida.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria e depois desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto as perdas não medidas custam à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('IND', 'patrocinador_executivo', 2, 'IND-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Com a Selic em 13,75% e a produção industrial em queda (IBGE), crescer sem aumentar estrutura costuma virar prioridade em 2027. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', 'patrocinador_executivo', 3, 'IND-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a produção [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('ALI', '', 1, 'ALI-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em indústrias de alimentos do porte [DA_EMPRESA] é o controle de lote ainda ir do papel para a planilha. É o ponto que costuma pesar numa auditoria.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria (229 segundos por peça) e desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na produção [DA_EMPRESA]?$msg$),
  ('ALI', '', 2, 'ALI-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção de alimentos ficou 5,9% abaixo de setembro de 2025 (IBGE). Com volume menor, é comum a cobrança ser cortar perda e retrabalho. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', '', 3, 'ALI-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Um recall custa em média US$ 10 milhões em custos diretos a uma empresa de alimentos (FMI e GMA). É comum a conta crescer quando achar um lote depende de planilha.

No outlet que atendemos, primeiro medimos a auditoria, depois desenvolvemos o sistema que a registra, com até 70% de ganho mapeado. O mesmo método serve para lote e qualidade.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na produção [DA_EMPRESA]?$msg$),
  ('ALI', '', 4, 'ALI-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em alimentos, é comum o gargalo aparecer como registro refeito e lote difícil de achar, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('ALI', '', 5, 'ALI-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. Um recall custa em média US$ 10 milhões em custos diretos a uma empresa de alimentos (FMI e GMA).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de qualidade, produção ou PCP [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('ALI', 'owner_processo', 1, 'ALI-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Na qualidade de indústrias de alimentos, um dos retrabalhos que mais encontramos é o mesmo registro ser preenchido no papel e digitado de novo na planilha.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, acompanhamos a auditoria e depois desenvolvemos um sistema em que o dado entra uma vez e os documentos saem prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o registro manual de qualidade mais gera retrabalho?$msg$),
  ('ALI', 'owner_processo', 2, 'ALI-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em registro de lote, isso costuma virar não conformidade. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', 'owner_processo', 3, 'ALI-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Num recall, cada hora para achar o lote conta. Um recall custa em média US$ 10 milhões em custos diretos a uma empresa de alimentos (FMI e GMA).

No outlet que atendemos, o sistema que desenvolvemos tirou a digitação do caminho, e os documentos da auditoria passaram a sair prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('ALI', 'patrocinador_executivo', 1, 'ALI-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um recall custa em média US$ 10 milhões em custos diretos a uma empresa de alimentos (FMI e GMA). É comum a conta crescer quando a rastreabilidade é feita em planilha.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria e depois desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a falta de rastreabilidade custa por ano, antes do orçamento de 2027?$msg$),
  ('ALI', 'patrocinador_executivo', 2, 'ALI-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção de alimentos ficou 5,9% abaixo de setembro de 2025 (IBGE). Com volume menor e Selic em 13,75%, é comum a prioridade de 2027 ser cortar perda. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', 'patrocinador_executivo', 3, 'ALI-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a produção [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('AUT', '', 1, 'AUT-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em autopeças do porte [DA_EMPRESA] é inspeção e refugo ainda passarem por papel e planilha. É aí que o refugo costuma ficar sem medida.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria (229 segundos por peça) e desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos no chão de fábrica [DA_EMPRESA]?$msg$),
  ('AUT', '', 2, 'AUT-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção de veículos ficou 7,3% acima de setembro de 2025 (IBGE). Para fornecedores, é comum isso virar mais pedido com a mesma equipe. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', '', 3, 'AUT-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Numa grande fábrica automotiva, uma hora de linha parada pode custar até US$ 2,3 milhões (Siemens, 2024). Para fornecedores, é comum cada atraso de peça virar cobrança do cliente.

No outlet que atendemos, primeiro medimos a auditoria peça a peça, depois desenvolvemos o sistema que a registra, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('AUT', '', 4, 'AUT-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em autopeças, é comum o gargalo aparecer como refugo e relatório refeito, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('AUT', '', 5, 'AUT-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. A produção de veículos ficou 7,3% acima de setembro de 2025 (IBGE). É comum esse volume chegar antes da estrutura.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de engenharia industrial, qualidade ou produção [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('AUT', 'owner_processo', 1, 'AUT-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em autopeças, um dos retrabalhos que mais encontramos é montar à mão o relatório de inspeção e o de não conformidade de cada cliente. Com mais volume, isso costuma consumir horas por semana.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, acompanhamos a auditoria e depois desenvolvemos um sistema em que o dado entra uma vez e os documentos saem prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o relatório manual mais gera retrabalho?$msg$),
  ('AUT', 'owner_processo', 2, 'AUT-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em inspeção, isso costuma virar não conformidade. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', 'owner_processo', 3, 'AUT-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A produção de veículos ficou 7,3% acima de setembro de 2025 (IBGE). É comum o volume de relatórios crescer mais rápido que o time.

No outlet que atendemos, o sistema que desenvolvemos passou a gerar os relatórios sozinho, em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('AUT', 'patrocinador_executivo', 1, 'AUT-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Numa grande fábrica automotiva, uma hora de linha parada pode custar até US$ 2,3 milhões (Siemens, 2024). Para fornecedores, é comum cada refugo não medido virar atraso de entrega.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, medimos a auditoria e depois desenvolvemos o sistema que a digitaliza, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto o refugo custa à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('AUT', 'patrocinador_executivo', 2, 'AUT-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção de veículos ficou 7,3% acima de setembro de 2025 (IBGE). Para fornecedores, crescer sem aumentar estrutura costuma virar prioridade em 2027. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', 'patrocinador_executivo', 3, 'AUT-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a produção [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('FAR', '', 1, 'FAR-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em farma e cosméticos do porte [DA_EMPRESA] é registro de lote e documentação de auditoria ainda rodarem em planilha. É o ponto que costuma pesar numa inspeção.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Num grande outlet de roupas, acompanhamos a auditoria e depois desenvolvemos um sistema em que o dado entra uma vez e os documentos saem prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na produção [DA_EMPRESA]?$msg$),
  ('FAR', '', 2, 'FAR-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção farmacêutica ficou 17% abaixo de setembro de 2025 (IBGE). Com volume menor, é comum a cobrança ser cortar perda e retrabalho. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', '', 3, 'FAR-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo da má qualidade pode chegar a 15% a 20% das vendas na indústria (Autodesk). Em farma, é comum ele aparecer em lote reprovado e documentação refeita.

No CalcSoro, primeiro entendemos como a médica refazia o cálculo de soro em planilha, depois desenvolvemos um sistema que faz o cálculo sozinho, pelas regras dela.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na produção [DA_EMPRESA]?$msg$),
  ('FAR', '', 4, 'FAR-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em farma, é comum o gargalo aparecer como documentação refeita para a auditoria, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('FAR', '', 5, 'FAR-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. O custo da má qualidade pode chegar a 15% a 20% das vendas na indústria (Autodesk).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de qualidade, produção ou assuntos regulatórios [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('FAR', 'owner_processo', 1, 'FAR-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em farma e cosméticos, um dos retrabalhos que mais encontramos é o mesmo dado de lote ser registrado no papel, digitado na planilha e conferido de novo para a auditoria.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). No CalcSoro, primeiro entendemos como a médica refazia o cálculo de soro em planilha, depois desenvolvemos um sistema que faz o cálculo sozinho, pelas regras dela.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a digitação repetida mais gera retrabalho?$msg$),
  ('FAR', 'owner_processo', 2, 'FAR-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em registro de lote, isso costuma virar desvio para investigar. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', 'owner_processo', 3, 'FAR-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo da má qualidade pode chegar a 15% a 20% das vendas na indústria (Autodesk). É comum ele começar num dado digitado duas vezes.

No outlet que atendemos, o sistema que desenvolvemos fez o dado entrar uma vez, e os documentos da auditoria passaram a sair prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('FAR', 'patrocinador_executivo', 1, 'FAR-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo da má qualidade pode chegar a 15% a 20% das vendas na indústria (Autodesk). É comum ele aparecer em lote reprovado.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). No CalcSoro, entendemos como a médica refazia o cálculo em planilha e depois desenvolvemos um sistema que o faz sozinho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a documentação manual custa à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('FAR', 'patrocinador_executivo', 2, 'FAR-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

A produção farmacêutica ficou 17% abaixo de setembro de 2025 (IBGE). Com volume menor e Selic em 13,75%, é comum a prioridade de 2027 ser cortar perda. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', 'patrocinador_executivo', 3, 'FAR-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a produção [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('ENE', '', 1, 'ENE-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em operações de energia é ordem de serviço e inspeção voltarem do campo em papel ou foto no WhatsApp. É aí que a manutenção costuma perder tempo.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a Modera, desenvolvemos um app de registro de campo que funciona offline. Para o Nautilus, um sistema que centraliza ocorrências num mapa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na manutenção [DA_EMPRESA]?$msg$),
  ('ENE', '', 2, 'ENE-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Segundo a ABB, 44% das indústrias enfrentam falhas de equipamento ao menos uma vez por mês. É comum a demora estar em fazer a informação do campo chegar. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', '', 3, 'ENE-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Para 76% dos líderes industriais, uma hora de parada não planejada custa até US$ 500 mil (ABB, 2025). É comum parte desse tempo ir para achar a informação do campo.

Para o Nautilus, primeiro mapeamos como as ocorrências chegavam, depois desenvolvemos um sistema que as centraliza e mostra no mapa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a informação de campo mais atrasa [NA_EMPRESA]?$msg$),
  ('ENE', '', 4, 'ENE-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em energia, é comum o gargalo aparecer como ordem de serviço parada e foto no WhatsApp, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na manutenção [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('ENE', '', 5, 'ENE-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. Segundo a ABB, 44% das indústrias enfrentam falhas de equipamento ao menos uma vez por mês.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de manutenção, operação ou campo [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('ENE', 'owner_processo', 1, 'ENE-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em energia, um dos retrabalhos que mais encontramos é o técnico preencher a ordem de serviço no papel e alguém digitar tudo de novo no escritório.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a Modera, primeiro entendemos como o registro saía do campo, depois desenvolvemos um app em que ele é feito no celular, mesmo sem sinal, sem redigitar.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o controle de campo mais gera retrabalho?$msg$),
  ('ENE', 'owner_processo', 2, 'ENE-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em ordem de serviço, isso costuma virar histórico de manutenção incompleto. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', 'owner_processo', 3, 'ENE-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Segundo a ABB, 44% das indústrias enfrentam falhas de equipamento ao menos uma vez por mês. É comum cada falha gerar uma nova rodada de papel, foto e planilha.

Na Modera, o registro de campo passou para o celular, offline. No Nautilus, as ocorrências ficaram centralizadas num mapa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('ENE', 'patrocinador_executivo', 1, 'ENE-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Para 76% dos líderes industriais, uma hora de parada não planejada custa até US$ 500 mil, e 44% enfrentam falhas ao menos uma vez por mês (ABB, 2025).

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Para a Modera e o Nautilus, desenvolvemos sistemas que levam o registro de campo para o celular e centralizam ocorrências num mapa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a resposta tardia em campo custa por ano, antes do orçamento de 2027?$msg$),
  ('ENE', 'patrocinador_executivo', 2, 'ENE-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Com a Selic em 13,75%, crescer sem aumentar estrutura costuma virar prioridade em 2027. Em energia, a resposta do campo costuma ser o primeiro lugar a olhar. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', 'patrocinador_executivo', 3, 'ENE-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('SAU', '', 1, 'SAU-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em hospitais e clínicas é conferências e controles do dia a dia ainda rodarem em planilha, refeitos a cada atendimento. É onde a equipe costuma perder tempo.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). No CalcSoro, primeiro entendemos como a médica refazia o cálculo de soro em planilha, depois desenvolvemos um sistema que faz o cálculo sozinho, pelas regras dela.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na operação [DA_EMPRESA]?$msg$),
  ('SAU', '', 2, 'SAU-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp). É comum parte disso começar num dado digitado errado. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', '', 3, 'SAU-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em saúde, é comum esse erro aparecer depois, como conta refeita ou glosa.

No CalcSoro, o sistema que desenvolvemos fez o cálculo sair sozinho, sem planilha no meio.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na operação [DA_EMPRESA]?$msg$),
  ('SAU', '', 4, 'SAU-WT02', $msg$[SAUDACAO], [FIRST NAME]! Em saúde, é comum o gargalo aparecer como conta refeita e glosa, não como pedido de sistema. A ideia é somar ao time, não substituir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso no faturamento [DA_EMPRESA]? Se não for o momento, me avisa.$msg$),
  ('SAU', '', 5, 'SAU-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Deixo um dado para o planejamento de 2027. Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de faturamento e auditoria de contas [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('SAU', 'owner_processo', 1, 'SAU-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em hospitais e clínicas, um dos retrabalhos que mais encontramos é o mesmo dado do paciente ou da conta ser digitado em mais de uma planilha. É ali que o erro costuma nascer.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). No CalcSoro, primeiro entendemos a rotina, depois desenvolvemos um sistema em que os dados do paciente entram uma vez e o cálculo sai pronto.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a digitação repetida mais gera retrabalho?$msg$),
  ('SAU', 'owner_processo', 2, 'SAU-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em contas médicas, isso costuma virar glosa. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', 'owner_processo', 3, 'SAU-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp). É comum parte disso nascer em dado digitado duas vezes.

No CalcSoro, o sistema que desenvolvemos tirou a planilha do meio do caminho, pelas regras da própria médica.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece no seu dia a dia?$msg$),
  ('SAU', 'patrocinador_executivo', 1, 'SAU-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp). É comum cada conta com erro virar risco de glosa.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). No CalcSoro, entendemos como a médica refazia o cálculo em planilha e depois desenvolvemos um sistema que o faz sozinho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto as glosas e o retrabalho custam à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('SAU', 'patrocinador_executivo', 2, 'SAU-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp). É comum a conta começar em erro de digitação. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', 'patrocinador_executivo', 3, 'SAU-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos com as áreas, estimamos mais de 2.000 horas por ano recuperáveis e priorizamos por retorno o que desenvolver primeiro. Você sai da conversa com um primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('*', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um padrão que vemos em empresas do porte [DA_EMPRESA] é o TI com mais pedidos da operação do que gente, e bons projetos parados na fila, que costuma crescer no fim de ano.

Sou [NOME], [CONSULTOR] do Núcleo de Tecnologia da Poli Júnior (Escola Politécnica da USP). Desenvolvemos sistemas documentados para o time interno manter. Na Ambev, reconstruímos o assistente de IA interno em squad com o Núcleo de Dados.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila?$msg$),
  ('*', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn.

Onde o sistema não chega, é comum a operação criar planilhas paralelas. Estudos apontam que a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('*', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. É comum essa conta nem aparecer no planejamento.

Entramos como braço extra do TI. Na Riachuelo, unificamos num só ambiente dados que estavam espalhados. Na Ambev, trabalhamos em squad, com entregas documentadas.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$)
) AS v (chave, persona, step, code, body)
-- '*' = vale para todos os 8 setores (Owner da Tecnologia).
JOIN alvo a ON a.chave = v.chave OR v.chave = '*';

-- Conferência: 8 setores x 14 mensagens, sem texto vazio.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM sector_templates t JOIN alvo a ON a.id = t.sector_id
  WHERE btrim(t.body) <> '';
  IF n <> 112 THEN
    RAISE EXCEPTION 'Esperava 112 mensagens, gravou %', n;
  END IF;
END $$;

-- Resumo do que ficou gravado (aparece como resultado no SQL Editor).
SELECT a.nome AS setor,
       coalesce(nullif(t.persona, ''), 'qualquer persona') AS persona,
       string_agg(t.step || ':' || t.code, '  ' ORDER BY t.step) AS etapas
FROM alvo a JOIN sector_templates t ON t.sector_id = a.id
GROUP BY a.pai IS NOT NULL, a.ordem, a.nome, t.persona
ORDER BY a.pai IS NOT NULL, a.ordem, t.persona;

COMMIT;
