CREATE TABLE public.message_templates (
  step integer PRIMARY KEY CHECK (step BETWEEN 1 AND 5),
  code text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_templates_read ON public.message_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.message_templates (step, code, body) VALUES
(1, 'IN01', $t$Olá, [FIRST NAME]! Tudo bem?

Sou [NOME], da Poli Júnior, empresa júnior da Escola Politécnica da USP.

Tenho conversado com empresas que estão crescendo e acabam enfrentando desafios para aumentar a capacidade da operação, ter mais controle dos processos, tomar decisões com informações mais confiáveis e reduzir falhas e retrabalho.

É justamente nesse tipo de desafio que ajudamos empresas a transformar processos críticos em operações mais digitais, integradas e eficientes.

Fiquei curioso para entender como vocês lidam hoje com esse tipo de desafio na [EMPRESA] hoje. O que acha da gente bater um papo nessa semana?$t$),
(2, 'WT01', $t$Olá, [FIRST NAME]! Tudo bem?

Sou [NOME + SOBRENOME], da Poli Júnior, empresa júnior da Escola Politécnica da USP.

Entrei em contato contigo pelo LinkedIn e encontrei seu WhatsApp por lá também. Não sei se conseguiu ver minha mensagem, então resolvi te chamar por aqui.

Conversei com algumas empresas nos últimos meses que estão crescendo e enfrentam desafios para aumentar a capacidade da operação, ter mais controle dos processos e reduzir falhas e retrabalho.

Nosso trabalho é ajudar empresas a digitalizar e integrar processos críticos para ganhar eficiência, controle e escala.

Queria entender se esse também é um tema na [EMPRESA]. O que acha de batermos um papo essa semana?$t$),
(3, 'IN02', $t$Oi, [FIRST NAME]!

Imagino que as coisas devam estar bem corridas por aí, mas estou passando aqui novamente para saber se você conseguiu ver minha mensagem anterior.

Acredito que exista uma boa oportunidade de sinergia e que essa aproximação entre a [EMPRESA] e o ambiente universitário pode ser bem positiva.

Topa conversar 30 minutos nessa ou na próxima semana?$t$),
(4, 'WT02', $t$Oi, [FIRST NAME]!

A ideia era entender se existe algum processo crítico na [EMPRESA] que esteja gerando muito trabalho manual, retrabalho, falta de controle ou dificuldade para acompanhar o crescimento da operação.

Se esse tema estiver no radar de vocês em algum momento, fico à disposição para bater um papo.$t$),
(5, 'IN03', $t$Olá, [FIRST NAME]!

Vou encerrar meu contato por aqui para não ser chato e manter a porta aberta para o futuro.

Minha intenção era entender se existe algum processo crítico na [EMPRESA] que esteja gerando esforço manual, retrabalho, falta de visibilidade ou dificuldade para escalar a operação.

Se esse tema entrar no radar de vocês em algum momento, fico à disposição para retomarmos a conversa.

Grande abraço!$t$);