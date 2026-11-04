ALTER TABLE public.contacts
  ADD COLUMN sector text NOT NULL DEFAULT '',
  ADD COLUMN job_title text NOT NULL DEFAULT '',
  ADD COLUMN rapport text NOT NULL DEFAULT '',
  ADD COLUMN at_marcada_em date,
  ADD COLUMN lead_em date,
  ADD COLUMN proposta_em date,
  ADD COLUMN aprovacao_em date,
  ADD COLUMN vendido_em date,
  ADD COLUMN at_registrado_em timestamptz;

ALTER TABLE public.profiles ADD COLUMN gender text NOT NULL DEFAULT 'm';

DROP POLICY IF EXISTS contacts_own ON public.contacts;
REVOKE DELETE ON public.contacts FROM authenticated, anon;
CREATE POLICY contacts_select_own ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY contacts_insert_own ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY contacts_update_own ON public.contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.competition_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_date date NOT NULL DEFAULT '2026-10-01',
  end_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competition_settings TO authenticated;
GRANT ALL ON public.competition_settings TO service_role;
ALTER TABLE public.competition_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY competition_read ON public.competition_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.competition_settings (id) VALUES (1);

CREATE TABLE public.admin_attempts (
  user_id uuid PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_attempts TO service_role;
ALTER TABLE public.admin_attempts ENABLE ROW LEVEL SECURITY;

UPDATE public.message_templates SET code = 'IN01', updated_at = now(), body = $t$Olá, [FIRST NAME]! Tudo bem?

[RAPPORT]

Vi que você atua como [CARGO] na [EMPRESA] e imaginei que parte dos desafios do time esteja relacionada a [DOR_DO_SETOR].

Sou [NOME], [CONSULTOR] da Poli Júnior (empresa júnior da Escola Politécnica da USP). No Núcleo de Tecnologia desenvolvemos sistemas, plataformas e aplicações sob medida que ajudam empresas a estruturar melhor processos e operações digitais.

Achei que poderia fazer sentido trocarmos uma ideia rápida para entender se existe alguma frente tecnológica relevante hoje na [EMPRESA].$t$ WHERE step = 1;

UPDATE public.message_templates SET code = 'WT01', updated_at = now(), body = $t$Olá, [FIRST NAME]! Tudo bem?

Sou [NOME], [CONSULTOR] de negócios da Poli Júnior, empresa júnior da Escola Politécnica da USP.

Entrei em contato com você recentemente pelo LinkedIn, pois atuamos no desenvolvimento de software voltado à inovação tecnológica e à organização de processos. Nesse sentido, identificamos sinergias com a [EMPRESA] e acreditamos que podemos contribuir com soluções alinhadas aos seus objetivos atuais.

Podemos agendar uma conversa rápida na [DIA_SUGERIDO]?$t$ WHERE step = 2;

UPDATE public.message_templates SET code = 'IN02', updated_at = now(), body = $t$Olá, [FIRST NAME]! Tudo bem?

Passei aqui novamente para saber se você conseguiu ver minha mensagem anterior. Acredito que exista uma boa oportunidade de sinergia e que essa aproximação entre a [EMPRESA] e o ambiente universitário pode ser bem positiva.

Você teria 30 minutos nesta ou na próxima semana para conversarmos?$t$ WHERE step = 3;

UPDATE public.message_templates SET code = 'WT02', updated_at = now(), body = $t$[SAUDACAO], [FIRST NAME]! Tudo bem?

Passando para retomar nosso contato e ver se conseguimos marcar um horário para falar sobre tecnologia e como ela pode ajudar na produtividade da [EMPRESA]. Que tal marcarmos na [DIA_SUGERIDO]?$t$ WHERE step = 4;

UPDATE public.message_templates SET code = 'IN03', updated_at = now(), body = $t$Olá, [FIRST NAME]! Tudo bem?

Como não consegui retorno, vou encerrar o contato por aqui. Reforço apenas que essa conversa poderia destravar oportunidades relevantes de colaboração tecnológica entre a [EMPRESA] e a Poli Júnior.

Caso queira avaliar isso antes de fecharmos essa janela, fico à disposição.$t$ WHERE step = 5;