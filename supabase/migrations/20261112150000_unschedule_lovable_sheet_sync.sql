-- O agendamento 'sync-sheets-15min' (migração 20260929211718) chamava a cada 15 min
-- /api/public/sync-sheets no domínio do Lovable. Esse endpoint não existe no app e o
-- projeto saiu do Lovable; a planilha hoje puxa os dados via IMPORTDATA
-- (/api/public/planilha/*.csv). Remove o agendamento, se ainda existir.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-sheets-15min') then
    perform cron.unschedule('sync-sheets-15min');
  end if;
end $$;
