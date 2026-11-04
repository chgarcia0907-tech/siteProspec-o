<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Arquitetura (Cadência Outbound)

- Regras de cadência, parser do LinkedIn e utilitários de data ficam em `src/lib/cadencia.ts` — uma única fonte de verdade reutilizada por todas as telas.
- Acesso a dados via cliente Supabase do navegador em hooks React Query (`src/hooks/useCadencia.ts`), protegido por RLS por hunter; não usar server functions para CRUD simples.
- Datas previstas são calculadas (nunca gravadas) por `plannedDates` em `cadencia.ts`, em dias úteis (sem fins de semana nem feriados da tabela `holidays`, carregada uma vez por tela/export e passada como Set) e encadeadas a partir do envio real (ou previsão) da etapa anterior; todas as telas, CSVs e o export usam essa função única.
- Ranking usa a função SQL `public.ranking(date)` (SECURITY DEFINER) porque agrega dados de outros hunters, que o RLS esconde.
- Exclusão de contatos e período da competição só via server functions em `src/lib/admin.functions.ts`, após validar ADMIN_PASSWORD (bloqueio em `admin_attempts`); hunters não têm DELETE em `contacts`.
- Pontuação da competição: cálculo puro em `src/lib/competition.ts`, carregado com service role em `competition.server.ts`; o cliente recebe só totais.
- Planilha: o Google Sheets puxa CSV via IMPORTDATA de `/api/public/planilha/*.csv` (token = secret SHEET_EXPORT_TOKEN); lógica em `src/lib/planilha.server.ts`, reaproveitando `cadencia.ts` e `competition.server.ts`.
- Painel admin (/painel): papel em public.user_roles + has_role(); toda leitura/exclusão global via server functions em src/lib/painel.functions.ts que validam has_role antes de usar service role.
- Períodos: tabelas periods/groups/subgroups/period_members/period_snapshots; contacts.period_id é carimbado por trigger (período ativo, senão o último) e novos perfis entram no período ativo por trigger — assim as telas dos hunters não precisam mudar. Snapshots são o placar oficial congelado; escrita só via service role.
- Ações de períodos/grupos/membros, transferência de contatos e exclusão de hunter ficam em src/lib/periodos.functions.ts (has_role antes do service role); excluir hunter exige zero contatos porque contacts.user_id apaga em cascata com a conta.
- Ranking por período: período encerrado lê o placar oficial de period_snapshots (loadSnapshot); "maturação atual" recalcula ao vivo só com contatos do período; sem período mantém o cálculo original para não quebrar a planilha.
- Feriados: leitura pública para logados; escrita só por `adminAddHoliday`/`adminRemoveHoliday` (senha de administrador), para manter o mesmo controle das outras ações sensíveis.
- Funil: cada etapa tem coluna `*_registrado_em` (momento do clique); a pontuação usa `stageScoreDate` em `competition.ts`, e a data agendada (`*_em`) fica só para consolidado — assim agendamentos futuros não represam pontos.
- Model text changes are staged in pendente-pos-publicacao/modelos.sql and run only after publishing, because the published app may not understand new template tags yet.
