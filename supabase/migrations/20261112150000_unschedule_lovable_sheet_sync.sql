-- O agendamento 'sync-sheets-15min' (migração 20260929211718) chamava a cada 15 min
-- /api/public/sync-sheets no domínio do Lovable. Esse endpoint não existe no app e o
-- projeto saiu do Lovable; a planilha hoje puxa os dados via IMPORTDATA
-- (/api/public/planilha/*.csv). Remove o agendamento, se ainda existir.
-- SQL dinâmico: o banco pode não ter a extensão pg_cron (e então não há o que remover).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$
      select cron.unschedule(jobname) from cron.job where jobname = 'sync-sheets-15min'
    $q$;
  end if;
end $$;
