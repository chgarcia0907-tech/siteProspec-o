-- PENDENTE: rodar SOMENTE logo depois de publicar a versão que entende as tags
-- [NA_EMPRESA], [A_EMPRESA], [DA_EMPRESA] e [JANELA]. Não executar antes.
-- Toda mudança de texto dos modelos entra aqui, não direto no banco.
-- Grava o texto final completo de cada modelo.

update message_templates set body = $modelo$Olá, [FIRST NAME]! Tudo bem?

Vi que você atua como [CARGO] [NA_EMPRESA] e imaginei que parte dos desafios do time esteja relacionada a [DOR_DO_SETOR].

Sou [NOME], [CONSULTOR] da Poli Júnior (empresa júnior da Escola Politécnica da USP). No Núcleo de Tecnologia desenvolvemos sistemas, plataformas e aplicações sob medida que ajudam empresas a estruturar melhor processos e operações digitais.

Achei que poderia fazer sentido trocarmos uma ideia rápida para entender se existe alguma frente tecnológica relevante hoje [NA_EMPRESA].$modelo$, updated_at = now() where code = 'IN01';

update message_templates set body = $modelo$Olá, [FIRST NAME]! Tudo bem?

Sou [NOME], [CONSULTOR] de negócios da Poli Júnior, empresa júnior da Escola Politécnica da USP.

Entramos em contato com você recentemente pelo LinkedIn, pois atuamos no desenvolvimento de software voltado à inovação tecnológica e à organização de processos. Nesse sentido, identificamos sinergias com [A_EMPRESA] e acreditamos que podemos contribuir com soluções alinhadas aos seus objetivos atuais.

Podemos agendar uma conversa rápida [JANELA]?$modelo$, updated_at = now() where code = 'WT01';

update message_templates set body = $modelo$Olá, [FIRST NAME]! Tudo bem?

Passei aqui novamente para saber se você conseguiu ver minha mensagem anterior. Acredito que exista uma boa oportunidade de sinergia e que essa aproximação entre [A_EMPRESA] e o ambiente universitário pode ser bem positiva.

Você teria 30 minutos [JANELA] para conversarmos?$modelo$, updated_at = now() where code = 'IN02';

update message_templates set body = $modelo$[SAUDACAO], [FIRST NAME]! Tudo bem?

Passando para retomar nosso contato e ver se conseguimos marcar um horário para falar sobre tecnologia e como ela pode ajudar na produtividade [DA_EMPRESA]. Que tal marcarmos uma conversa [JANELA]?$modelo$, updated_at = now() where code = 'WT02';

update message_templates set body = $modelo$Olá, [FIRST NAME]! Tudo bem?

Como não consegui retorno, vou encerrar o contato por aqui. Reforço apenas que essa conversa poderia destravar oportunidades relevantes de colaboração tecnológica entre [A_EMPRESA] e a Poli Júnior.

Caso queira avaliar isso antes de fecharmos essa janela, fico à disposição.$modelo$, updated_at = now() where code = 'IN03';
