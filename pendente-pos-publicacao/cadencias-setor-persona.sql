-- Cadências por setor e persona do NTec (documento "Mensagens por Setor e Persona · NTec", 22/11/2026).
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

Em operações como a [DA_EMPRESA], conferência e auditoria de mercadoria ainda costumam passar por planilha de divergência, item a item.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida que digitalizam a conferência e a auditoria. Num grande outlet internacional de roupas, a auditoria levava 229 segundos por peça, e mapeamos até 70% de ganho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na operação [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('LOG', '', 2, 'LOG-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quanto tempo a conferência de uma carga leva hoje e quanto disso é planilha. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', '', 3, 'LOG-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

No outlet que atendemos, cada peça passava por auditoria, preenchimento de documentos e planilha de divergência. A plataforma que entregamos passou a gerar os documentos em PDF e Excel sozinha. Em 10 mil itens por mês, cada minuto a menos por item devolve mais de 160 horas ao time.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('LOG', '', 4, 'LOG-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na operação [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('LOG', '', 5, 'LOG-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de conferência, estoque e expedição [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('LOG', 'owner_processo', 1, 'LOG-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em operações como a [DA_EMPRESA], a mesma informação costuma ser digitada de novo da planilha de divergência para o relatório.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que geram relatórios e documentos automaticamente. Na auditoria de um grande outlet internacional de roupas, os documentos passaram a sair prontos em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a planilha mais gera retrabalho no seu dia a dia, antes do orçamento de 2027?$msg$),
  ('LOG', 'owner_processo', 2, 'LOG-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a conferência [DA_EMPRESA].

Quero entender quantas vezes a mesma informação é digitada entre o recebimento e o relatório de divergência. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', 'owner_processo', 3, 'LOG-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em mil itens conferidos, são de 10 a 50 divergências para alguém caçar depois. No outlet que atendemos, tiramos a digitação do caminho e os documentos da auditoria passaram a sair prontos, em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na conferência [DA_EMPRESA]?$msg$),
  ('LOG', 'patrocinador_executivo', 1, 'LOG-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo logístico já consome 12,3% do faturamento das empresas brasileiras (Fundação Dom Cabral). Em operações como a [DA_EMPRESA], cada pedido a mais exige mais gente conferindo.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida para processos críticos. Num grande outlet internacional de roupas, mapeamos até 70% de ganho na auditoria.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto os gargalos da operação [DA_EMPRESA] custam por ano, antes do orçamento de 2027?$msg$),
  ('LOG', 'patrocinador_executivo', 2, 'LOG-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quanto do custo da operação hoje é conferência, correção e retrabalho. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', 'patrocinador_executivo', 3, 'LOG-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('LOG', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('LOG', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('LOG', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('RE', '', 1, 'RE-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em obras como as [DA_EMPRESA], diário de obra e checklists ainda passam do papel para a planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida que digitalizam processos de obra. Para a Modera, criamos um app de gestão de obras que funciona offline no canteiro.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos os principais gargalos nas obras [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('RE', '', 2, 'RE-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as obras [DA_EMPRESA].

Quero entender quanto tempo a informação leva hoje para sair do canteiro e chegar a quem aprova. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', '', 3, 'RE-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 10 engenheiros e técnicos gastam 30 minutos por dia passando diário de obra e checklist do papel para a planilha, são cerca de 110 horas por mês longe da obra. Na Modera, esse registro passou a ser feito no celular, no próprio canteiro, mesmo sem internet.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('RE', '', 4, 'RE-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso nas obras [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('RE', '', 5, 'RE-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida das obras e do pós-obra [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('RE', 'owner_processo', 1, 'RE-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em obras como as [DA_EMPRESA], cada área costuma ter sua planilha, e alguém junta tudo no fim do dia.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que integram as áreas da obra num só lugar. Para a CTE, criamos uma gestão de obras em que cada perfil acessa só o que precisa.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde as planilhas paralelas mais geram retrabalho nas obras, antes do orçamento de 2027?$msg$),
  ('RE', 'owner_processo', 2, 'RE-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre os controles de obra [DA_EMPRESA].

Quero entender quantas planilhas diferentes o time usa hoje para acompanhar uma única obra. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', 'owner_processo', 3, 'RE-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Na CTE, vários perfis de usuário com regras próprias precisavam interagir na mesma obra. Hoje as regras de negócio estão no sistema e cada etapa fica num lugar só. A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy), e é aí que medição e checklist se perdem.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso nas obras [DA_EMPRESA]?$msg$),
  ('RE', 'patrocinador_executivo', 1, 'RE-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Ineficiência e atrasos podem custar R$ 59 bilhões às construtoras e alongar obras imobiliárias em até 13 meses (Deloitte para a Fiesp).

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que dão visibilidade de prazo e custo da obra, como fizemos para a CTE e a Modera.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto os atrasos de informação do campo custam à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('RE', 'patrocinador_executivo', 2, 'RE-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as obras [DA_EMPRESA].

Quero entender quanto tempo um desvio de obra leva hoje para chegar à diretoria. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', 'patrocinador_executivo', 3, 'RE-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para as obras [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('RE', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('RE', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('RE', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('IND', '', 1, 'IND-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], apontamentos, paradas e inspeções de qualidade ainda vão do papel para a planilha a cada turno.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps que digitalizam apontamento e inspeção. Num grande outlet internacional de roupas, a auditoria levava 229 segundos por peça, e mapeamos até 70% de ganho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos no chão de fábrica [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('IND', '', 2, 'IND-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender se vocês sabem, ainda no mesmo turno, quanto a linha parou e por quê. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', '', 3, 'IND-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

"Gastamos em média 229 segundos por peça para realizar uma auditoria, preencher documentos e criar a planilha de divergência." Foi assim que um cliente nos descreveu o processo dele. Com a plataforma que entregamos, os documentos passaram a sair prontos em PDF e Excel, e o ganho mapeado chegou a 70%.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para medirmos esse tempo nas inspeções [DA_EMPRESA]?$msg$),
  ('IND', '', 4, 'IND-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso no chão de fábrica [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('IND', '', 5, 'IND-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de produção, qualidade ou manutenção [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('IND', 'owner_processo', 1, 'IND-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], o mesmo apontamento costuma ser escrito no papel e digitado de novo na planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps de apontamento e sistemas que geram os relatórios sozinhos. Na auditoria de um grande outlet internacional de roupas, os documentos passaram a sair prontos em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o apontamento manual mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('IND', 'owner_processo', 2, 'IND-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre os apontamentos [DA_EMPRESA].

Quero entender quanto tempo o time gasta por turno passando apontamentos do papel para a planilha. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', 'owner_processo', 3, 'IND-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 20 operadores e inspetores gastam 15 minutos por turno com apontamentos, são cerca de 110 horas por mês. E a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy), justamente nos dados de perda e parada. No outlet que atendemos, tiramos a digitação do caminho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('IND', 'patrocinador_executivo', 1, 'IND-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

As 500 maiores empresas do mundo perdem cerca de 11% da receita com paradas não planejadas (Siemens, 2024). Com a produção em queda, cada perda não medida pesa mais [NA_EMPRESA].

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida para processos críticos da produção. Num grande outlet internacional de roupas, mapeamos até 70% de ganho na auditoria.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto as perdas não medidas custam por ano, antes do orçamento de 2027?$msg$),
  ('IND', 'patrocinador_executivo', 2, 'IND-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender se as perdas e paradas de cada turno chegam até você em números confiáveis. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', 'patrocinador_executivo', 3, 'IND-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('IND', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('IND', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('IND', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('ALI', '', 1, 'ALI-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], controle de lote e checklists de qualidade ainda vão do papel para a planilha a cada turno.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que digitalizam lote e qualidade. Num grande outlet internacional de roupas, a auditoria levava 229 segundos por peça, e mapeamos até 70% de ganho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na produção [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('ALI', '', 2, 'ALI-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender quanto tempo vocês levam hoje para rastrear um lote, da matéria-prima à expedição. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', '', 3, 'ALI-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Quando um cliente pede a rastreabilidade de um lote, quanto tempo o time leva para juntar as planilhas? Essa é uma dor recorrente na indústria de alimentos. No outlet que atendemos, a auditoria por peça passou a gerar os documentos em PDF e Excel sozinha, com até 70% de ganho mapeado.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para medirmos esse tempo na produção [DA_EMPRESA]?$msg$),
  ('ALI', '', 4, 'ALI-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('ALI', '', 5, 'ALI-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de qualidade e PCP [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('ALI', 'owner_processo', 1, 'ALI-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], o mesmo registro de qualidade costuma ser preenchido no papel e digitado de novo na planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps de registro de qualidade e sistemas que geram os documentos sozinhos, como fizemos na auditoria de um grande outlet internacional de roupas.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o registro manual de qualidade mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('ALI', 'owner_processo', 2, 'ALI-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre os registros de qualidade [DA_EMPRESA].

Quero entender quantas planilhas o time de qualidade preenche por turno e quantas vezes o mesmo dado é digitado. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', 'owner_processo', 3, 'ALI-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em registro de lote e de qualidade, cada erro aparece na auditoria. No outlet que atendemos, tiramos a digitação do caminho e os documentos da inspeção passaram a sair prontos.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece na qualidade [DA_EMPRESA]?$msg$),
  ('ALI', 'patrocinador_executivo', 1, 'ALI-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Um recall custa em média US$ 10 milhões em custos diretos a uma empresa de alimentos (FMI e GMA), e a conta cresce quando a rastreabilidade depende de planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas de rastreabilidade sob medida. Já atendemos a Ambev e um grande outlet de roupas.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a falta de rastreabilidade custa à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('ALI', 'patrocinador_executivo', 2, 'ALI-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quanto tempo a empresa levaria hoje para responder a um recolhimento de lote. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', 'patrocinador_executivo', 3, 'ALI-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('ALI', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('ALI', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ALI', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('AUT', '', 1, 'AUT-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], inspeção por peça, apontamento de produção e controle de refugo ainda costumam passar por papel e planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps que digitalizam inspeção e apontamento. Num grande outlet internacional de roupas, a auditoria levava 229 segundos por peça, e mapeamos até 70% de ganho.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos no chão de fábrica [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('AUT', '', 2, 'AUT-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender quanto tempo a inspeção de cada peça leva hoje e quanto disso é preenchimento de planilha. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', '', 3, 'AUT-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

"Gastamos em média 229 segundos por peça para realizar uma auditoria, preencher documentos e criar a planilha de divergência." Foi assim que um cliente nos descreveu o processo dele. Com a plataforma que entregamos, os documentos passaram a sair prontos em PDF e Excel, e o ganho mapeado chegou a 70%.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para medirmos esse tempo na inspeção [DA_EMPRESA]?$msg$),
  ('AUT', '', 4, 'AUT-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na inspeção [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('AUT', '', 5, 'AUT-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de qualidade e produção [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('AUT', 'owner_processo', 1, 'AUT-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], o relatório de inspeção e o de não conformidade costumam ser montados à mão, peça a peça, para cada cliente.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que geram relatórios de inspeção sozinhos. Na auditoria de um grande outlet internacional de roupas, os relatórios passaram a sair prontos em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o relatório manual mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('AUT', 'owner_processo', 2, 'AUT-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre os relatórios de inspeção [DA_EMPRESA].

Quero entender quanto tempo o time gasta por semana montando relatórios de inspeção e de não conformidade. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', 'owner_processo', 3, 'AUT-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 20 operadores e inspetores gastam 15 minutos por turno com apontamentos e relatórios, são cerca de 110 horas por mês. E a digitação manual erra de 1% a 5% dos registros (Journal of Accountancy), justamente no dado que o cliente audita.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('AUT', 'patrocinador_executivo', 1, 'AUT-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Uma hora de linha parada pode custar até US$ 2,3 milhões numa grande fábrica automotiva (Siemens, 2024). Para fornecedores, cada refugo não medido vira atraso na entrega.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que digitalizam a inspeção e medem o refugo. Num grande outlet de roupas, mapeamos até 70% de ganho na inspeção por peça.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto o refugo custa à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('AUT', 'patrocinador_executivo', 2, 'AUT-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender se refugo e retrabalho de cada turno chegam até você em números confiáveis. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', 'patrocinador_executivo', 3, 'AUT-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('AUT', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('AUT', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('AUT', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('FAR', '', 1, 'FAR-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], registros de lote e documentação de auditoria ainda rodam em planilha.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que digitalizam o registro de lote e geram a documentação de auditoria. No CalcSoro, automatizamos cálculos que dependiam de planilha.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na produção [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('FAR', '', 2, 'FAR-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a produção [DA_EMPRESA].

Quero entender quanto tempo a documentação de um lote leva hoje até ficar pronta para auditoria. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', '', 3, 'FAR-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Rastreabilidade por lote não é opcional no setor, mas ainda costuma depender de planilha. A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy), e cada erro vira retrabalho na auditoria. No outlet que atendemos, os documentos da auditoria passaram a sair prontos em PDF e Excel.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso na produção [DA_EMPRESA]?$msg$),
  ('FAR', '', 4, 'FAR-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso nos registros de lote [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('FAR', '', 5, 'FAR-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de qualidade e registros de lote [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('FAR', 'owner_processo', 1, 'FAR-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em fábricas como a [DA_EMPRESA], o mesmo dado de lote costuma ser registrado no papel, digitado na planilha e conferido de novo para a auditoria.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas em que o dado entra uma vez e o documento sai pronto, como no CalcSoro, que eliminou o cálculo repetido em planilha.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a digitação repetida mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('FAR', 'owner_processo', 2, 'FAR-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre os registros de lote [DA_EMPRESA].

Quero entender quantas vezes o mesmo dado de lote é digitado até a documentação ficar pronta. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', 'owner_processo', 3, 'FAR-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

No CalcSoro, eliminamos o preenchimento manual em planilha e padronizamos os cálculos pelas regras do cliente. Em registro de lote, a lógica é a mesma, com o dado digitado uma vez e o documento gerado sozinho. A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy).

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso nos registros [DA_EMPRESA]?$msg$),
  ('FAR', 'patrocinador_executivo', 1, 'FAR-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

O custo da má qualidade pode chegar a 15% a 20% das vendas na indústria (Autodesk). Em empresas como a [A_EMPRESA], ele aparece em lote reprovado, auditoria e recolhimento.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida de rastreabilidade e documentação, como no CalcSoro, que automatizou rotinas que dependiam de planilha.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a documentação manual custa por ano, antes do orçamento de 2027?$msg$),
  ('FAR', 'patrocinador_executivo', 2, 'FAR-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quanto tempo a empresa levaria hoje para rastrear um lote numa auditoria surpresa. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', 'patrocinador_executivo', 3, 'FAR-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('FAR', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('FAR', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('FAR', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('ENE', '', 1, 'ENE-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em operações como a [DA_EMPRESA], ordens de serviço e inspeções ainda voltam em papel ou foto no WhatsApp.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps de campo e sistemas que centralizam ordens de serviço. Já entregamos registro offline no celular para a Modera e ocorrências em mapa para o Nautilus.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na manutenção [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('ENE', '', 2, 'ENE-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a manutenção [DA_EMPRESA].

Quero entender quanto tempo passa hoje entre um alarme numa usina e a equipe de campo agir. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', '', 3, 'ENE-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 18 ocorrências relevantes por mês geram perda média de R$ 6 mil cada, e metade poderia ser evitada com acompanhamento em tempo real, são R$ 648 mil por ano (exemplo da nossa Matriz de Valor). O primeiro passo é ter cada ocorrência registrada em campo e vista num mapa, como fizemos no Nautilus.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('ENE', '', 4, 'ENE-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso no campo [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('ENE', '', 5, 'ENE-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de O&M e campo [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('ENE', 'owner_processo', 1, 'ENE-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em operações como a [DA_EMPRESA], o técnico costuma preencher a ordem de serviço no papel e alguém digita tudo de novo no escritório, foto por foto.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos apps em que o técnico preenche a ordem de serviço no celular, mesmo sem sinal, como fizemos para a Modera, em obras.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde o controle de campo mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('ENE', 'owner_processo', 2, 'ENE-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as ordens de serviço [DA_EMPRESA].

Quero entender como uma inspeção de campo chega hoje ao sistema e quem digita. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', 'owner_processo', 3, 'ENE-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 10 técnicos gastam 30 minutos por dia repassando ordens de serviço e fotos, são cerca de 110 horas por mês fora do campo. No Nautilus, cada ocorrência passou a ser registrada uma vez só, com local no mapa, e toda a informação ficou num único ambiente.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('ENE', 'patrocinador_executivo', 1, 'ENE-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Para 76% dos líderes industriais, uma hora de parada não planejada custa até US$ 500 mil, e 44% enfrentam falhas ao menos uma vez por mês (ABB, 2025).

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas que centralizam manutenção e campo, como fizemos para a Modera e o Nautilus.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto a resposta tardia em campo custa à [A_EMPRESA] por ano, antes do orçamento de 2027?$msg$),
  ('ENE', 'patrocinador_executivo', 2, 'ENE-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quanto a operação perde hoje entre um alarme e a ação da equipe. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', 'patrocinador_executivo', 3, 'ENE-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('ENE', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('ENE', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('ENE', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$),
  ('SAU', '', 1, 'SAU-OP-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em instituições como a [A_EMPRESA], conferências e controles do dia a dia ainda rodam em planilha, refeitos a cada atendimento.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida que digitalizam conferências e cálculos. No CalcSoro, o cálculo de soro que a médica refazia em planilha passou a sair automaticamente, pelas regras dela.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde estão os principais gargalos na operação [DA_EMPRESA], antes do orçamento de 2027?$msg$),
  ('SAU', '', 2, 'SAU-OP-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a operação [DA_EMPRESA].

Quero entender quais conferências e controles ainda são refeitos à mão a cada atendimento ou conta. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', '', 3, 'SAU-OP-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 5 pessoas gastam 2 horas por dia conferindo contas e respondendo glosas à mão, são cerca de 220 horas por mês. E cada glosa segura o caixa por meses. No CalcSoro, tiramos a planilha do caminho e padronizamos os cálculos pelas regras da própria médica.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com os números [DA_EMPRESA]?$msg$),
  ('SAU', '', 4, 'SAU-WT02', $msg$[SAUDACAO], [FIRST NAME]! Vou direto: não é para substituir o time de vocês, e sim para tirar do papel o que fica parado por falta de braço. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos isso no faturamento [DA_EMPRESA]? Se não for o momento, é só me avisar.$msg$),
  ('SAU', '', 5, 'SAU-IN03', $msg$Olá, [FIRST NAME]! Tudo bem?

Vou parar de te escrever por aqui. Antes, um último convite, pensando no planejamento de 2027: vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima, com você ou com quem cuida de faturamento e auditoria de contas [NA_EMPRESA]?

Se for outra pessoa, me passa o contato que eu sigo com ela.$msg$),
  ('SAU', 'owner_processo', 1, 'SAU-PR-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em instituições como a [A_EMPRESA], o mesmo dado do paciente ou da conta costuma ser digitado em mais de uma planilha, item a item.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas em que o dado entra uma vez e o resultado sai pronto. No CalcSoro, os dados do paciente deixaram de ser reinseridos a cada atendimento.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde a digitação repetida mais gera retrabalho, antes do orçamento de 2027?$msg$),
  ('SAU', 'owner_processo', 2, 'SAU-PR-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre a conferência de contas [DA_EMPRESA].

Quero entender quantas etapas da conferência de uma conta ainda são feitas à mão. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', 'owner_processo', 3, 'SAU-PR-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

A digitação manual erra de 1% a 5% dos registros (Journal of Accountancy). Em contas médicas, cada erro pode virar glosa. No CalcSoro, eliminamos o preenchimento manual em planilha e padronizamos os cálculos com base nas regras da médica.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos onde isso acontece [NA_EMPRESA]?$msg$),
  ('SAU', 'patrocinador_executivo', 1, 'SAU-EX-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em 2024, os planos de saúde glosaram ou retiveram R$ 5,8 bilhões em pagamentos a hospitais (Anahp). Em instituições como a [A_EMPRESA], cada conta com erro vira risco de glosa.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida que digitalizam rotinas críticas. Já automatizamos cálculos clínicos no CalcSoro.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para estimarmos quanto as glosas e o retrabalho custam por ano, antes do orçamento de 2027?$msg$),
  ('SAU', 'patrocinador_executivo', 2, 'SAU-EX-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre o faturamento [DA_EMPRESA].

Quero entender quanto do faturamento fica parado hoje por glosa ou conta devolvida. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', 'patrocinador_executivo', 3, 'SAU-EX-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Antes de falar de solução, mapeamos onde está o retorno. No Paraná Banco, mapeamos mais de 10 processos críticos, priorizamos por retorno e estimamos mais de 2.000 horas por ano recuperáveis com automação. Você sai da conversa com o primeiro esboço desse mapa para a operação [DA_EMPRESA].

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para começarmos?$msg$),
  ('SAU', 'owner_tecnologia', 1, 'TEC-TI-IN01', $msg$Olá, [FIRST NAME]! Tudo bem?

Em empresas como a [A_EMPRESA], o TI costuma ter mais pedidos da operação do que gente, e bons projetos ficam parados na fila.

Sou [NOME], [CONSULTOR] da Poli Júnior (Escola Politécnica da USP). No Núcleo de Tecnologia, desenvolvemos sistemas sob medida, documentados e fáceis de manter, junto com o time interno. Na Ambev, reconstruímos o assistente de IA interno.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para mapearmos quais demandas da operação estão paradas na fila, antes do orçamento de 2027?$msg$),
  ('SAU', 'owner_tecnologia', 2, 'TEC-TI-WT01', $msg$[SAUDACAO], [FIRST NAME]! Aqui é [NOME], da Poli Júnior (Escola Politécnica da USP). Te escrevi no LinkedIn sobre as demandas da operação [DA_EMPRESA].

Quero entender quais projetos da operação estão parados hoje por falta de braço no time. Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima?$msg$),
  ('SAU', 'owner_tecnologia', 3, 'TEC-TI-IN02', $msg$Olá, [FIRST NAME]! Tudo bem?

Se 3 projetos da operação esperam 6 meses na fila, cada um economizando 100 horas por mês, são 1.800 horas perdidas na espera. Entramos como braço extra, com entregas documentadas e fáceis de manter, como fizemos na Ambev e na Riachuelo.

Vamos marcar uma conversa de 30 a 45 minutos nesta semana ou na próxima para fazermos essa conta com a fila [DA_EMPRESA]?$msg$)
) AS v (chave, persona, step, code, body)
JOIN alvo a ON a.chave = v.chave;

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
