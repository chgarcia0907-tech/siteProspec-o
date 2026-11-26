# Plano: Dashboard de Outbound (Indicadores → Dashboard)

Data: 26/11/2026 · Branch: `dev` · Status: aprovado em 26/11/2026; fases 0 a 2 concluídas (migrações das fases 1 e 2 aguardam db:push), próxima: fase 3

Base: `dashboard-outbound-ntec-implementacao.md` (spec) + respostas do usuário às 23 dúvidas
(26/11/2026). Onde este plano diverge da spec, vale este plano.

---

## 0. Decisões fechadas

| #   | Tema                      | Decisão                                                                                                                                                                                              |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lugar                     | Os **Indicadores viram a Dashboard**: rota `/dashboard`, menu "Dashboard". `/indicadores` e `/painel?aba=indicadores` redirecionam. O conteúdo atual é redistribuído nas abas dos módulos (seção 3). |
| 2   | Métrica central           | **ATs que avançaram**. ATs marcadas seguem como meta semanal. Metas do ciclo são escolhidas na plataforma (nada fixo no código).                                                                     |
| 3   | Safras                    | O LO cria e altera as safras do ciclo na plataforma. 26.2: S01 = 09/11/2026; o esquema novo (alocação) começou na S03 (23/11).                                                                       |
| 4   | Safra do contato          | Semana do **`contacts.created_at`** (fuso de São Paulo). Vale para trás: S01 e S02 já ganham safra com os dados existentes.                                                                          |
| 5   | Ciclo anterior            | Não existe esse grupo. Contato fora de qualquer safra do ciclo simplesmente não entra nas métricas por safra.                                                                                        |
| 6   | Retomada                  | Recurso novo para o hunter: marcar prospect que pediu para retomar depois, com data, e deixar salvo. O contato mantém a safra original e fica marcado como retomada.                                 |
| 7   | AT sem contato            | Conta como "fora de cadência" e entra na fila de conciliação; ao ligar ao contato, vai para a safra dele.                                                                                            |
| 8   | Dupla                     | Dois hunters podem dividir uma alocação, mas **todas as métricas são individuais**; a dupla serve para comparar os dois lado a lado.                                                                 |
| 9   | Setor e segmento          | Setor alocado = setor de primeiro nível; segmento = subsetor (opcional). Por safra vale o setor da alocação; na matriz de segmentos, o setor real da empresa.                                        |
| 10  | Teste A/B                 | Definido na plataforma. As versões são propriedades da prospecção (porte, subsetor, setor, persona, nível, área) **e cadência**. Ver 5.8 e o ponto aberto P1.                                        |
| 11  | Convites                  | Sem convites por enquanto. Métricas de conexão = **conexões aceitas** (contatos importados, pela data de conexão).                                                                                   |
| 12  | Cadência                  | Não muda (5 passos, 1 dia útil). "No prazo" = `plannedDates`.                                                                                                                                        |
| 13  | Mensagens conferidas      | Fase futura.                                                                                                                                                                                         |
| 14  | Esforço                   | **Conta combinada**: `(contatos adicionados na safra + passos executados na semana) ÷ (meta de contatos da alocação + meta semanal de passos)`. Mesma soma do mapa de calor hunter × dia.            |
| 15  | Metas                     | Nenhum número no código. O LO preenche na tela; herança equipe → grupo → hunter (`resolveGoal`).                                                                                                     |
| 16  | Não realizada             | Ao fim da maturação: ainda agendada (para fazer/remarcar) + no-show + **cancelada**.                                                                                                                 |
| 17  | Cards do outbound         | Funil 6 + etiqueta NTec (34) + Canal de Entrada "Outbound" (opção 28), sincronizados por cron diário e pelo webhook existente.                                                                       |
| 18  | Indicado a outros núcleos | Fora do escopo.                                                                                                                                                                                      |
| 19  | Porte                     | Campo opcional `companies.porte`, com as faixas do campo "Número de Funcionários" do Pipedrive, escolhido pelo hunter em Empresas.                                                                   |
| 20  | Nível, área, cargo        | Área = `contacts.sector`; cargo = persona; nível = senioridade tirada do cargo (regra nova em `enriquecimento.ts`).                                                                                  |
| 21  | Histórico 25.0–26.1       | Fase futura. "Resultado e ciclos" compara só os ciclos que existem na plataforma.                                                                                                                    |
| 22  | Visual                    | Tema escuro do `DESIGN.md`. **Sem exportação de imagem.** Telas desenhadas com as skills `frontend-design` e `ui-ux-pro-max` (seção 6).                                                              |
| 23  | Alertas                   | Calculados na hora, faixa na Visão geral + contador no menu. Sem WhatsApp/e-mail e sem "marcar como lido".                                                                                           |
| —   | Acesso                    | Só admin (`has_role`). Perfis Hunter/CN/Gerência entram com o plano de cargos (`docs/planos/acessos-perfis-agenda.md`). A retomada (6) e o porte (19) são as únicas mudanças em telas do hunter.     |
| —   | Avanço                    | Card na etapa 33 "AT Aprof. Marcada" ou além (34, 35, 36) ou ganho, em qualquer momento (usa o histórico de etapas, não só a etapa atual).                                                           |
| —   | Fonte das ATs             | Tabela `ats` (`tipo = 'diagnostico'`). "Marcada na semana" = `registrada_em`. Venda = card ganho; proposta = etapa 34+; ticket = `value` do card ganho.                                              |

### Decisões que tomei no plano (mude na revisão se discordar)

- **Fim de semana:** contato criado no sábado ou domingo entra na safra da semana que começou na
  segunda anterior (mesma regra de `weekStartISO`/`mondayOf`). A safra é exibida como seg–sex.
- **Safra sem alocação:** cada safra tem a opção "usa alocação". S01 e S02 do 26.2 ficam sem ela:
  aparecem nas métricas por safra, mas não geram "contato sem alocação" nem cobram meta de safra.
- **Mudar as datas de uma safra** reatribui os contatos (a safra sai sempre de `created_at`), com
  confirmação por `useConfirm`. Excluir só safra sem alocação.
- **Contato parado:** em cadência (`computedStatus = em_cadencia`), sem envio há mais de N **dias
  úteis** (padrão 3) e sem resposta.
- **Conferência diária do LO:** a aba Hunters mantém o seletor de dia (hoje/ontem) que os
  Indicadores têm hoje, além da visão por semana.
- **Tasks no prazo:** a semana atual lê o Pipedrive na hora (como `/tasks`); semanas passadas
  saem do espelho de tasks (fase 5).

---

## 1. Como fica o modelo de dados

```
periods (kind='ciclo') ──< safras ──< alocacoes >── sectors (setor e subsetor)
        │                              │ user_id (hunter), dupla
        ├── ciclo_metas                └ meta_empresas, meta_contatos, vigente_desde
        └──< ab_testes ──< ab_versoes
contacts (created_at → safra; retomar_em…)   companies (+ porte)
ats ──(pipedrive_deal_id)── pd_cards ──< pd_card_etapas
                                      └──< pd_tasks
dashboard_parametros (uma linha)      goals (+ passos_semana)
```

Leitura e escrita das tabelas novas só pela service role (server functions com `has_role`
antes), como `goals`. Exceção: as colunas de retomada em `contacts`, que o hunter grava pelo RLS
que já existe.

---

## 2. Fases e pull requests

Regras do repositório que moldam a divisão: dados/regras num PR e tela em outro; uma tela por PR,
com captura de antes e depois e `e2e/*.spec.ts` ajustado no mesmo commit; migração via
`/nova-migracao` + `bun run db:types`; `/verificar` antes de cada push.

Prioridade: a S03 já está correndo, então as fases 1 a 3 vêm primeiro. Como a safra sai de
`created_at`, as semanas S01–S03 aparecem retroativamente assim que a fase 1 entrar.

### Fase 0 — Preparação

- **PR 0.1 `chore: adiciona as skills frontend-design e ui-ux-pro-max`** (já instaladas, falta o
  commit autorizado).
- **PR 0.2 `refactor(painel)!: renomeia Indicadores para Dashboard`**
  - Rota `src/routes/_authenticated/dashboard.tsx` (a busca atual continua válida);
    `indicadores.tsx` vira redirecionamento; `painel.tsx` passa a redirecionar `aba=indicadores`
    para `/dashboard`.
  - Menu "Dashboard" em `AppSidebar.tsx`; o admin cai em `/dashboard` depois do login.
  - Componentes `src/components/painel/dashboard/` → `src/components/dashboard/` (só mudança de
    caminho).
  - `e2e/indicadores.spec.ts` → `e2e/dashboard.spec.ts`; `navegacao.spec.ts` ajustado.
  - AGENTS.md e DESIGN.md: nome, rota, pasta e a métrica central (ATs que avançaram).
- **PR 0.3 `docs(ui): seção Dashboard no DESIGN.md`** (saída do processo da seção 6):
  - tokens `--chart-1..5` a partir da paleta NTec, clareados para contraste ≥ 3:1 sobre `bg-card`;
    mapa fixo entidade → cor (hunter, ciclo, versão A/B, situação da AT);
  - token de "imaturo/amostra pequena" (cinza) e o selo "imatura";
  - cartão de gráfico padrão: título "Métrica por Dimensão (período)", taxa com n ("52,4% (11 de
    21)"), linha de fonte, estado vazio;
  - regras da spec que continuam: uma métrica por gráfico, sem eixo Y duplo, sem pizza/rosca/3D,
    só grade horizontal, eixo Y em 0 nas barras, rótulos só onde sustentam a leitura, números no
    formato brasileiro.

### Fase 1 — Safras, ciclo e parâmetros

- **PR 1.1 `feat(db): cria safras, metas do ciclo e parâmetros da dashboard`**
  - `safras`: `id`, `period_id` (ciclo), `numero` (1, 2…), `inicio` (segunda), `fim` (sexta),
    `usa_alocacao boolean`, `unique (period_id, numero)`, `check (inicio <= fim)`; sem
    sobreposição dentro do ciclo (checado na server function e por exclusão no banco se o
    `btree_gist` estiver disponível).
  - `ciclo_metas`: `period_id` (PK) e metas opcionais do ciclo: `ats_avancaram`, `ats_marcadas`,
    `ats_realizadas`, `contatos`, `vendas`.
  - `dashboard_parametros` (linha única): `maturacao_semanas` 3, `amostra_minima_ab` 500,
    `min_ats_segmento` 10, `avanco_fica_pct` 50, `avanco_troca_pct` 35, `esforco_alerta_pct` 70,
    `dias_contato_parado` 3, `concentracao_ats_pct` 30, `nao_realizadas_pct` 15,
    `semanas_seguidas` 2.
  - `goals.passos_semana` (nova coluna, mesma herança).
- **PR 1.2 `feat(painel): regras de safra`** — `src/lib/safras.ts` + testes:
  - `codigoSafra` (`26.2-S03`), `safraDaData`, `safraDoContato` (pelo `created_at` em SP),
    `statusSafra` (planejada, em prospecção, em cadência, em maturação, madura, pela janela de
    `dashboard_parametros`), `safraMadura`, `semanasDoCiclo` (sugestão de S01…Sn a partir do início
    do ciclo), validação de sobreposição e de datas.
  - Server functions em `src/lib/dashboard.functions.ts` (novo; `has_role` antes da service role):
    listar/criar/editar/excluir safra, gerar semanas do ciclo, ler/gravar parâmetros, ler/gravar
    metas do ciclo e `passos_semana`.
- **PR 1.3 `feat(painel): aba Semanas com o calendário de safras`**
  - Calendário (safras × semanas com o status), criar/gerar/editar/excluir safra, "usa alocação",
    metas do ciclo e parâmetros (num diálogo "Configurar dashboard").

### Fase 2 — Alocação e porte

- **PR 2.1 `feat(db): cria alocações e o porte da empresa`**
  - `alocacoes`: `id`, `safra_id`, `user_id`, `sector_id` (primeiro nível), `subsector_id` (null),
    `dupla` (rótulo curto; no máximo 2 hunters por rótulo na safra), `meta_empresas`,
    `meta_contatos`, `motivo_meta_zero` (obrigatório se as duas metas forem 0), `vigente_desde`
    (data; troca de setor no meio da semana = nova linha), `created_by`, carimbos.
  - `companies.porte` (texto com `check` nas faixas: 1-10, 11-50, 51-200, 201-500, 501-1.000,
    1.001-5.000, 5.001-10.000, 10.001+), opcional.
- **PR 2.2 `feat(painel): regras de alocação`** — `src/lib/alocacao.ts` + testes:
  - `alocacaoVigente(hunter, data)` (a linha com o maior `vigente_desde` ≤ data na safra),
    `setorAlocadoDoContato`, `podeEditarAlocacao` (livre até o início da safra; depois só troca de
    setor com nova vigência), `duplaValida`, `semMeta` (meta zero não dispara alertas de esforço),
    `copiarAlocacoes` (repetir a safra anterior).
  - Server functions de alocação.
- **PR 2.3 `feat(painel): tabela de alocação da semana`** — na aba Semanas: tabela editável
  hunter × setor, subsetor, dupla, metas, motivo de meta zero; "copiar da semana anterior";
  troca de setor com data de vigência.
- **PR 2.4 `feat(empresas): escolhe o porte da empresa`** — select opcional em Empresas (tela do
  hunter), com teste e2e.

### Fase 3 — Hunters (Módulo 2)

- **PR 3.1 `feat(painel): métricas individuais por safra e semana`** — `src/lib/dashHunters.ts` +
  testes, reaproveitando `plannedDates`, `stepApplies`, `computedStatus`, `resolveGoal` e o
  cálculo de no prazo de `dashboard.ts`:
  - fila de prospecção (safra N): setor alocado, metas, empresas e contatos adicionados,
    contatos por empresa, conexões aceitas;
  - fila de cadência (safra N−1): em cadência, passos previstos hoje/semana, executados no prazo,
    contatos parados;
  - disciplina da semana: esforço combinado (decisão 14), passos no prazo, tasks no prazo, dias
    ativos, participação nas ATs;
  - resultado: taxa de resposta (por canal), ATs por 100 contatos, % avanço, histórico por safra
    (imaturas marcadas);
  - mapa de calor hunter × dia (contatos adicionados + passos), dispersões volume × avanço e
    disciplina × resultado;
  - comparação da dupla (os dois hunters lado a lado, métricas individuais).
  - Server function `dashboardHunters` (lê contatos, empresas, alocações, ATs e tasks do
    Pipedrive na hora para a semana atual).
- **PR 3.2 `feat(painel): aba Hunters da dashboard`**
  - Visão Equipe: tabela hunter × disciplina com cores contra a meta (absorve "Execução por
    hunter", "Envios por dia" e "Metas" dos Indicadores), mapa de calor, participação semanal
    nas ATs (barras 100%), as duas dispersões.
  - Ficha do hunter (clicar no nome): as duas filas, esforço × meta por semana, funil
    individual × média da equipe, conexões aceitas × taxa de resposta, histórico por safra,
    e o par da dupla quando houver.

### Fase 4 — Retomada (telas do hunter)

- **PR 4.1 `feat(db): retomada de contato`** — `contacts.retomar_em date`, `retomar_motivo text`,
  `retomada_marcada_em timestamptz` (carimbo por trigger), `retomado_em timestamptz`.
- **PR 4.2 `feat(contatos): regras de retomada`** — em `cadencia.ts`/`contatos.ts`:
  `retomadaPendente`, `retomadasDoDia`, patch de marcar/desmarcar/concluir; o contato mantém a
  safra e conta como retomada nas métricas.
- **PR 4.3 `feat(contatos): marcar contato para retomar depois`** — ação na linha de Contatos
  (data obrigatória, motivo opcional), filtro "Para retomar" e selo com a data.
- **PR 4.4 `feat(hoje): fila de retomadas do dia`** — em Envios de hoje, aba "Retomadas" com os
  contatos de `retomar_em ≤ hoje`, ação "Retomei o contato" (carimba `retomado_em`).

### Fase 5 — Espelho do Pipedrive e conciliação

- **PR 5.1 `feat(db): espelho dos cards do outbound`**
  - `pd_cards`: `deal_id` (PK), `titulo`, `stage_id`, `status` (open/won/lost), `valor`,
    `lost_reason`, `add_time`, `won_time`, `lost_time`, `hunter_login` (campo Hunter), `porte`
    (Número de Funcionários), `person_id`, `cargo` (campo Cargo da pessoa), `etiquetas int[]`,
    `canal_entrada`, `sincronizado_em`.
  - `pd_card_etapas`: `deal_id`, `stage_id`, `entrou_em`, `saiu_em` (tempo por etapa e avanço
    "em qualquer momento").
  - `pd_tasks`: `activity_id` (PK), `deal_id`, `assunto`, `due_date`, `done`,
    `marked_as_done_time`, `hunter_login`.
- **PR 5.2 `feat(painel): sincroniza os cards do outbound`**
  - Puro em `src/lib/pipedrive.ts`: `ehCardOutbound` (decisão 17), `cardDoPipedrive`,
    `etapasDoFluxo`, `avancou` (33+ ou ganho no histórico), `situacaoAoFimDaMaturacao`
    (decisão 16).
  - Servidor em `pipedrive.server.ts`: o cron diário passa a listar os deals do funil 6 com
    `updated_since` (incremental) e grava o espelho; o histórico de etapas vem do `flow` do
    card (API v1) na primeira vez e depois das mudanças vistas pelo webhook. O webhook atual
    também atualiza `pd_cards`. Mock no `e2e/mock-supabase.mjs` + `PIPEDRIVE` em `fixtures.mjs`.
- **PR 5.3 `feat(painel): regras de conciliação`** — `src/lib/conciliacao.ts`: ATs sem card,
  cards sem AT, ATs sem contato, contatos sem alocação (só em safra com `usa_alocacao`),
  negócios sem cargo; server functions para ligar AT ↔ contato e AT ↔ card.
- **PR 5.4 `feat(painel): aba Conciliação`** — fila com as quatro listas e as ações de ligar;
  contador no título da aba.

### Fase 6 — Visão geral (Módulo 1) e alertas

- **PR 6.1 `feat(painel): métricas de ritmo e alertas`** — `src/lib/dashRitmo.ts` e
  `src/lib/dashAlertas.ts` + testes:
  - cartão central (ATs que avançaram: semana atual × média do ciclo × meta do ciclo);
  - árvore (contatos, Prospect → AT, % não realizadas, % avanço) com variação semanal;
  - ritmo semanal (marcadas, realizadas, avançaram + meta), ATs da semana empilhadas pela safra
    de origem, funil do ciclo (contatos → ATs → realizadas → avançaram → proposta → venda);
  - semáforo de esforço < 70%;
  - os 7 alertas da spec (sem o de mensagens conferidas), com limites de
    `dashboard_parametros`; meta zero não dispara alerta de esforço.
- **PR 6.2 `feat(painel): aba Visão geral da dashboard`** — substitui o topo atual dos
  Indicadores (KPIs, "Quem precisa de ajuda", Tendência); clicar num fator da árvore abre a aba
  que o explica; contador de alertas no item "Dashboard" do menu.

### Fase 7 — Realização e avanço (Módulo 4)

- **PR 7.1 `feat(painel): métricas de realização e avanço`** — `src/lib/dashRealizacao.ts`:
  situação das ATs por semana, mapa horário × dia de no-show/remarcação (`agendada_atual`), dias
  marcação → AT × % realizada (0-2, 3-5, 6-10, 10+), funis por setor alocado, motivo de perda ×
  etapa, tempo por etapa × meta (`days_to_rotten` das etapas como meta inicial, editável nos
  parâmetros).
- **PR 7.2 `feat(painel): aba Realização e avanço`.**

### Fase 8 — Segmentos (Módulo 3) e testes A/B por propriedade

- **PR 8.1 `feat(contatos): nível de senioridade pelo cargo`** — `nivelDoCargo` em
  `enriquecimento.ts` + casos reais no teste.
- **PR 8.2 `feat(db): testes A/B`** — `ab_testes` (`period_id`, nome, dimensão, descrição, safra
  inicial e final, status) e `ab_versoes` (`teste_id`, rótulo, valores da dimensão).
- **PR 8.3 `feat(painel): métricas de segmento e A/B`** — `src/lib/dashSegmentos.ts` e
  `src/lib/abTestes.ts`: matriz Prospect → AT × % avanço por setor, porte, nível, área (só
  safras maduras, cinza abaixo de 10 ATs realizadas), contatos por empresa × Empresa → AT,
  canais, cargo (persona), safra × setor alocado, regra de decisão (fica/ajusta/troca), resultado
  A/B só conclusivo com amostra mínima e safras maduras.
- **PR 8.4 `feat(painel): aba Segmentos`** (absorve "Origem", "Mensagens que geram reunião" e
  "Conversão" dos Indicadores) e o cadastro de testes A/B na aba Semanas.

### Fase 9 — Resultado e curvas de safra (Módulo 5 e resto da 6.6)

- **PR 9.1 `feat(painel): métricas de resultado e curvas de safra`** — `src/lib/dashResultado.ts`:
  pipeline, conversão AT → venda, ticket e dias até fechar por porte, valor esperado por AT por
  segmento, indicadores por ciclo (só ciclos da plataforma), higiene de dados; mapa de safras,
  curvas de safra e distribuição de dias prospecção → AT (calibração da maturação, P90).
- **PR 9.2 `feat(painel): aba Resultado e ciclos`** e **PR 9.3** mapa/curvas/distribuição na aba
  Semanas. "Abastecimento" dos Indicadores vai para a aba Semanas aqui.

### Fase 10 — Futuro (fora deste plano)

A/B por cadência (P1), mensagens conferidas, perfis Hunter/CN/Gerência e a ficha vista pelo
hunter, histórico 25.0–26.1, valor indicado a outros núcleos.

---

## 3. De onde vai cada parte dos Indicadores atuais

| Hoje (Indicadores)                        | Vai para                          |
| ----------------------------------------- | --------------------------------- |
| KPIs "a equipe está no ritmo?", Tendência | Visão geral (fase 6)              |
| Quem precisa de ajuda (alertas)           | Visão geral, com os alertas novos |
| Metas da semana, Execução por hunter      | Hunters (fase 3)                  |
| Envios por dia, Ritmo entre etapas        | Hunters (mapa de calor e ficha)   |
| Funil                                     | Visão geral (funil do ciclo)      |
| Origem, Mensagens, Conversão (coortes)    | Segmentos (fase 8)                |
| Abastecimento                             | Semanas (fase 9)                  |

Até cada aba nova sair, a parte antiga continua visível numa aba "Detalhamento" (o conteúdo de
hoje), que some no PR da última aba. `computeDashboard` continua existindo enquanto alguma parte o
usar.

Filtros globais (todas as abas): **ciclo · safra · hunter · dupla · setor alocado**, na URL como
hoje. O intervalo de datas fica só onde a base é o calendário (seletor de dia/semana em Hunters).

---

## 4. Rotas, componentes e testes

- Rota `/dashboard?aba=visao|hunters|segmentos|realizacao|resultado|semanas|conciliacao`
  (fina: estado e composição). Componentes em `src/components/dashboard/<aba>/`; o cartão de
  gráfico padrão e a taxa com n em `src/components/dashboard/shared/`.
- Dados: uma server function por aba em `dashboard.functions.ts` (`has_role` antes), cálculo puro
  em `src/lib/dash*.ts`; o cliente recebe só números prontos.
- Vitest para cada `src/lib/*.ts` novo, com os critérios de aceite da spec (seção 11) como casos:
  contato da S03 com AT na S05 conta na S03; ficha na S05 mostra prospecção S05 e cadência S04;
  S03 vista na S05 = em maturação e fora da matriz; meta zero não dispara 70%; AT sem card gera
  alerta no mesmo dia; troca de setor na quarta gera duas linhas e os contatos caem no setor
  certo; segmento com < 10 ATs realizadas fica cinza; toda taxa tem numerador e denominador.
- E2E: `e2e/dashboard.spec.ts` por aba (com fixtures de safras, alocações e `pd_cards`; relógio
  fixo em 12/11/2026 = S01), `empresas.spec.ts` (porte), `contatos.spec.ts` e `hoje.spec.ts`
  (retomada), `pipedrive.spec.ts` (espelho), `navegacao.spec.ts` (redirecionamentos). Capturas com
  `bun run screenshots`.

---

## 5. Detalhes de regra

1. **Safra do contato:** `safraDoContato(created_at)` = safra do ciclo cujo `[inicio, domingo
seguinte ao fim]` contém a data em SP. Sem safra → fora das métricas por safra.
2. **Herança:** atividades, ATs e cards herdam a safra do contato (via `ats.contact_id`); AT sem
   contato = "fora de cadência", aparece separada nos totais.
3. **Contatos prospectados** = contatos com `created_at` na safra; **empresas prospectadas** =
   `company_id` distintos desses contatos.
4. **Conexões aceitas** = contatos importados com `connected_at` na semana (sem `connected_at`,
   conta pelo `created_at`).
5. **Taxa de resposta** = contatos com `respondeu_em` ÷ contatos, por canal da mensagem que
   gerou a resposta (`resposta_etapa`, como hoje nos Indicadores).
6. **Maturação:** madura a partir de N + 1 + `maturacao_semanas`; antes disso "remarcar" e "para
   fazer" são estados em aberto. Safras não maduras em cinza, fora de rankings e regras.
7. **Meta semanal batida** = ATs marcadas (por `registrada_em`) na semana ≥ soma das metas
   `ats_semana` dos hunters (herança). Atingimento = semanas batidas ÷ semanas.
8. **Teste A/B por propriedade:** a versão do contato sai do valor da dimensão (porte da
   empresa, subsetor, setor, persona, nível ou área) nas safras do teste; contato fora das
   versões não entra. Conclusivo só com `amostra_minima_ab` contatos por versão e safras maduras.

---

## 6. Processo de design (skills)

Para cada PR de tela (0.3, 1.3, 2.3, 3.2, 4.3, 4.4, 5.4, 6.2, 7.2, 8.4, 9.2, 9.3):

1. **`ui-ux-pro-max`**, consultas pequenas e específicas, por exemplo
   `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain chart` para
   escolher cada gráfico, e `--domain ux` para acessibilidade, tabelas e filtros. Saída não
   confirmada não vira regra.
2. **`frontend-design`**, primeira passada: hierarquia da tela, o elemento de destaque e um
   wireframe em ASCII, revisados contra o `DESIGN.md` (o brief do projeto vence: tema escuro,
   tokens, Host Grotesk/Nunito Sans, só desktop). Paletas e fontes das skills não entram.
3. **Aprovação do wireframe** pelo usuário antes do código.
4. Implementação com os componentes do design system e `recharts` (já instalado).
5. Revisão por captura (Playwright, `deviceScaleFactor: 2`) e checklist de
   `references/pro-rules.md` da `ui-ux-pro-max`, sem as regras de celular.

---

## 7. Pontos resolvidos na revisão (26/11/2026)

- **P1. A/B por cadência:** fase própria depois da fase 8, com plano separado (mexe no par
  `resolveTemplate` ↔ `stamp_resposta_origem`). A fase 8 cobre só propriedades da prospecção.
- **P2. Retomada:** só data + motivo + fila no dia; não reinicia a cadência nem gera mensagem
  própria.
- **P3. Metas de tempo por etapa:** começam com o `days_to_rotten` de cada etapa do Pipedrive
  (7, 10, 7, 4, 5 dias), editáveis nos parâmetros.
