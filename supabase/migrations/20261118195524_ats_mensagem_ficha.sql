-- "Mensagem que converteu" como veio na ficha do WhatsApp (o que vem depois do canal em "Canal de
-- Contato", ex.: "respondeu ao FUP 2"). Texto livre, gravado pela skill criar-card e pelo
-- formulário; a etapa e o modelo da cadência continuam em resposta_etapa/resposta_modelo quando a
-- AT está ligada a um contato.
ALTER TABLE public.ats ADD COLUMN IF NOT EXISTS mensagem_ficha text;

GRANT INSERT (mensagem_ficha), UPDATE (mensagem_ficha) ON public.ats TO authenticated;
