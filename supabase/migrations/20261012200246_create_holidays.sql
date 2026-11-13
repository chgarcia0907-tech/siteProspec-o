CREATE TABLE IF NOT EXISTS public.holidays (
  date date PRIMARY KEY,
  name text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY holidays_read ON public.holidays FOR SELECT TO authenticated USING (true);

INSERT INTO public.holidays (date, name) VALUES
('2026-01-01','Confraternização Universal'),('2026-01-25','Aniversário de São Paulo'),
('2026-02-16','Carnaval'),('2026-02-17','Carnaval'),('2026-04-03','Sexta-feira Santa'),
('2026-04-21','Tiradentes'),('2026-05-01','Dia do Trabalho'),('2026-06-04','Corpus Christi'),
('2026-07-09','Revolução Constitucionalista'),('2026-09-07','Independência'),
('2026-10-12','Nossa Senhora Aparecida'),('2026-11-02','Finados'),
('2026-11-15','Proclamação da República'),('2026-11-20','Dia da Consciência Negra'),('2026-12-25','Natal'),
('2027-01-01','Confraternização Universal'),('2027-01-25','Aniversário de São Paulo'),
('2027-02-08','Carnaval'),('2027-02-09','Carnaval'),('2027-03-26','Sexta-feira Santa'),
('2027-04-21','Tiradentes'),('2027-05-01','Dia do Trabalho'),('2027-05-27','Corpus Christi'),
('2027-07-09','Revolução Constitucionalista'),('2027-09-07','Independência'),
('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),
('2027-11-15','Proclamação da República'),('2027-11-20','Dia da Consciência Negra'),('2027-12-25','Natal')
ON CONFLICT (date) DO NOTHING;