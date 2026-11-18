# Cadência Outbound — guia para agentes

Objetivo do produto: hunters conseguem reuniões com as empresas que prospectam.
Métrica-guia: reuniões (ATs) marcadas a cada semana.

## Fluxo de trabalho

- Desenvolvimento só pelo Claude Code; o projeto não usa mais o Lovable.
- Deploy: produção é o branch `main` (a Vercel publica cada push nele) e o banco de produção é
  o Supabase `ctxsmboaqbjgslctojeq`. O desenvolvimento acontece no `dev` e chega ao `main` por
  pull request. Rode as verificações antes de cada push:
  `bun run typecheck && bun run lint && bun run test && bun run build && bun run e2e`.
- Gerenciador de pacotes: bun (`bun.lock` versionado). Instale com `bun install`.
- Testes de ponta a ponta: `bun run e2e` roda o Playwright contra o build de produção e um
  Supabase simulado (`e2e/mock-supabase.mjs`, dados em `e2e/fixtures.mjs`, relógio fixo em
  12/11/2026). Mudou uma tela ou um fluxo? Ajuste ou acrescente o teste em `e2e/*.spec.ts`
  no mesmo commit. Nunca pule ou apague teste para ficar verde.
- Skills do projeto (`.claude/skills/`): `/verificar` (todas as verificações),
  `/nova-migracao` (migração seguindo as regras abaixo) e `/publicar` (PR `dev` → `main`).
  O `.claude/settings.json` libera os comandos de verificação e formata com o prettier todo
  arquivo editado.
- Não reescreva histórico já enviado (force push, rebase ou amend de commits publicados).
- Commits e títulos de pull request seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):
  `<tipo>(<escopo opcional>): <descrição>`, com a descrição em português, no imperativo e
  em minúsculas, sem ponto final. Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`,
  `style`, `build`, `ci`, `chore`, `revert`. Mudança incompatível leva `!` após o tipo
  (ex.: `feat(db)!: ...`) e um rodapé `BREAKING CHANGE: ...`.
  Escopos comuns: `cadencia`, `funil`, `ranking`, `painel`, `periodos`, `planilha`,
  `empresas`, `auth`, `db`, `ui`, `deps`.

## UI e design system

- Antes de criar ou alterar qualquer tela ou componente, leia `docs/redesign/DESIGN.md`.
- Use só os tokens de `src/styles.css` (classes como `bg-card`, `text-heading`, `bg-primary`,
  `text-dense`, `bg-warning-soft`). Não escreva hex, `text-[11px]` nem cores do Tailwind padrão
  (`slate-*`, `blue-*`) em componentes. O tamanho de título de cartão é `text-card-title`
  (`text-card` é a cor do cartão).
- Tema escuro único: não use `dark:` nem a classe `.dark`. Só desktop: não crie layout de celular.
- O redesign muda só a apresentação. Rótulos e etapas vêm de `STEPS`, `FUNNEL`, `STATUS_LABEL` e
  `SECTORS`; regras e cálculos ficam em `src/lib/`. Respeite a seção 5 de `docs/redesign/inventario.md`.
  Não mexa em `src/lib/`, `src/hooks/` nem em `*.functions.ts`/`*.server.ts` num PR de tela; se a
  tela nova precisar de outro dado ou regra, isso vai num PR separado, com teste.
- Uma tela por PR, com captura de antes e depois (`bun run screenshots` regenera
  `docs/redesign/screenshots/`; as capturas do visual antigo ficam em `docs/redesign/antes/`) e os
  testes de `e2e/` ajustados no mesmo commit.
- Quando o pedido trouxer uma imagem da prancheta do Claude Design, siga a imagem para layout e
  hierarquia, e este design system para cores, tipografia e componentes.

## Banco de dados (Supabase, projeto próprio)

- Migrações ficam só em `supabase/migrations/` (formato do Supabase CLI). Crie com
  `bun run db:new <nome>` e aplique com `bun run db:push` (exige `supabase link`).
- Nunca edite uma migração já aplicada; crie outra.
- Depois de mudar o esquema, rode `bun run db:types` para regenerar
  `src/integrations/supabase/types.ts`. Não edite esse arquivo à mão: o tipo `Contact`
  e as server functions derivam dele.
- SQL que depende de uma versão do app já publicada (ex.: texto de modelos com tags novas)
  vai para `pendente-pos-publicacao/` e só roda depois do deploy.
- Segredos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `SHEET_EXPORT_TOKEN`,
  `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_WEBHOOK_USER`, `PIPEDRIVE_WEBHOOK_PASSWORD`, `CRON_SECRET`)
  ficam nas variáveis de ambiente da Vercel, nunca no repositório.

## Organização do código

- Rotas em `src/routes/` são finas: estado da tela e composição. Componentes de uma tela ficam
  em `src/components/<tela>/` (`ats`, `auth`, `configuracoes`, `contatos`, `empresas`, `hoje`, `importar`, `inicio`, `modelos`, `semana`,
  `ranking`, `painel`); componentes usados em
  mais de uma tela ficam na raiz de `src/components/` (ex.: `SectorSelect`, `InlineInput`,
  `Funnel`); `src/components/ui/` é o shadcn/ui.
- Regras puras de cada tela ficam em `src/lib/<tela>.ts` (`contatos.ts`, `empresas.ts`, `fila.ts`,
  `importar.ts`, `ranking.ts`), com testes ao lado (`*.test.ts`). Lógica que dá para testar não fica em
  componente.
- Hooks compartilhados: `useCadencia` (dados do hunter), `usePainel` (dados do admin),
  `useSelection` (seleção por checkbox). Ações destrutivas passam por `useConfirm`
  (`src/components/useConfirm.tsx`: `ask({ title, desc, word?, action?, reversible?, run })`),
  nunca pelo `confirm()` do navegador.
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
- Ranking é só do administrador: fica na aba "Competição" do /painel (`/ranking` redireciona para `/painel?aba=competicao`); `getCompetition` exige has_role e a função SQL `public.ranking(date)` (SECURITY DEFINER, porque agrega dados de outros hunters que o RLS esconde) devolve vazio para quem não é admin.
- Exclusão de contatos e feriados só via server functions em `src/lib/admin.functions.ts`, após validar ADMIN_PASSWORD (bloqueio em `admin_attempts`); hunters não têm DELETE em `contacts`. O período da competição geral (`competition_settings`) só se edita no painel, aba "Competição" (`painelSetPeriod`, has_role).
- Pontuação da competição: cálculo puro em `src/lib/competition.ts`, carregado com service role em `competition.server.ts`; o cliente recebe só totais.
- Planilha: o Google Sheets puxa CSV via IMPORTDATA de `/api/public/planilha/*.csv` (token = secret SHEET_EXPORT_TOKEN); lógica em `src/lib/planilha.server.ts`, reaproveitando `cadencia.ts` e `competition.server.ts`.
- Painel admin (/painel): papel em public.user_roles + has_role(); toda leitura/exclusão global via server functions em src/lib/painel.functions.ts que validam has_role antes de usar service role.
- Períodos: tabelas periods/groups/subgroups/period_members/period_snapshots; contacts.period_id é carimbado por trigger (período ativo, senão o último) e novos perfis entram no período ativo por trigger — assim as telas dos hunters não precisam mudar. Snapshots são o placar oficial congelado; escrita só via service role.
- Ações de períodos/grupos/membros, transferência de contatos e exclusão de hunter ficam em src/lib/periodos.functions.ts (has_role antes do service role); excluir hunter exige zero contatos porque contacts.user_id apaga em cascata com a conta.
- Ranking por período: período encerrado lê o placar oficial de period_snapshots (loadSnapshot); "maturação atual" recalcula ao vivo só com contatos do período; sem período mantém o cálculo original para não quebrar a planilha.
- Feriados: leitura pública para logados; escrita só por `adminAddHoliday`/`adminRemoveHoliday` (senha de administrador), para manter o mesmo controle das outras ações sensíveis.
- Funil: `FUNNEL` em `cadencia.ts` é a fonte única das etapas (coluna da data, coluna de registro, contador do placar, rótulos e pontos). Cada etapa tem coluna `*_registrado_em` (momento do clique); a pontuação usa `stageScoreDate` em `competition.ts`, e a data agendada (`*_em`) fica só para consolidado — assim agendamentos futuros não represam pontos.
- Tipos de período (periods.kind): 'competicao' (Hacka: contatos do próprio período) e 'ciclo' (equipe: só membros, todos os contatos deles contados pela data de cada etapa, com ranking por semana via computeWeekly). closePeriod aceita `end` para congelar o placar numa data passada. A planilha lê o ciclo em ranking.csv?visao=ciclo e ?visao=semanas.
- Empresas e setores: o hunter cadastra as empresas da semana em /empresas (`companies`, RLS por hunter,
  `week_start` = segunda-feira) e escolhe o setor (ramo de atuação, tabela `sectors`). O contato se liga
  à empresa por `contacts.company_id`; um trigger copia nome e concordância para `contacts.company` e
  `company_gender`, então planilha, ranking e mensagens seguem lendo esses campos. `contacts.sector` é
  outra coisa: a área do contato (TI, RH...), que alimenta [DOR_DO_SETOR].
- Cadências por setor: `sector_templates` (setor × etapa), escritas só pelo admin na aba "Setores e
  cadências" do painel via `src/lib/setores.functions.ts` (has_role antes do service role). Em Envios de
  hoje, `pickTemplate` (`fila.ts`) usa a mensagem do setor da empresa e cai no modelo padrão
  (`message_templates`) quando a etapa não tem mensagem própria. Setor com empresas não é excluído, só
  desativado.
- Preenchimento automático de empresa e área: regras puras em `src/lib/enriquecimento.ts`
  (`companyFromHeadline`, `areaFromTitle`, `autoFillPatch`), sem IA e sem serviço externo. Valem na
  importação (empresa cadastrada citada no headline vira `company_id`; senão o nome do headline vai
  para `contacts.company`) e no botão "Preencher empresa e área" de Contatos. Só preenchem campos
  vazios e, na dúvida, deixam em branco; CEO, sócio e financeiro ficam sem área de propósito. Ao
  ajustar uma regra, acrescente o caso real em `enriquecimento.test.ts`.
- Indicadores (menu próprio "Indicadores" em Administração, rota `/indicadores`, só admin; antes era a
  aba do /painel, e `/painel?aba=indicadores` redireciona): cálculo puro em
  `src/lib/dashboard.ts` (`computeDashboard`), carregado com service role em `painelDashboard`
  (`painel.functions.ts`, has_role antes). Reaproveita `plannedDates`/`isActive`/`computedStatus` e
  `atScoreDate`/`stageScoreDate`, então envios, atrasados e funil batem com Envios de hoje e com o
  placar. O "hoje" vem do navegador (fuso SP) para servidor e tela concordarem. Componentes em
  `src/components/painel/dashboard/`. Limite conhecido: `sentN_at` é o dia em que a etapa foi
  marcada (sem histórico).
- Respostas: `contacts.respondeu_em` é carimbado por trigger quando a situação vira "respondeu"
  (descartar depois mantém a data; voltar para uma situação de cadência apaga). O painel usa
  `responseDate` (`dashboard.ts`): essa data, senão o registro da AT. Respostas marcadas antes da
  coluna existir ficam sem data e fora das contagens por período.
- Resposta positiva ou negativa: ao marcar "respondeu", o mesmo diálogo da mensagem de origem pede
  `contacts.resposta_tipo` (`positiva`/`negativa`; `needsResponseKind` em `cadencia.ts`), e a edição
  do contato permite trocar depois. "Descartado" saiu das opções de situação da edição
  (`statusOptions` em `contatos.ts`): recusa vira resposta negativa. A ação em massa "Marcar como
  descartado" e o filtro continuam.
- Mensagem que gerou a resposta: ao marcar "respondeu" ou a AT (`needsResponseOrigin` em
  `cadencia.ts`), o hunter escolhe a etapa (`contacts.resposta_etapa`, 1–5; 0 = outro canal) num
  diálogo obrigatório (`useResponseOrigin`, `src/components/RespostaOrigem.tsx`) e pode trocá-la
  depois no "Avançar no funil". Um trigger carimba `resposta_modelo` com o código do modelo em uso
  (o do setor, senão o padrão; mesma escolha de `pickTemplate`). O painel usa a etapa informada e,
  sem ela, a última mensagem enviada antes; daí saem "Canal de entrada" e "Mensagens que geram
  reunião" (`entryChannels`/`messages` em `dashboard.ts`). Limite: envios antigos contam com o
  código atual do modelo.
- Metas: tabela `goals` (só service role), uma linha por escopo — equipe (sem `user_id` e
  `group_id`), grupo ou hunter —, com herança campo a campo hunter → grupo → equipe
  (`resolveGoal`). Metas diárias/semanais viram metas do intervalo pelos dias úteis já passados;
  semáforo: na meta ≥ 100%, perto ≥ 70% (no prazo: até 10 pontos abaixo). Escrita por
  `painelSaveGoal`/`painelDeleteGoal` (`painel.functions.ts`, has_role antes).
- Início do hunter (`/inicio`, primeira tela depois do login; o admin continua indo para os
  Indicadores): regras puras em `src/lib/inicio.ts` (`weekAts`, `teamWeekGoal`, `atSlots`, `lateRows`,
  `conversion`), componentes em `src/components/semana/`. As ATs da equipe vêm de `inicioResumo`
  (`inicio.functions.ts`, service role para qualquer hunter logado): o cliente recebe só o dia de
  cada AT dos outros e a meta somada (`ats_semana` de cada hunter, com a herança de `resolveGoal`).
  A equipe é a dos Indicadores (ciclo ativo: só os membros). Envios, atrasados e conversão usam os
  contatos do próprio hunter, com `buildQueues`/`dayProgress` (mesma conta de Envios de hoje).
- Contato manual (botão "Adicionar contato" em Contatos): serve para AT marcada fora da cadência, como
  por e-mail. Regra em `manualAtRow`/`manualAtError` (`contatos.ts`), gravação por `useAddContact`.
  O contato entra como `respondeu`, com `at_marcada_em` na data informada (pode ser futura),
  `at_registrado_em` agora (pontua no dia do cadastro) e `resposta_etapa = 0` (outro canal; o painel
  não separa e-mail de ligação). Nome repetido só gera aviso: para um lead já importado, o caminho
  é "Avançar no funil" no contato existente.
- Contato sem WhatsApp (`contacts.sem_whatsapp`, caixa "Sem WhatsApp" na edição do contato, em Contatos e
  em Envios de hoje): `stepApplies` (`cadencia.ts`) dispensa as etapas de WhatsApp dele. Elas saem das
  filas (`buildQueues`), dos atrasados e da pendência de telefone dos Indicadores, da próxima etapa e
  da conclusão (`computedStatus`). As datas previstas das demais etapas não mudam. Ao criar um uso
  novo de `STEPS`, respeite `stepApplies`.
- Cards do Hackathon fora das métricas atuais: `isHackathonContact` (`fila.ts`) = contato carimbado num
  período `competicao` **encerrado** e criado até o `closed_at` dele (quem entrou depois, mesmo carimbado
  com o último período, é contato novo). Ficam fora de Envios de hoje (com botão para exibi-los), do
  contador da navegação, de envios/atrasados/conversão do Início, das ATs da semana (`inicioResumo`), dos
  Indicadores (salvo quando o filtro é a própria competição) e do placar do ciclo e da competição geral
  (`loadCompetition`; só o período `competicao` os mantém). Na tabela Atividade, `public.ranking()` ignora só
  os eventos posteriores ao encerramento, o histórico do Hackathon continua. Regra do TS e do SQL
  andam juntas: ao mudar uma, revise a outra.
- Recorte do ciclo: quando o período escolhido nos Indicadores é um ciclo, `painelDashboard` usa só
  os membros dele e corta o intervalo nas datas do ciclo (`clampToCycle` em `dashboard.ts`); outros
  períodos no filtro mostram o histórico. Atrasados também respeitam o ciclo: etapa pendente prevista
  antes do início não conta (`lateSince` em `computeDashboard`). Com um ciclo ativo, a tabela "Atividade" da Competição
  também mostra só os membros e só desde o início do ciclo (`activeCycleScope`/`clampStart`/`onlyCycleMembers` em `ranking.ts`);
  "Todos os hunters" mostra o histórico completo. O início de um período ativo pode ser ajustado no
  painel (`setPeriodStart`), sem apagar dados.
- Auditoria de conexões (`/painel?aba=auditoria`): o admin cola as conexões do LinkedIn de um
  hunter e compara com os contatos dele (`painelAuditContacts`, has_role antes do service role).
  O parser é o mesmo da importação (`parseLinkedInConnections`); a comparação é pura em
  `src/lib/auditoria.ts`: casa por nome+headline, depois só nome (headline mudou) e por fim
  primeiro+último nome (nome editado), sem reutilizar um contato. Não grava nada no banco.
- Registro de ATs (substitui a planilha "Registro de ATs - NTec"): `ats` tem uma linha por AT e
  `at_eventos` é o log só de inserção (marcada, remarcada, reaberta, no_show, realizada, cancelada,
  etapa_pipedrive). `ats.status`, `agendada_atual` e `pipedrive_stage_id` são resumo mantido pelo
  trigger `at_eventos_apply` (evento mais recente por `ocorrido_em`, então eventos fora de ordem não
  estragam o resumo); `resumoAt` (`src/lib/ats.ts`) faz a mesma conta em TS: ao mudar uma, revise a
  outra. Remarcações saem da contagem de eventos, nunca de um contador gravado. Fonte da verdade: a
  plataforma manda nos dados da prospecção (o hunter dono edita); o Pipedrive manda no status
  quando a AT tem `pipedrive_deal_id` (o app só registra eventos de AT sem card). Todos os logados
  leem todas as ATs. `time_comercial` substitui a aba "Time" (login ↔ usuário e opção "Hunter" no
  Pipedrive). Leitura das fichas do WhatsApp em `lerFicha` (mesmo formato da skill criar-card): na
  dúvida, o campo fica em branco e o formulário pede. Ainda não entra na competição.
- Carga da planilha de ATs (uma vez, na transição): `bun run db:carga-ats --ats ATs.csv --historico
Historico.csv --time Time.csv` mostra o plano e os avisos; com `--gravar` (e `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`) grava `time_comercial`, `ats` (origem `planilha`) e o log. A lógica é
  pura em `src/lib/cargaAts.ts` (`planoDeCarga`): completa no log o que a linha da aba ATs tem e o
  Histórico não, confere com `resumoAt` e avisa em vez de adivinhar. Rodar de novo não duplica: AT
  com o mesmo card fica como está.
- Tela de ATs (`/ats`, menu Prospecção): regras em `src/lib/ats.ts` (`linhasDaTabela`, `filtrarAts`,
  `podeRegistrarEvento`, `formDaFicha`, `novaAtLinha`, `eventoLinha`), dados em `src/hooks/useAts.ts`,
  componentes em `src/components/ats/`. Todos veem todas as ATs; colar a Ficha de AT preenche o
  formulário e o contato do hunter é ligado pelo nome e empresa. Remarcar, no-show, realizada e
  cancelar só aparecem em AT sem card para o dono ou o admin (mesma regra da política do banco). Nos
  testes de ponta a ponta, `semAdmin()` (`e2e/helpers.ts`) tira o papel de admin do hunter logado.
- Integração com o Pipedrive (status das ATs com card): regra pura em `src/lib/pipedrive.ts`
  (`eventosDoPipedrive`), que olha o card (etapa, ganho/perdido) e a task "AT - 16h30 @hunter" (data,
  hora do assunto e o campo nativo "Resultado"/outcome) e devolve os eventos que faltam no log, cada um
  com `pipedrive_ref` único. Prioridade do desfecho: Resultado da task (Concluído → realizada, Não
  compareceu → no_show, Cancelado → cancelada); depois card em etapa posterior à AT (31, 33–36) →
  realizada; depois card perdido na etapa 108 → cancelada. Task aberta com outra data/hora →
  remarcada (reabre AT com no-show). Sem nenhum desses sinais, card aberto numa etapa anterior à AT
  (voltou no funil) → evento `reaberta` (volta a agendada, mesma data, não conta como remarcação).
  O `pipedrive_ref` leva o momento da mudança, então avançar e voltar várias vezes registra cada vez. Servidor em `src/lib/pipedrive.server.ts` (API v2 com `PIPEDRIVE_API_TOKEN`): o webhook
  `/api/public/pipedrive/webhook` (basic auth `PIPEDRIVE_WEBHOOK_USER`/`PASSWORD`) guarda o payload em
  `pipedrive_webhook_log` e sincroniza o card citado; `/api/public/pipedrive/sincronizar` (cron diário da
  Vercel, `Authorization: Bearer CRON_SECRET`, configurado no `nitro()` do `vite.config.ts`, porque
  com a Build Output API o `vercel.json` não vale) reconcilia as ATs com card agendadas ou dos últimos
  30 dias. Nos testes de ponta a ponta, `PIPEDRIVE_API_URL` aponta para o Pipedrive simulado em
  `e2e/mock-supabase.mjs` (dados em `PIPEDRIVE`, `e2e/fixtures.mjs`).
