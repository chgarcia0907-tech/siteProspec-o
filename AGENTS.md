# Cadência Outbound — guia para agentes

Objetivo do produto: hunters conseguem reuniões com as empresas que prospectam.
Métrica-guia: reuniões (ATs) marcadas a cada semana.

## Fluxo de trabalho

- Desenvolvimento só pelo Claude Code; o projeto não usa mais o Lovable.
- Deploy: produção é o branch `main` (a Vercel publica cada push nele) e o banco de produção é
  o Supabase `ctxsmboaqbjgslctojeq`. O desenvolvimento acontece no `dev` e chega ao `main` por
  pull request. Rode as verificações antes de cada push:
  `bun run typecheck && bun run lint && bun run test && bun run build`.
- Gerenciador de pacotes: bun (`bun.lock` versionado). Instale com `bun install`.
- Não reescreva histórico já enviado (force push, rebase ou amend de commits publicados).
- Commits e títulos de pull request seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):
  `<tipo>(<escopo opcional>): <descrição>`, com a descrição em português, no imperativo e
  em minúsculas, sem ponto final. Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`,
  `style`, `build`, `ci`, `chore`, `revert`. Mudança incompatível leva `!` após o tipo
  (ex.: `feat(db)!: ...`) e um rodapé `BREAKING CHANGE: ...`.
  Escopos comuns: `cadencia`, `funil`, `ranking`, `painel`, `periodos`, `planilha`,
  `auth`, `db`, `ui`, `deps`.

## Banco de dados (Supabase, projeto próprio)

- Migrações ficam só em `supabase/migrations/` (formato do Supabase CLI). Crie com
  `bun run db:new <nome>` e aplique com `bun run db:push` (exige `supabase link`).
- Nunca edite uma migração já aplicada; crie outra.
- Depois de mudar o esquema, rode `bun run db:types` para regenerar
  `src/integrations/supabase/types.ts`. Não edite esse arquivo à mão: o tipo `Contact`
  e as server functions derivam dele.
- SQL que depende de uma versão do app já publicada (ex.: texto de modelos com tags novas)
  vai para `pendente-pos-publicacao/` e só roda depois do deploy.
- Segredos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `SHEET_EXPORT_TOKEN`)
  ficam nas variáveis de ambiente da Vercel, nunca no repositório.

## Organização do código

- Rotas em `src/routes/` são finas: estado da tela e composição. Componentes de uma tela ficam
  em `src/components/<tela>/` (`contatos`, `hoje`, `ranking`, `painel`); componentes usados em
  mais de uma tela ficam na raiz de `src/components/` (ex.: `SectorSelect`, `InlineInput`,
  `Funnel`); `src/components/ui/` é o shadcn/ui.
- Regras puras de cada tela ficam em `src/lib/<tela>.ts` (`contatos.ts`, `fila.ts`,
  `ranking.ts`), com testes ao lado (`*.test.ts`). Lógica que dá para testar não fica em
  componente.
- Hooks compartilhados: `useCadencia` (dados do hunter), `usePainel` (dados do admin),
  `useSelection` (seleção por checkbox). No painel, ações destrutivas passam por
  `useConfirm` (`ask({ title, desc, word?, run })`).
- Etapas da cadência vêm de `STEPS` e etapas do funil de `FUNNEL` (ambos em `cadencia.ts`):
  colunas, rótulos, pontos e CSVs derivam dessas listas; não repita os campos à mão.
- Selects simples usam `NativeSelect`; erros em toast usam `errorMessage` (`src/lib/utils.ts`).
- Listas longas não renderizam tudo: a tabela de contatos pagina (`paginate` + `TablePagination`,
  50 por página) e as filas de envio mostram 50 cartões por vez. Consultas grandes usam
  `fetchAll` (páginas de 1.000, as seguintes em paralelo).
- O placar só busca contatos que podem pontuar (`isRelevantContact` em `competition.ts`, com o
  mesmo critério em `competitionFilter` para o banco). Ao mudar a pontuação, revise os dois
  juntos; o teste de equivalência em `competition.test.ts` compara com o cálculo sobre todos.

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
- Funil: `FUNNEL` em `cadencia.ts` é a fonte única das etapas (coluna da data, coluna de registro, contador do placar, rótulos e pontos). Cada etapa tem coluna `*_registrado_em` (momento do clique); a pontuação usa `stageScoreDate` em `competition.ts`, e a data agendada (`*_em`) fica só para consolidado — assim agendamentos futuros não represam pontos.
- Tipos de período (periods.kind): 'competicao' (Hacka: contatos do próprio período) e 'ciclo' (equipe: só membros, todos os contatos deles contados pela data de cada etapa, com ranking por semana via computeWeekly). closePeriod aceita `end` para congelar o placar numa data passada. A planilha lê o ciclo em ranking.csv?visao=ciclo e ?visao=semanas.
