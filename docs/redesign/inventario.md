# Redesign — Fase 0: inventário das telas

Briefing para o redesign do frontend da Cadência Outbound. Descreve o que existe hoje, tirado do
código no commit `9492813`. Não propõe soluções; as observações de UX apontam problemas visíveis no
código e nas capturas de tela.

**Capturas de tela:** ficam em `docs/redesign/screenshots/desktop/` e
`docs/redesign/screenshots/celular/` (largura de um Pixel 7), com os mesmos nomes nas duas pastas:
`00-inicio`, `01-entrar`, `02-hoje`, `03-contatos`, `04-empresas`, `05-importar`, `06-modelos`,
`08-configuracoes`, `09-painel-indicadores`, `10-painel-hunters`,
`11-painel-periodos`, `12-painel-setores`, `13-painel-competicao` e `14-painel-busca` (`.png`; não há `07`: a antiga tela de Ranking virou a aba Competição do painel). As
capturas mostram as telas com dados; os **estados vazios não aparecem nelas** e estão descritos só
no texto.

---

## 1. Visão geral

### Quem usa

| Perfil                                                    | O que faz                                                                                                                                                                                                                                            | Como entra                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Hunter** (maioria)                                      | Cadastra as empresas da semana, importa conexões do LinkedIn, envia as 5 mensagens da cadência no dia certo e registra o avanço no funil (AT, lead, proposta...). **Não vê o ranking.**                                                              | `/auth`, depois cai em `/hoje`.                                                        |
| **Admin** (papel `admin` em `user_roles`, via `has_role`) | Acompanha os indicadores da equipe, vê e apaga contatos de todos, gerencia hunters, períodos, grupos e membros, setores e suas cadências, define metas e acompanha a competição (o ranking só aparece para ele). Admins **não aparecem** no ranking. | `/auth`, depois cai em `/painel`. O link "Painel Admin" aparece na navegação.          |
| **"Área do administrador"** (senha `ADMIN_PASSWORD`)      | Fica em `/configuracoes`, **visível a qualquer hunter**, mas só abre com a senha. Exclui contatos em massa e gerencia feriados.                                                                                                                      | Senha digitada na própria tela. Há bloqueio por tentativas erradas (`admin_attempts`). |

**Métrica-guia:** reuniões (ATs, "AT marcada") por semana. A AT é a 1ª etapa do `FUNNEL`, vale +3
pontos, e quem marca mais ATs na semana ganha +6 de bônus. Uma AT marcada **tira o contato das
filas de envio**.

### Conceitos de domínio que aparecem em várias telas

- **Cadência = `STEPS`** (`src/lib/cadencia.ts`). São 5 toques, alternando os canais:
  | n                                                                                                | Rótulo     | Canal    | Campo de envio                                                |
  | ------------------------------------------------------------------------------------------------ | ---------- | -------- | ------------------------------------------------------------- |
  | 1                                                                                                | LinkedIn 1 | linkedin | `sent1_at` (+ `step1_date` = data planejada/real do 1º toque) |
  | 2                                                                                                | WhatsApp 1 | whatsapp | `sent2_at`                                                    |
  | 3                                                                                                | LinkedIn 2 | linkedin | `sent3_at`                                                    |
  | 4                                                                                                | WhatsApp 2 | whatsapp | `sent4_at`                                                    |
  | 5                                                                                                | LinkedIn 3 | linkedin | `sent5_at`                                                    |
  | As datas previstas são **calculadas** por `plannedDates` em dias úteis, sem fins de semana e sem |
  | feriados. Os intervalos (D+0, 1, 2, 3, 4) são de cada hunter e ficam em `settings`.              |
- **Funil = `FUNNEL`**. As etapas são cumulativas, cada uma com uma coluna de data `*_em` e uma
  coluna de registro `*_registrado_em`:
  | Etapa (`label`)  | Abreviação (`abbr`) | Pontos | Campo           |
  | ---------------- | ------------------- | ------ | --------------- |
  | AT marcada       | ATs                 | +3     | `at_marcada_em` |
  | Lead             | Leads               | +5     | `lead_em`       |
  | Proposta marcada | Propostas           | +10    | `proposta_em`   |
  | Aprovação verbal | Aprov. verbais      | +25    | `aprovacao_em`  |
  | Projeto vendido  | Vendidos            | +50    | `vendido_em`    |
- **Situação do contato (`STATUS_LABEL`)**: `aguardando` "Aguardando início", `em_cadencia` "Em
  cadência", `respondeu` "Respondeu", `concluido` "Concluído", `descartado` "Descartado". Na UI ela
  é derivada por `computedStatus`: respondeu e descartado são manuais; concluído = os 5 envios
  feitos; em cadência = tem `step1_date` ou `sent1_at`.
- **Dois "setores" diferentes** (a UI agora separa os nomes):
  - **Área do contato (`SECTORS`, campo `contacts.sector`)**: Tecnologia / TI, Operações,
    Marketing, RH, Produto / Inovação, Comercial / Vendas. É a área do lead, alimenta
    `[DOR_DO_SETOR]` nas mensagens. Na UI aparece como **"Área"** (`SectorSelect`).
  - **Setor da empresa (tabela `sectors`)**: ramo de atuação da empresa (ex.: "Varejo"), criado pelo
    admin. Define qual **cadência de mensagens** o contato recebe. Na UI aparece como **"Setor"**
    (`IndustrySelect`).
- **Empresas (`companies`)**: cadastradas por cada hunter em `/empresas` (RLS por hunter), com nome,
  concordância (`gender`), setor (`sector_id`) e semana de prospecção (`week_start` = segunda-feira).
  O contato se liga a uma empresa por `contacts.company_id`; um trigger copia nome e concordância
  para `contacts.company` e `company_gender` (planilha, ranking e mensagens seguem lendo esses
  campos). Contato sem vínculo continua com a empresa em texto livre.
- **Cadências por setor (`sector_templates`, setor × etapa)**: escritas pelo admin. Em Envios de
  hoje, `pickTemplate` (`fila.ts`) usa a mensagem do setor da empresa do contato e cai no modelo
  padrão (`message_templates`) quando a etapa não tem mensagem própria.
- **Preenchimento automático** (`src/lib/enriquecimento.ts`, sem IA nem serviço externo): tira a
  empresa e a área do headline/cargo. Vale na importação e no botão "Preencher empresa e área" de
  Contatos. Só preenche campos vazios; na dúvida, deixa em branco.
- **Artigo da empresa (`company_gender`)**: masculino ("no"), feminino ("na", o padrão) ou
  sem_artigo ("em"). Define a concordância nas mensagens.
- **Períodos**: `periods.kind` = `ciclo` (ciclo da equipe, com ranking semanal) ou `competicao`
  (estilo Hacka). Só um pode estar ativo por vez. Ao ser encerrado, o placar oficial fica congelado
  em `period_snapshots`.

### Shell e navegação (`src/routes/_authenticated/route.tsx`)

- Header sticky, com `h-14`, `bg-card/95` e `backdrop-blur`, largura máxima de 1600px.
  - Logo em texto: "Cadência **Outbound**" ("Outbound" na cor `linkedin`), que leva a `/hoje`.
  - Nav horizontal (`overflow-x-auto`, sem menu mobile): **Envios de hoje · Empresas · Contatos ·
    Importar conexões · Modelos · Configurações**, mais **Painel Admin** (em `text-primary`
    semibold) só se `painelIsAdmin` responder admin. Não há item "Ranking": o placar fica só no
    painel. O item ativo usa `data-[status=active]:bg-accent`.
  - **No celular** (largura de um Pixel 7) a nav quebra mal: os itens são espremidos entre o logo e
    o botão "Sair", "Envios de hoje" quebra em **3 linhas** e só **"Envios de hoje" e "Empresas"**
    ficam visíveis. Contatos, Importar conexões, Modelos, Configurações e Painel Admin ficam
    escondidos na rolagem horizontal da nav, sem nenhuma indicação de que há mais itens.
  - O e-mail do usuário aparece só a partir de `md`. Botão **"Sair"** (outline) limpa o cache do
    React Query e faz signOut.
- `main`: `max-w-[1600px] px-4 py-6`. A rota é client-only (`ssr: false`): sem sessão, redireciona
  para `/auth`.
- Root (`__root.tsx`): `<Toaster>` (sonner) global, mais a página 404 ("Página não encontrada",
  botão "Voltar ao início") e a de erro ("Esta página não carregou", com "Tentar novamente" e
  "Início"). `lang="pt-BR"`, fonte Inter Tight via Google Fonts.

### Rotas

| Rota                                                     | Propósito                                                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                      | Landing pública. Explica o produto e leva a "Entrar". Com sessão, redireciona para `/hoje`.                                                                       |
| `/auth`                                                  | Login e cadastro por e-mail e senha. O admin é levado a `/painel`, o hunter a `/hoje`.                                                                            |
| `/hoje`                                                  | Fila diária de envios por etapa da cadência (com atrasados): copiar mensagem, abrir WhatsApp, marcar envio e avançar no funil.                                    |
| `/empresas`                                              | Cadastro das empresas prospectadas na semana, com setor e concordância; lista agrupada por semana.                                                                |
| `/contatos`                                              | Tabela editável de todos os contatos do hunter: dados, datas da cadência, situação, funil, ações em lote e CSV.                                                   |
| `/importar`                                              | Colar o texto da página de conexões do LinkedIn, pré-visualizar (novos, duplicados, fora do filtro) e importar.                                                   |
| `/modelos`                                               | Os modelos de mensagem (só leitura): o padrão da equipe ou a cadência de um setor, com pré-visualização.                                                          |
| `/ranking`                                               | Sem tela: redireciona para `/painel?aba=competicao` (mantém links antigos). O ranking é só do admin.                                                              |
| `/configuracoes`                                         | Nome, nome nas mensagens, gênero, intervalos da cadência e Área do administrador (senha; contatos e feriados).                                                    |
| `/painel`                                                | Painel do admin (`has_role`) com abas na URL (`?aba=`): Indicadores (padrão), Hunters, Períodos e grupos, Setores e cadências, Competição (ranking), Busca geral. |
| `/api/public/planilha/*.csv`, `/api/public/export-sheet` | Endpoints CSV para o Google Sheets. Não têm UI.                                                                                                                   |

---

## 2. Telas

### 2.1 `/` — Landing (`src/routes/index.tsx`)

- **Objetivo:** apresentar o produto e levar ao login.
- **Quem usa:** visitante sem sessão. Quem tem sessão é redirecionado para `/hoje` no `useEffect`,
  o que faz a landing piscar antes do redirecionamento.
- **Dados exibidos:** textos fixos. Eyebrow "Prospecção outbound", H1 "Cadência Outbound", parágrafo
  e 4 "cards" de feature ("Importação por copiar e colar", "Fila de envios de hoje e atrasados",
  "Modelos com nome preenchido", "Empresas da semana com cadência por setor"). Não cita mais o ranking.
- **Ações:** botão-link **"Entrar"**, que leva a `/auth`.
- **Estados:** nenhum além do redirecionamento.
- **Componentes:** `ui/button`.
- **Observações de UX:** é texto puro, sem imagem nem identidade visual. Não há link de cadastro
  direto, que fica dentro de `/auth`.

### 2.2 `/auth` — Entrar / Criar conta (`src/routes/auth.tsx`)

- **Objetivo:** login e cadastro.
- **Quem usa:** todos. Com sessão ativa, redireciona para `/hoje`.
- **Dados exibidos:** Card centralizado (`max-w-sm`) com o título "Cadência Outbound" e a descrição
  "Entre com seu e-mail para ver seus contatos." (login) ou "Crie sua conta de hunter." (cadastro).
- **Ações:**
  - Campos: **Seu nome** (só no cadastro, placeholder "Como a equipe vai ver seu nome"), **E-mail**,
    **Senha** (mínimo de 6, com botão de olho "Mostrar senha"/"Ocultar senha").
  - Submit: **"Entrar"** / **"Criar conta"** (mostra "Aguarde..." enquanto carrega).
  - Alternar modo: link **"Criar conta"** / **"Já tenho conta"**. Link **"Voltar"** leva a `/`.
- **Estados:** "Aguarde..."; erro em toast (mensagem do Supabase, em inglês); no cadastro sem
  sessão, toast "Conta criada. Confirme o e-mail pelo link que enviamos para entrar.".
- **Dados:** `supabase.auth.signInWithPassword` e `rpc('has_role')` (decide `/painel` ou `/hoje`),
  além de `supabase.auth.signUp`.
- **Componentes:** `ui/card`, `ui/input`, `ui/label`, `ui/button`.
- **Observações de UX:** não há "esqueci a senha". As mensagens de erro do Supabase não são
  traduzidas. O cadastro é aberto a qualquer e-mail.

### 2.3 `/hoje` — Envios de hoje (`src/routes/_authenticated/hoje.tsx`)

- **Objetivo:** a tela principal do hunter. Mostra quem recebe cada mensagem na data escolhida e
  quem está atrasado.
- **Quem usa:** hunter (dados próprios, via RLS).
- **Dados exibidos:**
  - H1 "Envios de hoje" e o subtítulo "Fila do dia DD/MM/AAAA — atrasados aparecem em vermelho no
    topo."
  - Seletor de data (input date) e botão **"Hoje"**.
  - Uma **aba por etapa de `STEPS`** (LinkedIn 1, WhatsApp 1, LinkedIn 2, WhatsApp 2, LinkedIn 3),
    com um contador pill de itens ("…" enquanto os contatos carregam).
  - A fila (`buildQueues` em `fila.ts`) inclui os contatos ativos (sem AT, sem "respondeu" ou
    "descartado") com a etapa pendente e prevista até a data. **LinkedIn 1 sem `step1_date` entra
    sempre, sem previsão**, por isso essa fila pode ser enorme. Ordem: atrasados primeiro, depois
    por data prevista.
  - **Cartão (`QueueCard`)**, em uma linha flex que quebra:
    - Nome (semibold); pill vermelha "Atrasado — previsto DD/MM/AAAA" se atrasado.
    - Avisos amarelos (`Warn`): "sem empresa"; na etapa 1, "sem área" e "sem cargo".
    - `FunnelBadge`, se o contato já está no funil.
    - A linha "Empresa · headline", ou "Sem cargo".
    - Pill `bg-accent` com o **nome do setor** da empresa vinculada (só se o contato tem
      `company_id`).
    - `ChannelBadge` da etapa; ao lado, em mono 11px, o **código do modelo usado** (ou "setor" /
      "padrão" se não houver código), com o tooltip "Mensagem da cadência do setor" ou "Modelo padrão
      da equipe"; depois "Previsto DD/MM/AAAA" ou "Sem data de LinkedIn 1".
    - Botões: **"Copiar mensagem"** (outline); **"Abrir WhatsApp"** (outline, só nas etapas de
      WhatsApp e com telefone de pelo menos 10 dígitos, senão o aviso "sem telefone");
      **"Marcar como enviado"** (primário); **"Avançar no funil"** (`FunnelControl`).
    - Linha inferior (`LeadFields`), sempre visível: input **Nome** (salva no blur); se o hunter
      tem empresas cadastradas, o `CompanySelect` **"Vincular empresa…"** (borda amarela sem
      vínculo); sem vínculo, o nome da empresa em texto e o `CompanyGenderToggle`. Na etapa 1
      também aparecem `SectorSelect` (placeholder "Área") e o input **"Cargo na empresa"** (com
      borda amarela se vazios) e, abaixo, a headline truncada.
    - `CompanyFix` (form amarelo "Preencha a empresa deste lead", com input Empresa, toggle de
      artigo e **"Salvar empresa"**) aparece quando o hunter tenta copiar ou abrir o WhatsApp sem
      empresa.
- **Ações:**
  | Ação                                      | Efeito                                                                                                                                                                                                                                                             | Feedback                                                                                                                                                                       |
  | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Copiar mensagem                           | Renderiza o modelo da etapa (o do setor da empresa ou o padrão, via `pickTemplate`) com os dados do lead e do hunter e copia. Bloqueia se falta a empresa; na etapa 1, se falta a área (só quando o modelo usa [DOR_DO_SETOR]) ou o cargo (só quando usa [CARGO]). | Toast "Mensagem copiada", "Preencha a empresa deste lead", "Preencha a área e o cargo deste lead antes de copiar", "Modelo ainda não carregado." ou "Não foi possível copiar". |
  | Abrir WhatsApp                            | O mesmo texto, abrindo `wa.me` em nova aba.                                                                                                                                                                                                                        | Idem.                                                                                                                                                                          |
  | Marcar como enviado                       | Grava `sentN_at` = data da tela (e `step1_date`, se vazio) e recalcula a situação. O cartão sai da fila.                                                                                                                                                           | Toast "{Etapa} registrada para {nome}".                                                                                                                                        |
  | Avançar no funil                          | Popover com data e "Marcar {próxima etapa}", ou "Desfazer {etapa}" (confirmação `useConfirm` "Desfazer {etapa}?", ação "Desfazer", sem o aviso de irreversível).                                                                                                   | Toast "Funil atualizado".                                                                                                                                                      |
  | Editar nome, empresa, área, cargo, artigo | Update imediato (blur ou change).                                                                                                                                                                                                                                  | Só erro em toast.                                                                                                                                                              |
  | Trocar data / "Hoje"                      | Recalcula as filas para a data.                                                                                                                                                                                                                                    | —                                                                                                                                                                              |
- **Estados:**
  - Fila vazia: card com o texto "Nada na fila de {Etapa} para esta data."
  - Lista longa: **50 cartões por vez** (`QueueList`, `BATCH = 50`), com o rodapé "Mostrando X de
    Y" e o botão **"Mostrar mais N"**.
  - Carregando: card "Carregando a fila…" (`QueueMessage`) no lugar da fila e "…" nos contadores.
  - Erro de leitura dos contatos: card "Não foi possível carregar os contatos. Recarregue a página
    para tentar de novo.". Erros de mutation aparecem em toast.
  - Variações: atrasado (borda e fundo `destructive`); contato no funil (badge colorido); etapa
    WhatsApp com ou sem telefone; etapa 1 com campos extras.
- **Dados:** `contacts` (todos os do hunter, via `fetchAll`), `settings`, `holidays`,
  `message_templates`, `profiles` (nome e gênero do hunter), `companies`, `sectors` e
  `sector_templates`; update em `contacts`.
- **Componentes:** `src/components/hoje/QueueList.tsx` (`QueueList`, `QueueMessage`), `QueueCard.tsx`, `LeadFields.tsx`,
  `CompanyFix.tsx`, `useQueueActions.ts`; `Funnel.tsx`, `StatusBadge.tsx` (`ChannelBadge`),
  `CompanyGender.tsx`, `SectorSelect.tsx`, `CompanySelect.tsx`; ui: `tabs`, `input`, `button`.
- **Observações de UX:**
  - O cartão é muito denso: até 4 botões, 3 a 5 inputs e vários badges numa linha que quebra de
    forma imprevisível. No celular cada lead ocupa **cerca de uma tela inteira**: os 5 campos de
    edição da etapa 1 (Nome, "Vincular empresa…", artigo, Área e Cargo) ficam sempre abertos, com
    inputs de largura fixa (`w-52`, `w-56`, `w-48`), e os botões "Copiar mensagem" / **"Marcar como
    enviado"** / "Avançar no funil" ficam no meio do cartão, entre os dados do lead e esses campos.
  - O nome aparece duas vezes (título e input "Nome").
  - Não há indicação do total geral (soma das filas) nem do progresso do dia.
  - Os campos editáveis do lead ficam sempre abertos, mesmo quando completos.
  - Com empresa vinculada, o cartão ganha mais duas peças (pill do setor e código do modelo), o
    que aumenta a densidade. O código do modelo é um texto mono pequeno cujo significado só aparece
    no tooltip.
  - "Setor" (da empresa, na pill) e "Área" (do contato, no select) convivem no mesmo cartão com
    nomes parecidos.

### 2.4 `/empresas` — Empresas (`src/routes/_authenticated/empresas.tsx`)

- **Objetivo:** cadastrar as empresas que o hunter vai prospectar na semana e o setor (ramo) de cada
  uma. O setor define a cadência de mensagens que os contatos vinculados recebem em Envios de hoje.
- **Quem usa:** hunter (dados próprios, RLS por hunter em `companies`).
- **Dados exibidos** (`max-w-5xl`):
  - H1 "Empresas" e o texto "Cadastre as empresas que você prospecta na semana e escolha o setor de
    cada uma. Os contatos vinculados a uma empresa recebem a cadência de mensagens do setor em
    Envios de hoje."
  - **Card "Cadastrar empresas"** (`CompanyForm`), em duas colunas a partir de `md`:
    - Textarea **"Empresas (uma por linha)"** (5 linhas, placeholder "Ambev / Natura / Grupo
      Boticário"). Abaixo, ao digitar: "{N} novas · {M} já cadastradas" (compara com as empresas do
      hunter sem diferenciar acento, maiúsculas e espaços, via `normalizeCompany`).
    - **Setor** (`IndustrySelect`, placeholder "Setor da empresa…", borda amarela enquanto vazio;
      lista só setores ativos).
    - **Concordância** (`CompanyGenderToggle`, padrão "na").
    - **Semana de prospecção** (date, hoje por padrão) e, abaixo, o intervalo segunda a domingo
      ("DD/MM/AAAA a DD/MM/AAAA") calculado por `weekStartISO`/`weekEndISO`.
    - Botão **"Cadastrar"** (primário, largura total da coluna; desabilitado sem setor, sem empresa
      nova ou durante o envio).
  - **Lista** (`CompanyList`), agrupada por semana (mais recente primeiro): título "Semana de
    DD/MM/AAAA a DD/MM/AAAA · {N} empresa(s)" (singular com 1) e uma caixa com uma linha por empresa (ordem
    alfabética):
    - `InlineInput` com o nome (salva no blur ou Enter);
    - `CompanyGenderToggle`;
    - `IndustrySelect` (`h-7 w-52`; um setor desativado depois de escolhido aparece como
      "{nome} (inativo)");
    - pill cinza **"cadência do setor incompleta"** (tooltip "Etapas sem mensagem própria do setor
      usam o modelo padrão") quando falta mensagem do setor em alguma etapa (`missingSteps`);
    - contagem de contatos vinculados: "{N} contato(s)" em texto, ou a pill amarela **"sem
      contatos"**;
    - **"Excluir"** (ghost vermelho, à direita).
- **Ações:**
  | Ação                | Efeito                                                                                                                                                                                                                  | Feedback                                                                                                                            |
  | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | Cadastrar           | Insere as empresas novas (as repetidas são ignoradas) com o mesmo setor, concordância e semana (`week_start` = segunda-feira). Limpa o texto.                                                                           | Toast "Empresa cadastrada" / "{N} empresas cadastradas"; erros "Escolha o setor da empresa", "Nenhuma empresa nova para cadastrar". |
  | Renomear            | Update do nome; um trigger atualiza `company` nos contatos vinculados.                                                                                                                                                  | Toast "Empresa renomeada".                                                                                                          |
  | Trocar concordância | Update do `gender` (propaga aos contatos vinculados).                                                                                                                                                                   | Só erro em toast.                                                                                                                   |
  | Trocar setor        | Update do `sector_id`: os contatos vinculados passam a receber a cadência do novo setor.                                                                                                                                | Toast "Setor atualizado".                                                                                                           |
  | Excluir             | `useConfirm` **sem palavra**: "Excluir {nome}?" e, com contatos, "Os {N} contatos vinculados continuam cadastrados, mas sem empresa vinculada (voltam ao modelo padrão)."; sem contatos, "A empresa sai da sua lista.". | Erro em toast (tratado pelo `ConfirmDialog`).                                                                                       |
- **Estados:**
  - Sem nenhum setor ativo: o card mostra só "Nenhum setor cadastrado ainda. Peça ao administrador
    para criar os setores no Painel Admin." (sem formulário).
  - Sem empresas: "Nenhuma empresa cadastrada ainda. Cadastre as empresas que você vai prospectar
    nesta semana."
  - Carregando: o card de cadastro mostra "Carregando os setores…" enquanto os setores carregam;
    a lista de empresas não tem estado próprio (mostra a mensagem de lista vazia até chegar).
  - Erro de leitura: sem UI. Sem paginação (a lista mostra todas as semanas).
- **Dados:** `companies` (leitura, insert, update e delete, via `useCompanies`, `useAddCompanies`,
  `useUpdateCompany`, `useDeleteCompany`), `sectors`, `sector_templates` e `contacts` (para contar
  os vinculados).
- **Componentes:** `src/components/empresas/CompanyForm.tsx`, `CompanyList.tsx`;
  `IndustrySelect.tsx`, `CompanyGender.tsx`, `InlineInput.tsx`; `useConfirm`
  (`src/components/useConfirm.tsx`); ui: `card`, `textarea`, `input`,
  `label`, `button`, `native-select`.
- **Observações de UX:**
  - A semana é escolhida por um date de um dia qualquer; o intervalo real só aparece no texto
    abaixo.
  - Cada linha da lista é uma faixa de inputs (`flex-wrap`), que no celular quebra em várias linhas
    sem alinhamento.
  - "Excluir" fica na mesma linha dos campos de edição, só separado por `ml-auto`.
  - O hunter não vê aqui quais contatos estão vinculados a cada empresa (só a contagem); o vínculo é
    feito em Contatos, Envios de hoje ou Importar.

### 2.5 `/contatos` — Contatos (`src/routes/_authenticated/contatos.tsx`)

- **Objetivo:** ver e editar todos os contatos do hunter. É a "planilha" da cadência.
- **Quem usa:** hunter.
- **Dados exibidos:**
  - Toolbar (`ContactsToolbar`): H1 "Contatos" e "{N} contatos · edite empresa, telefone e datas
    direto na tabela."
  - Tabela (`ContactsTable` e `ContactRow`, `table-dense`, `overflow-x-auto`), com **colunas = 8
    fixas + uma por `STEPS` + Situação + Funil**:
    | Coluna                  | Conteúdo / edição                                                                                                                                         |
    | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | ☐                       | checkbox de seleção. O do cabeçalho seleciona **todos do filtro**, não só a página.                                                                       |
    | Nome                    | `InlineInput` (salva no blur ou Enter; não aceita vazio)                                                                                                  |
    | Cargo/Headline          | headline (texto, truncado em 260px)                                                                                                                       |
    | Cargo na empresa        | `InlineInput` + headline repetida abaixo (11px)                                                                                                           |
    | Área                    | `SectorSelect` (área do contato; antes a coluna se chamava "Setor")                                                                                       |
    | Empresa                 | `CompanySelect` ("Texto livre (sem cadastro)" + empresas do hunter; só aparece se ele tem empresas) e, sem vínculo, `InlineInput` + `CompanyGenderToggle` |
    | Telefone/WhatsApp       | `InlineInput` (placeholder "(11) 90000-0000")                                                                                                             |
    | Conexão                 | data da conexão (texto)                                                                                                                                   |
    | LinkedIn 1              | input date (`step1_date`) + botão **"Enviei hoje"** + checkbox "Enviado"                                                                                  |
    | WhatsApp 1 … LinkedIn 3 | data prevista (riscada se enviada) + checkbox "Enviado" (marca hoje ou limpa)                                                                             |
    | Situação                | se o contato está no funil, mostra `FunnelBadge`; senão um `Select` com `StatusBadge` e as 5 situações                                                    |
    | Funil                   | `FunnelControl` ("Avançar no funil")                                                                                                                      |
  - A edição de etapas recalcula a situação (`withSyncedStatus`).
- **Ações:**
  - Busca **"Buscar por nome ou empresa"** (sem acento, deferred), o select de situação **"Todas
    as situações"** mais as 5 situações (compara a situação calculada, `computedStatus`, a mesma do
    selo) e o filtro de pendências (`NativeSelect`): **"Com ou sem
    pendência"**, **"Sem empresa"** (sem vínculo e sem texto) e **"Sem área"**. Os três voltam para
    a página 1.
  - **"Preencher empresa e área (N)"** (`AutoFillButton`, outline, na toolbar): calcula com
    `autoFillPatch` quantos contatos dá para completar a partir do headline (desabilitado com o
    tooltip "Nada para preencher automaticamente" se N = 0). Abre um AlertDialog "Preencher empresa
    e área automaticamente" com o resumo ("X vinculados a empresas cadastradas; Y com a empresa
    tirada do headline; Z com a área pelo cargo"), a nota de que só campos vazios mudam e a dica de
    usar o filtro de pendências. Botões **"Cancelar"** e **"Preencher"** ("Preenchendo…"). Toast
    "{N} contatos completados".
  - Link **"Abrir planilha"** (Google Sheets externo), com a nota "atualiza automaticamente, com
    atraso de até 1 hora".
  - **"Exportar CSV"**: baixa `contatos-AAAA-MM-DD.csv` do filtro atual, com colunas derivadas de
    `STEPS` (prevista/enviada).
  - Barra de lote (`BulkActions`, só com seleção > 0): "{N} selecionados",
    **"Enviei LinkedIn 1 hoje para os selecionados"** (toast "LinkedIn 1 registrada para N
    contatos"), **"Marcar como descartado"** (confirmação `useConfirm` "Descartar N contatos?", ação
    "Descartar", sem o aviso de irreversível: "Dá para voltar a situação de cada um na tabela.";
    toast "N contatos descartados") e
    **"Limpar seleção"**.
  - Edição inline de todas as colunas editáveis. Nenhuma tem toast de sucesso; só erro.
  - O hunter **não pode excluir** contatos (sem DELETE no RLS).
- **Estados:**
  - Carregando: linha "Carregando..."
  - Vazio: linha "Nenhum contato. Use a tela “Importar conexões”." (a mesma mensagem quando o
    filtro não encontra nada).
  - Paginação: **50 por página** (`paginate` + `TablePagination`), com "X–Y de N contatos",
    "Anterior", "Página P de T" e "Próxima". Escondida se houver uma página só.
  - Variações por linha: no funil (badge no lugar do select); etapas enviadas (data riscada).
- **Dados:** `contacts`, `settings`, `holidays` e `companies`; update em `contacts` (individual e
  em lote, inclusive o preenchimento automático via `useBulkPatchContacts`).
- **Componentes:** `src/components/contatos/ContactsToolbar.tsx`, `ContactsTable.tsx`,
  `ContactRow.tsx`, `BulkActions.tsx`, `AutoFillButton.tsx`; `TablePagination.tsx`,
  `InlineInput.tsx`, `SectorSelect.tsx`, `CompanySelect.tsx`, `CompanyGender.tsx`,
  `StatusBadge.tsx`, `Funnel.tsx`, `useConfirm.tsx`; ui: `table`, `checkbox`, `select`,
  `native-select`, `alert-dialog`, `input`, `button`.
- **Observações de UX:**
  - São 15 colunas, quase todas com inputs. Exige scroll horizontal mesmo em desktop largo e é
    inviável no mobile.
  - A headline aparece duas vezes (coluna própria e abaixo de "Cargo na empresa").
  - O vazio por filtro usa a mesma mensagem do vazio total.
  - Nada mostra que um campo foi salvo (salva no blur, em silêncio).
  - A toolbar ficou mais cheia (busca, dois filtros de tipos diferentes — `Select` do shadcn e
    `NativeSelect` —, "Preencher empresa e área", planilha e CSV).
  - Na coluna Empresa, o select de vínculo e o texto livre se alternam na mesma célula; com vínculo
    o nome só aparece dentro do select.

### 2.6 `/importar` — Importar conexões (`src/routes/_authenticated/importar.tsx`)

- **Objetivo:** criar contatos colando o texto da página de conexões do LinkedIn.
- **Quem usa:** hunter.
- **Dados exibidos:**
  - H1 "Importar conexões" e a instrução "Copie a página de conexões do LinkedIn (Ctrl+A, Ctrl+C) e
    cole abaixo. Empresa e área são sugeridas pelo headline; o que não der para descobrir fica em
    branco."
  - Card "Texto copiado do LinkedIn" (`PasteCard`): textarea monoespaçada de 12 linhas, com um placeholder de
    exemplo.
  - Filtro **"Importar apenas conexões feitas a partir de"** (date) e o botão ghost **"Sem filtro de
    data"**.
  - Card de pré-visualização (`ImportPreview`, só se houver linhas detectadas): "Pré-visualização — {N} detectados,
    {M} novos". Tabela com Nome, Cargo/Headline, Conexão, **Empresa**, **Área** e Situação (pill): **"Novo"** (verde
    `whatsapp`), **"Já cadastrado"** (cinza), **"Antes da data escolhida"** ou **"Sem data — fora
    do filtro"** (amarelo).
  - Colunas novas (só nas linhas que serão importadas): **Empresa** = `CompanySelect` com as
    empresas do hunter ("Sem empresa cadastrada"; só aparece se ele tem empresas), pré-escolhido com
    a empresa cadastrada citada no headline (`suggestCompany`); sem vínculo, abaixo, o nome tirado do
    headline em texto ("{empresa} (do headline)") ou "—". **Área** = área sugerida pelo cargo
    (`areaFromTitle`), em texto, ou "—".
- **Ações:** **"Importar novos contatos"** (desabilitado se não houver novos ou durante o envio).
  Insere os contatos (o `job_title` é derivado da headline; `company_id` = empresa escolhida na
  linha; sem vínculo, o nome e a concordância tirados do headline; `sector` = área sugerida), mostra
  o toast "{N} contatos importados", limpa o texto e **navega para `/contatos`**. O hunter pode
  trocar a empresa de cada linha antes de importar; a área não é editável aqui.
- **Estados:** texto vazio ou sem nada reconhecido: o card de pré-visualização não aparece (não há
  mensagem explicando que nada foi reconhecido). Sem estado de "importando" além do botão
  desabilitado. Erro em toast. A pré-visualização **não pagina** (renderiza todas as linhas).
- **Dados:** `contacts` (para checar duplicados por nome e headline), `companies`; insert em
  `contacts` (`useImportContacts`). As linhas da prévia (novo, duplicado, fora do filtro, empresa
  sugerida, área) e o payload de cada contato vêm de regras puras em `src/lib/importar.ts`
  (`buildImportRows`, `importable`, `importPayload`, com testes em `importar.test.ts`); o parser é
  `parseLinkedInConnections` (`cadencia.ts`).
- **Componentes:** `src/components/importar/PasteCard.tsx` (textarea e filtro de data),
  `ImportPreview.tsx` (tabela, `RowStatus` e botão de importar); `CompanySelect.tsx`; ui: `card`,
  `textarea`, `input`, `label`, `button`, `table`.
- **Observações de UX:** o botão principal fica no header do card de pré-visualização, longe do
  textarea. Não há feedback quando o parser não reconhece nada. Uma colagem grande gera uma tabela
  sem paginação, agora com um select por linha. A tabela ficou com 6 colunas e não cabe no
  celular.

### 2.7 `/modelos` — Modelos (`src/routes/_authenticated/modelos.tsx`)

- **Objetivo:** mostrar os modelos de mensagem (o padrão da equipe ou a cadência de um setor) e
  como ficam preenchidos.
- **Quem usa:** hunter. É só leitura; o modelo padrão é editado por SQL e as cadências de setor na
  aba "Setores e cadências" do painel.
- **Dados exibidos:** H1 "Modelos" e um parágrafo que explica que contatos de empresas cadastradas
  recebem a primeira mensagem que existir na ordem subsetor e persona, subsetor, setor e persona,
  setor, modelo padrão da equipe, com as variáveis ([FIRST NAME], [EMPRESA],
  [CARGO], [DOR_DO_SETOR], [NOME], [CONSULTOR], [OBRIGADO], [JANELA], [SAUDACAO]) e o contato de
  exemplo (Mariana Souza · Gerente de Operações · Acme Indústria, setor Operações). Um Card por
  `STEPS`: `ChannelBadge` + `code` (mono). Em duas colunas (a partir de `md`): **Modelo** (texto
  cru) e **Pré-visualização** (renderizada com o nome e gênero do hunter). Com um setor escolhido,
  o cartão mostra a origem da mensagem ao lado do código (ex.: "Indústria › Metalurgia · qualquer
  persona"), ou "sem mensagem do setor: usa o modelo padrão" quando cai no padrão. Cada aba de etapa
  tem um selo de nível: "própria do subsetor", "do setor" ou "padrão".
- **Ações:** três `NativeSelect` (`w-60`), cada um com rótulo visível. **Setor**: "Modelo padrão da
  equipe" + setores ativos de primeiro nível (trocar o setor zera o subsetor). **Subsetor**: "Sem
  subsetor" + subsetores ativos do setor; desabilitado sem setor ou sem subsetores ativos.
  **Persona**: "Qualquer persona" + as 4 de `PERSONAS`; desabilitada sem setor. Fora isso, nada
  (nem copiar).
- **Estados:** carregando: "Carregando..." no corpo do modelo e pré-visualização vazia. Sem estado
  de erro.
- **Dados:** `message_templates`, `profiles`, `sectors` (árvore), `sector_templates` (via `resolveTemplate`).
- **Componentes:** `StatusBadge.tsx` (`ChannelBadge`); ui: `card`, `native-select`.
- **Observações de UX:** a lista de variáveis fica num parágrafo corrido, sem destaque das tags no
  modelo (e não cita as tags [NA_EMPRESA], [A_EMPRESA], [DA_EMPRESA], que o editor de setores
  lista). O hunter não vê qual cadência os contatos dele recebem; precisa escolher o setor à mão. A pré-visualização usa o exemplo fixo; não dá para testar com um contato real.

### 2.8 `/configuracoes` — Configurações (`src/routes/_authenticated/configuracoes.tsx`)

- **Objetivo:** preferências do hunter e área de administração protegida por senha.
- **Quem usa:** hunter (os 4 primeiros cards) e quem tem a senha de admin (último card).
- **Dados e ações:** H1 "Configurações" e "Seus nomes e intervalos da cadência."; cards empilhados
  (`max-w-2xl`):
  | Card                                                                                             | Campo                                                                    | Ação                                                                                  | Feedback                   |
  | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------- |
  | Nome na plataforma ("Exibido nos relatórios da equipe.")                                         | input                                                                    | **"Salvar"** (desabilitado se vazio)                                                  | "Nome salvo"               |
  | Nome nas mensagens ("Assinatura nas mensagens ([NOME]...). Se vazio, usa o nome da plataforma.") | input                                                                    | **"Salvar"**                                                                          | "Nome das mensagens salvo" |
  | Gênero para as mensagens ([CONSULTOR], [OBRIGADO])                                               | Select Masculino / Feminino                                              | salva ao mudar                                                                        | "Gênero salvo"             |
  | Intervalos da cadência (dias úteis)                                                              | uma linha por `STEPS`: `ChannelBadge`, "D+", input number e "dias úteis" | **"Salvar"**, **"Restaurar padrão"** (só restaura o formulário; ainda precisa salvar) | "Intervalos salvos"        |
  | Área do administrador                                                                            | ver `AdminArea` abaixo                                                   |                                                                                       |                            |
- **Estados:** sem loading explícito (os inputs ficam vazios ou com o padrão até carregar). Erros
  em toast.
- **Dados:** `profiles`, `settings` (upsert), mais as server fns da `AdminArea`.
- **Componentes:** um por card em `src/components/configuracoes/`: `NameCard.tsx` (usado duas
  vezes, nome na plataforma e nome nas mensagens), `GenderCard.tsx`, `IntervalsCard.tsx`,
  `AdminArea.tsx` (e dentro dela `HolidaysAdmin.tsx`); `StatusBadge.tsx` (`ChannelBadge`); ui:
  `card`, `input`, `label`, `button`, `select`, `radio-group`.
- **Observações de UX:** são três botões "Salvar" diferentes na mesma página. "Restaurar padrão" não
  avisa que falta salvar. A Área do administrador fica visível a todos os hunters (card tracejado).

#### AdminArea (`src/components/configuracoes/AdminArea.tsx`), só em `/configuracoes`

- Card `border-dashed`: "Área do administrador" e "Exclusão de contatos e feriados."
- **Estados de acesso:**
  1. `ADMIN_PASSWORD` não configurada: "Senha de administrador ainda não configurada".
  2. Bloqueado: input password "Senha de administrador" e **"Entrar"** (outline). Falhas em toast:
     "Senha incorreta. Restam N tentativas." ou "Muitas tentativas erradas. Tente novamente após
     HH:MM."
  3. Desbloqueado: as duas seções abaixo e **"Sair da área do administrador"**.
- **Excluir contatos (destrutivo):** RadioGroup "Apenas meus contatos (N)" / "Contatos de TODOS os
  hunters (N)" e o botão **"Excluir contatos"** (destructive). Confirmação **inline** (não usa
  `useConfirm`): "{N} contatos ... serão excluídos permanentemente.", com **"Confirmar exclusão"** e
  **"Cancelar"**. Toast "{N} contatos excluídos".
- **Feriados:** `HolidaysAdmin` (abaixo).
- Uma senha errada em qualquer ação **bloqueia de novo** a área.
- O período da competição **não fica mais aqui**: só se edita no painel, aba Competição.
- **Dados:** `adminStatus`, `adminVerify` e `adminDeleteContacts` (`src/lib/admin.functions.ts`).

#### HolidaysAdmin (`src/components/configuracoes/HolidaysAdmin.tsx`), só dentro da AdminArea

- "Feriados" e a nota "Feriados não contam como dia útil na cadência. Inclua emendas, recessos e
  anos futuros."
- Formulário: **Data** (date), **Nome** e **"Adicionar"** (toast "Feriado salvo").
- Lista agrupada por ano (cabeçalho do ano e `ul` com borda): "DD/MM/AAAA — Nome" e um botão
  ícone **X** ("Remover {nome}"), com confirmação `useConfirm` "Remover o feriado {nome}?" ("{data}
  volta a contar como dia útil e as datas previstas da cadência são recalculadas.", ação "Remover",
  sem o aviso de irreversível). Toast "Feriado removido".
- Vazio: nada (só o formulário).
- **Dados:** `holidays` (leitura), `adminAddHoliday` e `adminRemoveHoliday` (com senha).

### 2.9 `/painel` — Painel do administrador (`src/routes/_authenticated/painel.tsx`)

- **Objetivo:** gestão global (indicadores da equipe, todos os hunters e contatos, períodos e
  grupos, setores e cadências, metas, competição e ranking).
- **Quem usa:** admin (`has_role`). Toda escrita e toda leitura de dados de outros hunters passa por
  server functions que validam o papel antes de usar service role. (A aba Setores lê `sectors` e
  `sector_templates` direto do cliente, pois são legíveis por qualquer logado.)
- **Estados da página:** "Carregando…"; não admin: "Acesso restrito ao administrador. Voltar"
  (link para `/hoje`); admin: H1 "Painel do administrador" e Tabs **"Indicadores"** (padrão),
  **"Hunters"**, **"Períodos e grupos"**, **"Setores e cadências"**, **"Competição"**, **"Busca
  geral"**.
- **Aba na URL:** a aba aberta fica em `?aba=` (`indicadores`, `hunters`, `periodos`, `setores`,
  `competicao`, `busca`; trocar de aba faz `navigate` com `replace`). Valor inválido ou ausente
  abre Indicadores. `/ranking` redireciona para `/painel?aba=competicao`.
- **Barra de abas no celular:** o `TabsList` usa `h-auto flex-wrap`, então as 6 abas quebram em
  linhas e todas ficam ao alcance do toque.
- Todas as confirmações destrutivas do painel usam **`useConfirm`** e `ConfirmDialog`
  (`src/components/`), com AlertDialog, botão vermelho, "Essa ação não pode ser desfeita." e,
  opcionalmente, "Digite **PALAVRA** para confirmar".

#### Aba Indicadores (padrão) (`src/components/painel/dashboard/*`)

- **Objetivo:** mostrar ao admin se a cadência está sendo executada, se gera ATs e o que precisa de
  ação hoje (hunters parados, atrasados, empresas sem contato, cadências incompletas).
- **Quem usa:** admin. É a primeira aba do `/painel` e a aberta por padrão.
- **Dados exibidos** (`IndicadoresTab`, de cima para baixo):
  - **Filtros** (`Filters`, card com borda, valem para a página inteira):
    - Linha 1: atalhos de intervalo (`RANGE_LABEL`): **"Hoje"**, **"Ontem"**, **"Esta semana"**
      (padrão), **"Semana passada"**, **"Últimos 30 dias"**, **"Este mês"**, mais **"Período
      inteiro"** (só com período escolhido). O atalho ativo vira o botão `default`. Depois, dois
      inputs date "Início do intervalo" e "Fim do intervalo" ("a" entre eles); mexer neles muda
      para intervalo livre.
    - Linha 2 (`NativeSelect`): **Período** (os períodos, "(ativo)" no ativo; sem opção vazia — o
      servidor escolhe o ativo quando nenhum foi escolhido), **"Todos os grupos"**, **"Todos os
      subgrupos"** (desabilitado sem subgrupos), **"Todos os hunters"** (filtrado pelo grupo),
      **"Todos os setores"** (setor da empresa) e canal **"LinkedIn e WhatsApp"** / "Só LinkedIn" /
      "Só WhatsApp".
    - **Na URL** (`/indicadores?…`, regras em `src/lib/indicadores.ts`): `intervalo`, `de`/`ate`
      (só intervalo livre ou período inteiro), `periodo`, `grupo`, `subgrupo`, `hunter`, `setor`,
      `canal`, e ainda `detalhe` (aba do Detalhamento), `ordem`/`sentido` (Execução) e `aberto`
      (hunter expandido). O valor padrão nunca vai para a URL; atalhos guardam só o nome e valem
      em relação a hoje. Valor inválido é descartado. Filtros e abas trocam a URL com `replace`
      (sem encher o "voltar"); os atalhos de alerta e KPI empilham uma entrada nova.
    - **Resumo e limpeza:** com filtro fora do padrão, uma linha de chips (intervalo, período,
      grupo, subgrupo, hunter, setor, canal) e **"Limpar filtros"** (só os filtros; aba, ordenação
      e hunter aberto ficam). Ao rolar além do cartão, uma barra compacta fixa no topo
      (`role="region"`, "Filtros ativos") repete os chips, com **"Editar filtros"** (volta ao
      topo e foca o atalho de intervalo) e **"Limpar filtros"**.
  - Linha de contexto: "DD/MM/AAAA a DD/MM/AAAA · comparado com DD/MM/AAAA a DD/MM/AAAA" (o
    intervalo anterior de mesmo tamanho).
  - Os blocos abaixo aparecem nesta ordem; cada um é um `Section` (Card com título e uma frase de
    explicação):
    1. **KPIs** (`Kpis`, **10 cartões** num grid de 2 / 5 colunas): **ATs marcadas** (em destaque),
       **Respostas**, **Mensagens enviadas**, **LinkedIn**, **WhatsApp** — cada um com a variação
       em % (seta para cima/baixo) e "antes: N"; **Conversão LinkedIn 1 → AT** ("{ATs} ATs ÷ {N}
       LinkedIn 1 · antes X%"); **Importados · empresas** ("N · M", "antes ..."); **Envios
       atrasados agora** e **Hunters parados (2+ dias úteis)** (em vermelho quando > 0); **Tempo
       até a resposta** ("N d úteis" ou "—", com "média desde o LinkedIn 1 · N respostas").
       **ATs marcadas** mostra também a meta da equipe ("meta 1,6 · 63%" + ícone e rótulo do
       semáforo, o mesmo de Metas), só com meta de ATs e dia útil no intervalo. **Envios atrasados
       agora** e **Hunters parados** (valor > 0) têm o link **"Ver por hunter"**, que abre a
       Execução ordenada por Atrasados / Último envio (`#execucao`).
    2. **Alertas ({N})** ("O que precisa de ação hoje."): lista com ícone e etiqueta **Alta**
       (vermelho) ou **Média** (âmbar), mais urgentes primeiro: hunter "nunca registrou um envio"
       ou "sem envio há N dias úteis" (com contatos na fila), "N contatos atrasados há mais de 5
       dias úteis", "N WhatsApps previstos sem telefone cadastrado", "abaixo da meta de
       mensagens|ATs: real de meta (N%)" (só com 3+ dias úteis no intervalo), "empresa X (semana de
       DD/MM/AAAA) sem nenhum contato" e "setor X: cadência sem mensagem própria para {etapas} (usa
       o modelo padrão)". Até 5 tipos por hunter, mais um por empresa e por setor: a lista não tem
       limite. O nome do hunter é um link para a Execução com ele expandido (`aberto`, `#execucao`);
       nome repetido ou alerta de setor ficam como texto. **Alertas e Metas** ocupam a largura
       toda, um abaixo do outro.
    3. **Abastecimento e qualidade dos dados** (ao lado dos alertas em `xl`): 6 mini-cartões —
       Aguardando início, Empresas da semana com contato ("N de M"), Contatos por empresa, WhatsApp
       sem telefone, Sem empresa, Sem área; os problemáticos em vermelho; a explicação de cada um
       fica só no tooltip.
    4. **Metas** (`Metas`): ver "Metas" abaixo.
    5. **Execução da cadência por hunter** (`Execucao`, `<table>` crua, `overflow-x-auto`): Hunter
       (com grupo · subgrupo abaixo), uma coluna por `STEPS`, Total, No prazo (% e "x/y"),
       Atrasados (com as faixas "1–2 / 3–5 / mais de 5" dias úteis), Último envio ("DD/MM" e
       "hoje" / "há N d úteis" / "nunca enviou", vermelho a partir de 2), Iniciadas, Em cadência,
       Aguardando, **Respostas**, ATs, Conversão e Descarte (17 colunas com 5 etapas). Cabeçalhos
       clicáveis ordenam (↑/↓, `aria-sort`; padrão: Total decrescente; ordenação e hunter aberto ficam
       na URL e sobrevivem à troca de aba). Clicar no hunter (chevron) expande a
       lista de atrasados (outra `<table>`): Contato, Empresa, Etapa, Prevista, Atraso (até 100,
       "mostrando os N mais antigos"). Nota de rodapé explica as faixas.
    6. **Envios por dia** (ou **por semana**, se o intervalo passa de 31 dias) (`Heatmap`): mapa de
       calor hunter × dia, células com o número e cor `chart-1` proporcional; fins de semana
       esmaecidos.
    7. **Ritmo entre etapas** (`Ritmo`, ao lado do heatmap em `xl`): Passagem ("LinkedIn 1 →
       WhatsApp 1"...), Real, Configurado e Envios, em dias úteis; o real fica vermelho se passa do
       configurado em mais de 1 dia.
    8. **Funil no intervalo** (`Funil`, barras horizontais `BarList`): uma barra por `FUNNEL`, com a
       passagem em % sobre a etapa anterior.
    9. **Etapa que gerou a resposta** (`OrigemResposta`, barras): última mensagem enviada antes da
       resposta ("Antes do LinkedIn 1" + uma barra por `STEPS`), com % do total. A explicação diz
       o tempo médio até a resposta e quantas respostas antigas, sem data, ficam fora.
    10. **Etapa que gerou a AT** (`OrigemAt`, barras): última mensagem enviada antes do registro da
        AT, com % do total. (Os blocos 8, 9 e 10 ficam lado a lado em `lg`.)
    11. **Conversão por setor da empresa** e **Conversão por área do contato** (`ConversaoPor`, lado
        a lado em `lg`): tabelas Setor/Área, LinkedIn 1, ATs, Conversão.
    12. **Tendência das últimas 12 semanas** (`Tendencia`): 5 mini-gráficos `recharts` via
        `ui/chart`, todos em `chart-1` (barras: Mensagens enviadas, ATs marcadas, Respostas,
        Contatos importados; linha: Conversão LinkedIn 1 → AT (%)), com tooltip; grid de 1 / 2 / 5
        colunas.
    13. **Coortes de LinkedIn 1** (`Coortes`): Semana, LinkedIn 1, **Resposta em 14 dias**, AT em 14
        dias, AT em 28 dias (% e número; "parcial" em cinza quando a coorte ainda não completou o
        prazo).
- **Respostas:** a data da resposta é `contacts.respondeu_em`, carimbada por trigger quando a
  situação passa a "respondeu" (apagada se o contato volta a aguardando, em cadência ou concluído;
  mantida se for descartado depois). Sem essa data, vale o registro da AT (`responseDate` em
  `dashboard.ts`). Respostas marcadas antes da coluna existir ficam sem data e fora das contas
  (`undatedResponses`). "Tempo até a resposta" é a média em dias úteis entre o LinkedIn 1 e a
  resposta.

**Metas** (`src/components/painel/dashboard/Metas.tsx`, `GoalsDialog.tsx`)

- **Dados:** tabela `goals` (uma linha por escopo: sem `user_id` e `group_id` = padrão da equipe;
  `group_id` = meta do grupo; `user_id` = exceção do hunter), lida e escrita só com service role
  (`painelDashboard`, `painelSaveGoal`, `painelDeleteGoal`, `has_role` antes). Quatro metas:
  mensagens por dia útil (`envios_dia`), LinkedIn 1 por semana (`l1_semana`), ATs por semana
  (`ats_semana`, aceita decimal) e % mínimo no prazo (`no_prazo_pct`, 0–100). Cada campo herda
  separadamente: hunter → grupo (do período escolhido no filtro) → equipe (`resolveGoal`).
- **Cálculo** (`computeDashboard`): metas diárias e semanais viram metas do intervalo pelos dias
  úteis já passados até hoje (semanal ÷ 5 × dias). A meta de mensagens não se aplica com filtro de
  canal. **Semáforo:** "Na meta" (ícone verde `success`) com 100% ou mais; "Perto" (âmbar
  `warning`) com 70% ou mais; "Abaixo" (vermelho) com menos. Para "No prazo": na meta se atinge o
  mínimo, perto até 10 pontos abaixo. A linha da equipe soma reais e metas dos hunters com meta (no
  prazo: mínimo ponderado pelas etapas devidas).
- **Card "Metas":** a explicação (só com metas) diz "Metas diárias e semanais convertidas para N
  dias úteis do intervalo [(até hoje, intervalo em andamento)]. Na meta = 100% ou mais; perto =
  70% ou mais (no prazo: até 10 pontos abaixo).". Linha de resumo com etiquetas por métrica
  ("Mensagens: **X** de N hunters na meta", e o mesmo para LinkedIn 1, ATs e No prazo) e o botão
  **"Configurar metas"** (outline, à direita).
- Tabela (`<table>` crua): Hunter, Mensagens, LinkedIn 1, ATs, No prazo. Primeira linha
  **"Equipe"** em destaque, depois só os hunters com alguma meta. Cada célula: ícone + "real /
  meta" (com "%" no prazo) + rótulo do semáforo ("Na meta", "Perto", "Abaixo"), ou "—" sem meta. O
  estado nunca depende só da cor.
- **Dialog "Metas"** (`GoalsDialog`, `max-w-3xl`, rola por dentro): descrição "Campo vazio herda do
  nível acima: o hunter herda do grupo, e o grupo da equipe. Os grupos são os do período escolhido
  no filtro.". Um `fieldset` por escopo, cada um com 4 inputs (`inputMode="decimal"`, aceita
  vírgula): **"Mensagens por dia útil"**, **"LinkedIn 1 por semana"**, **"ATs por semana"** e **"%
  no prazo (mínimo)"**. Placeholder: "sem meta" na equipe; nos outros, "herda: N" ou "herda: sem
  meta". Valor inválido (ou % acima de 100) marca o campo (`aria-invalid`) e desabilita salvar.
  - **"Equipe (padrão)"**: só o botão **"Salvar"**.
  - **"Por grupo"** (só se o período tem grupos): um fieldset por grupo, com **"Salvar"** e, se já
    há meta, **"Remover"** (ghost vermelho, **sem confirmação**).
  - **"Exceções por hunter"**: um fieldset por hunter com meta própria ("Salvar" / "Remover") e o
    `NativeSelect` **"Adicionar meta para um hunter…"** (só hunters sem meta), que abre um fieldset
    novo; ao salvar, ele vira uma exceção.
  - Toasts "Meta salva" / "Meta removida"; erro via `errorMessage`. Fecha pelo X ou Esc (não há
    botão "Fechar" nem "Cancelar"); cada fieldset salva sozinho.
- **Estados:** sem metas: "Nenhuma meta definida. Configure a meta da equipe (e, se quiser, de
  grupos e hunters) para ver quem está na meta." (o botão continua visível); intervalo sem dia útil
  até hoje: "O intervalo ainda não tem dias úteis até hoje: as metas aparecem a partir do primeiro
  dia útil.".

- **Ações:** filtros (e "Limpar filtros"), atalhos "Ver por hunter" e nome do hunter nos alertas,
  ordenação da tabela de execução, expansão dos atrasados e o editor de metas
  (única escrita da aba). Não há ações destrutivas além de "Remover" uma meta.
- **Estados:**
  - Primeiro carregamento: "Carregando indicadores…" (os filtros já aparecem).
  - Recarregando após mudar filtro: o conteúdo anterior fica na tela com opacidade 60%
    (`keepPreviousData`).
  - Erro: "Não foi possível carregar os indicadores." em vermelho.
  - Vazios por bloco: "Nenhum hunter no filtro.", "Nenhum envio no intervalo.", "Nenhuma etapa do
    funil registrada no intervalo.", "Nenhuma resposta no intervalo.", "Nenhuma AT no intervalo.",
    "Sem LinkedIn 1 nem ATs no intervalo.", "Nenhum LinkedIn 1 nas últimas 12 semanas.", "Nada
    pendente. 🎉" (alertas) e, na linha expandida, "Nenhum envio atrasado.".
- **Dados:** server fn `painelDashboard` (`painel.functions.ts`, `has_role` antes do service role),
  que lê `profiles`, `periods`, `groups`, `subgroups`, `period_members`, `contacts` (inclusive
  `respondeu_em`), `companies`, `sectors`, `sector_templates`, `settings`, `holidays` e `goals` e
  calcula tudo em `computeDashboard` (`src/lib/dashboard.ts`). O "hoje" vem do navegador (fuso de
  São Paulo, `spParts`). Cache de 60 s. Metas: `painelSaveGoal` e `painelDeleteGoal`.
- **Componentes:** `IndicadoresTab.tsx`, `Filters.tsx`, `Kpis.tsx`, `Metas.tsx`,
  `GoalsDialog.tsx`, `Execucao.tsx` (`Execucao`, `Heatmap`, `Ritmo`), `Funil.tsx` (`Funil`,
  `OrigemResposta`, `OrigemAt`, `ConversaoPor`, `Abastecimento`), `Tendencia.tsx` (`Tendencia`,
  `Coortes`, `Alertas`), `shared.tsx` (`Section`, `BarList`), `format.ts`; ui: `card`, `button`,
  `input`, `native-select`, `dialog`, `chart` (recharts); ícones `lucide-react`.
- **Observações de UX:**
  - É a tela mais longa do app: **13 blocos** empilhados sem hierarquia, índice nem âncoras — 10
    KPIs com o mesmo peso visual (só "ATs marcadas" tem borda de destaque), uma lista de alertas
    que pode passar de 9 itens, metas e várias tabelas largas.
  - A tabela de execução tem 17 colunas (com 5 etapas) e exige scroll horizontal; no celular a
    coluna Hunter quebra o nome em várias linhas.
  - Os filtros ocupam duas linhas com 6 atalhos, 2 datas e 6 selects (a barra compacta fixa os
    mantém à vista ao rolar). Os selects não têm rótulo visível (só `aria-label`).
  - O heatmap usa só `chart-1` e mostra o número dentro da célula; com muitos dias (até 31) fica
    largo e rola na horizontal.
  - Explicações de métricas ficam em tooltips (`title`), inacessíveis no toque.
  - Tabelas `<table>` cruas (sem `ui/table`), com estilos próprios e diferentes entre si
    (`Execucao`, atrasados, `Heatmap`, `Ritmo`, `ConversaoPor`, `Coortes`, `Metas`).
  - Respostas aparecem em cinco lugares (KPI, coluna da execução, "Etapa que gerou a resposta",
    tendência e coortes), sem agrupamento.
  - No editor de metas, "Remover" não pede confirmação; o placeholder "herda: N" é a única
    indicação do valor herdado; cada escopo tem o seu "Salvar" (um diálogo com muitos botões
    iguais).
  - Limites conhecidos (AGENTS.md): `sentN_at` é o dia em que a etapa foi marcada (sem histórico).
    Respostas marcadas antes de `respondeu_em` existir não têm data.

#### Aba Hunters (`src/components/painel/HuntersTab.tsx`, `HunterActions.tsx`, `ContactTable.tsx`)

- **Layout:** grid de 280px + 1fr (`lg`). À esquerda, um Card "Hunters · {total} contatos no total"
  com a lista de botões (nome + total de contatos) e seleção destacada com `bg-accent`.
- **Sem seleção:** "Escolha um hunter para ver os contatos dele."
- **Com hunter selecionado:**
  - Cabeçalho: nome; "{email} · N contatos · N ATs · N descartados"; busca local **"Buscar nome ou
    empresa"**.
  - **"Limpar todos deste hunter"** (destructive; desabilitado se 0): `ask` com a palavra
    **EXCLUIR**. Apaga todos os contatos do hunter.
  - `HunterActions` (caixa com borda):
    - "Transferir todos os contatos para" + NativeSelect "Escolha o hunter…" + **"Transferir"**
      (outline; desabilitado sem destino ou sem contatos). Confirmação com a palavra
      **TRANSFERIR** e o botão de ação "Transferir"; o texto explica que o histórico e a pontuação
      vão para o destino, e que placares encerrados não mudam.
    - **"Excluir hunter"** (ghost vermelho, desabilitado se houver contatos, com o tooltip
      "Transfira ou exclua os contatos antes" e a nota "Para excluir este hunter, transfira ou
      exclua os N contatos dele antes."). Confirmação com a palavra **EXCLUIR**.
  - `ContactTable` (tabela HTML crua, `table-dense`): ☐, Nome, Cargo (headline), Empresa,
    Telefone, Situação (rótulo de `STATUS_LABEL`, sem badge), [Atividade no período, só na busca
    por data], Importado e o botão **"Excluir"** (ghost vermelho), que pede confirmação sem
    palavra. Com seleção, a barra "{N} selecionados" + **"Excluir selecionados"** (confirmação sem
    palavra).
- **Estados:** contatos carregando: "Carregando…"; sem contatos: "Nenhum contato."; lista de
  hunters sem loading nem vazio explícitos (o título mostra "…").
- **Dados:** `painelHunters`, `painelContacts` (`hunterId`, limite de 2000), `painelDelete`,
  `transferContacts`, `deleteHunter`.
- **Observações de UX:** a ContactTable **não pagina** (até 2000 linhas renderizadas). A situação
  aparece como texto, não como `StatusBadge`. A lista de hunters não tem busca. As ações perigosas
  ("Limpar todos", "Excluir hunter") ficam ao lado de ações comuns.

#### Aba Períodos e grupos (`src/components/painel/periodos/*`)

- **Topo:** NativeSelect **"Período"** ("{nome} (ativo|encerrado)"; o padrão é o ativo) e
  **"Novo período"** (outline, desabilitado se há um ativo, com o texto "Encerre "{nome}" para
  criar outro período.").
- **Dialog "Novo período"** (`NewPeriodButton`): Nome (placeholder "Ex.: Hunters 26.2"), Início
  (date, hoje), Tipo (NativeSelect: "Ciclo da equipe (ranking semanal e geral)" ou "Competição
  (estilo Hacka)"), com uma explicação que muda com o tipo e a nota sobre novos cadastros. Botão
  **"Criar período"**, toast "Período criado".
- **PeriodHeader (card):** nome; Badge "Ativo" ou "Encerrado"; Badge "Ciclo" ou "Competição";
  "Início DD/MM/AAAA · [Encerrado em ...] · N membros". Se ativo: **"Conta até"** (date, máximo
  hoje) e **"Encerrar e consolidar"** (destructive). A confirmação exige digitar o **nome do
  período**, com o botão de ação "Encerrar período". Toast "Período encerrado · placar congelado
  para N hunters".
- **Alerta amarelo** (se houver membros sem grupo): "N membros aguardando alocação em grupo" e
  **"Mostrar"** (liga o filtro "Só sem grupo").
- **Grid de 340px + 1fr:**
  - **GroupsCard "Grupos e subgrupos":** vazio: "Nenhum grupo criado neste período."; por grupo: o
    nome, "N membros" e **"Excluir"** (ghost vermelho, confirmação sem palavra: os subgrupos são
    excluídos e os membros vão para "Sem grupo"); os subgrupos aparecem como Badges com **×**
    (confirmação sem palavra); o form "Novo subgrupo (opcional)" tem o botão **"Criar"**. No fim,
    o form "Novo grupo" com **"Criar grupo"**.
  - **MembersCard "Membros do período":** checkbox **"Só sem grupo"**; **"Adicionar membros
    existentes"**; tabela com ☐, Membro, Grupo (ou Badge "Sem grupo"), Subgrupo e Contatos no
    período. Vazio: "Nenhum membro.". Com seleção: `GroupSubgroupSelect` + **"Aplicar"** (toast
    "Alocação salva") e **"Remover do período"** (confirmação sem palavra, ação "Remover").
- **Dialog "Adicionar membros existentes"** (`AddMembersDialog`), em 3 passos numerados:
  "1. Membros de qual período?" (NativeSelect: outros períodos ou "Todos os membros cadastrados");
  "2. Selecione os membros" (busca "Buscar por nome", "Selecionar todos (N)" / "Desmarcar todos",
  e a lista com checkbox, nome e info; vazio: "Ninguém para adicionar (todos já estão neste
  período)."); "3. Alocar em (opcional)" (Grupo/Subgrupo). Botão **"Adicionar N selecionados"**.
- **Estados:** "Carregando…" na aba inteira. Sem nenhum período, só o seletor vazio e "Novo
  período" (não há mensagem de vazio).
- **Dados:** `periodsOverview` (periods, groups, subgroups, period_members, profiles, contacts),
  `createPeriod`, `closePeriod`, `saveGroup`, `saveSubgroup`, `deleteGroupOrSub`, `addMembers`,
  `allocateMembers`, `removeMembers`. Existe `renamePeriod`, mas **nenhuma UI o usa**.
- **Observações de UX:** é uma tela muito completa num espaço pequeno. A tabela de membros não
  pagina nem busca. O período não pode ser renomeado pela UI. "Encerrar e consolidar" fica no mesmo
  card dos dados do período.

#### Aba Setores e cadências (`src/components/painel/setores/*`)

- **Objetivo:** criar os setores (ramos de atuação) que os hunters escolhem em `/empresas` e
  escrever a cadência de mensagens de cada setor.
- **Quem usa:** admin.
- **Layout:** grid de 300px + 1fr (`lg`).
  - **Card "Setores (ramos de atuação)"** (`SetoresTab`): form com input "Ex.: Varejo" e **"Criar"**
    (toast "Setor criado — agora escreva a cadência"; o novo setor já fica selecionado). Lista de
    botões, um por setor (ordenada por `sort` e nome): nome (cinza com "(inativo)" se desativado),
    "{N} emp." (empresas que usam o setor) e uma pill "{k}/5" com as etapas que têm mensagem própria
    (verde `whatsapp-soft` se completa, âmbar `warning-soft` se não; tooltip "Etapas com mensagem
    própria do setor"). Selecionado: `bg-accent`.
  - **Sem seleção:** "Escolha um setor para editar a cadência. Etapas sem mensagem própria usam o
    modelo padrão da equipe."
  - **Com setor selecionado** (`SectorEditor`):
    - **Card "Setor":** **Nome** (input), **Ordem** (number), checkbox **"Ativo (aparece para os
      hunters)"**, **"Salvar setor"** (toast "Setor salvo") e **"Excluir setor"** (ghost vermelho).
      Excluir: se alguma empresa usa o setor, só o toast de erro "Setor usado por N empresa(s).
      Desmarque "Ativo" para tirá-lo da lista."; senão `useConfirm` com a palavra **EXCLUIR** e o
      botão "Excluir setor" ("O setor e a cadência dele são apagados.").
    - Cabeçalho **"Cadência do setor"**, com a lista de variáveis ([FIRST NAME], [EMPRESA],
      [NA_EMPRESA], [A_EMPRESA], [DA_EMPRESA], [CARGO], [DOR_DO_SETOR], [NOME], [CONSULTOR],
      [OBRIGADO], [JANELA], [SAUDACAO]) e "Etapa vazia usa o modelo padrão.", mais os botões
      **"Preencher vazias com o padrão"** (outline; copia o modelo padrão para as etapas vazias, só
      no formulário) e **"Salvar cadência"** (toast "Cadência salva").
    - Um Card por `STEPS`: `ChannelBadge`, input do **código** (mono, "Código (ex.: VAR-IN01)") e,
      se vazia, "usa o modelo padrão". Corpo em duas colunas (`md`): textarea da mensagem (9 linhas,
      placeholder = texto do modelo padrão) e a **pré-visualização ao vivo** (renderizada com o
      contato de exemplo Mariana Souza · Gerente de Operações · Acme, área Operações, e o nome do
      admin; sem texto próprio, mostra o padrão).
- **Estados:** sem setores: "Nenhum setor cadastrado."; sem loading próprio (a lista aparece vazia
  até carregar); erros em toast. "Salvar setor" desabilitado com nome vazio ou durante o envio.
- **Dados:** leitura de `sectors` e `sector_templates` pelo cliente (`useSectors`,
  `useSectorTemplates`; leitura liberada a qualquer logado), `message_templates` e `profiles`;
  `sectorUsage`, `sectorSave`, `sectorSaveCadence` e `sectorDelete` em
  `src/lib/setores.functions.ts` (`has_role` antes do service role).
- **Componentes:** `SetoresTab.tsx`, `SectorEditor.tsx`; `StatusBadge.tsx` (`ChannelBadge`); ui:
  `card`, `input`, `label`, `checkbox`, `textarea`, `button`.
- **Observações de UX:**
  - São dois botões de salvar independentes ("Salvar setor" e "Salvar cadência"); trocar de setor
    descarta o que não foi salvo, sem aviso.
  - "Preencher vazias com o padrão" muda só o formulário, sem avisar que ainda falta salvar.
  - Cinco cards altos com textarea e pré-visualização lado a lado: a página fica muito longa e, no
    celular, cada etapa vira textarea + pré-visualização empilhadas.
  - A lista de variáveis é um parágrafo corrido, sem inserção por clique.
  - O "Excluir setor" bloqueado só explica o motivo em toast depois do clique.

#### Aba Competição — ranking (`src/components/painel/CompTab.tsx`)

- **Objetivo:** definir o período da competição geral e mostrar o placar da competição ou do
  ciclo, as regras de pontuação e a atividade de envios por hunter. É o **único lugar do app com o
  ranking**.
- **Quem usa:** só o admin (os hunters não veem placar; o admin não aparece nele). Link direto:
  `/painel?aba=competicao`, para onde `/ranking` redireciona.
- **Estrutura:** card "Período da competição", depois `CompetitionBoard` e `ActivityBoard`.

**Card "Período da competição"**

- Início e Fim (opcional), **"Salvar período"** (desabilitado sem início; toast "Período salvo" ou
  "A data de fim deve ser depois do início"). Só `has_role`, sem senha; é o único lugar onde esse
  período se edita (`painelSetPeriod` grava em `competition_settings`). Ao lado, "1º AT: {hunter}
  em {data}" quando houver.

**CompetitionBoard** (`src/components/ranking/CompetitionBoard.tsx`)

- Filtros (todos `NativeSelect`, em linha):
  - Período: **"Competição geral"** + cada período ("{nome} (ativo)" ou "(encerrado)"). O padrão é
    o período ativo.
  - Visão (só em ciclo com semanas): **"Geral do ciclo"** + "Semana DD/MM/AAAA a DD/MM/AAAA
    (parcial)".
  - Só em período encerrado: Tabs **"Placar oficial"** / **"Maturação atual"**.
  - Grupo: **"Todos os grupos"** + grupos + **"Sem grupo"**. Subgrupo (se houver): **"Todos os
    subgrupos"** + subgrupos.
- Linha de contexto: "Placar oficial congelado no encerramento · " ou "Resultados atualizados após
  o encerramento (não alteram o placar oficial) · ", seguido de "Período: DD/MM/AAAA a DD/MM/AAAA"
  (ou "em diante"), ou de "Semana: ...". Termina com " · 1º AT: {hunter} em {data}", ou
  "Carregando período...".
- `GroupTotals` (só com grupo filtrado): card "Total do grupo: {nome}" com 4 KPIs: Pontuação final
  (soma), Total de pontos (soma), ATs, Hunters.
- `CompetitionTable` (`ui/table`): **#, Hunter, Grupo, uma coluna por `FUNNEL` (`abbr`: ATs, Leads,
  Propostas, Aprov. verbais, Vendidos), Pontos funil, Bônus 1º AT, Bônus semanas ("N (k sem.)"),
  Total pontos, Conversão (%), Pontuação final** (em destaque). O pódio (top 3 com pontuação > 0)
  tem fundo `warning-soft`, `accent` e `linkedin-soft`, e a posição aparece como "1º".
  - Estados: "Carregando...", "Nenhum hunter neste filtro.". Sem paginação.
- `WeeklyWinners` (fora da visão semanal, se houver semanas): card "Semanas com mais ATs", uma
  linha por semana ("DD/MM a DD/MM [parcial] — nomes (N ATs)").
- `ScoringRules`: card "Como a pontuação é calculada", em texto corrido. Os pontos vêm do `FUNNEL`:
  regra da data da AT, 1º AT +5, ciclo, mais ATs da semana +6, taxa de conversão, pontuação final =
  0,7 × pontos + 0,3 × conversão.

**ActivityBoard** (`src/components/ranking/ActivityBoard.tsx`)

- H2 "Atividade", "Mensagens enviadas por etapa — período a partir de DD/MM/AAAA." e Tabs **"Hoje"
  / "Semana" / "Mês"** (7 e 30 dias).
- Card "Métricas de atividade", tabela (`ui/table`) com **#, Hunter, Importados, uma coluna por
  `STEPS`, Concluídas, Respostas** (em verde `success`). Ordenada pelo total enviado.
- Estados: "Carregando...", "Nenhum dado no período."

- **Ações:** salvar o período da competição; o resto são filtros.
- **Dados:** `getCompetition()` (sem argumento no card de período; com `{ periodId, oficial }` no
  placar), que lê com service role `periods`, `profiles`, `competition_settings`,
  `period_members`, `groups`, `subgroups`, `contacts`, `user_roles`, ou `period_snapshots` quando é
  o placar oficial; `periods` (select direto do cliente, para o seletor); `rpc('ranking', {
period_start })`, que devolve vazio para quem não é admin; `painelSetPeriod`.
- **Componentes:** `CompTab.tsx`; `src/components/ranking/*` (`CompetitionBoard`,
  `CompetitionTable`, `GroupTotals`, `WeeklyWinners`, `ScoringRules`, `ActivityBoard`), que
  continuam nessa pasta mesmo usados só no painel; ui: `card`, `input`, `label`, `button`,
  `native-select`, `tabs`, `table`.
- **Observações de UX:**
  - Há dois "períodos" na mesma aba: o card "Período da competição" (competição geral) e o seletor
    de período do placar (os períodos de Períodos e grupos), sem explicação da diferença.
  - São duas tabelas largas (11+ e 9+ colunas) com scroll horizontal no mobile.
  - Os filtros são selects nativos misturados com Tabs na mesma linha.
  - O regulamento é um bloco de texto longo, sempre aberto.
  - A métrica-guia (ATs/semana) não tem destaque visual próprio: é uma coluna entre várias.
  - O nome da aba é "Competição", mas o conteúdo é o ranking; nada no menu dos hunters leva a ele.

#### Aba Busca geral (`src/components/painel/BuscaTab.tsx`)

- Formulário: input **"Nome ou empresa (opcional com filtro de data)"** e **"Buscar"** (exige pelo
  menos 2 caracteres, ou um intervalo de datas).
- `DateRangePicker`: "Dia:" **"Hoje"**, **"Ontem"**, date "Escolher dia" (máximo hoje); "Semana
  (seg–dom):" **"Esta semana"**, **"Semana passada"**, NativeSelect "Escolher semana…" (26
  semanas); **"Limpar data"**. O atalho ativo vira o botão `default`.
- Linha de contexto: "Período: **{rótulo}** (DD/MM/AAAA a DD/MM/AAAA) · contatos importados ou com
  envio/avanço no funil nesse intervalo".
- Resultado: "N resultados (mostrando os 300|2000 primeiros)" e `ContactTable` com a coluna
  **Hunter** e, com data, **"Atividade no período"** (por exemplo, "LinkedIn 1 em 14/11 · AT
  marcada em 15/11").
- **Estados:** antes de buscar não mostra nada (nenhuma instrução além do placeholder);
  "Buscando…"; "Nenhum contato."
- **Ações destrutivas:** as mesmas da ContactTable ("Excluir" por linha e "Excluir selecionados",
  via `useConfirm`).
- **Dados:** `painelContacts` (`hunterId` null; limite de 300 sem data e 2000 com data),
  `painelHunters` (nomes), `painelDelete`.
- **Observações de UX:** sem paginação (até 2000 linhas). São muitos botões de atalho de data numa
  linha só. A busca só dispara no submit.

---

## 3. Componentes compartilhados

| Componente                      | Arquivo                                                             | Renderiza                                                                                                                                                                                                                                                                                                        | Onde                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusBadge`                   | `src/components/StatusBadge.tsx`                                    | Pill (11px) com `STATUS_LABEL`. Cores: aguardando = muted, em_cadencia = linkedin-soft, respondeu = success-soft, concluido = accent, descartado = warning-soft.                                                                                                                                                 | Contatos (dentro do Select de situação)                                                                                               |
| `ChannelBadge`                  | `src/components/StatusBadge.tsx`                                    | Etiqueta retangular (rounded-md) linkedin-soft/linkedin ou whatsapp-soft/whatsapp com o rótulo da etapa.                                                                                                                                                                                                         | Hoje, Modelos, Configurações (IntervalsCard), Painel › Setores                                                                        |
| `FunnelBadge`                   | `src/components/Funnel.tsx`                                         | Pill da etapa atual do funil, com uma cor por índice (linkedin, whatsapp, warning, accent, success); some se o contato não está no funil.                                                                                                                                                                        | Hoje, Contatos                                                                                                                        |
| `FunnelControl`                 | `src/components/Funnel.tsx`                                         | Botão outline "Avançar no funil" que abre um Popover (w-72): "Etapa atual: X (data)", "Próxima: Y (+N pts)", input date, "Marcar Y"; ou "Projeto vendido — funil completo."; "Desfazer X" (vermelho, confirmado por `useConfirm` com `reversible`).                                                              | Hoje, Contatos                                                                                                                        |
| `InlineInput`                   | `src/components/InlineInput.tsx`                                    | Input `h-7 w-36 text-xs` que salva no blur ou Enter se o valor mudou.                                                                                                                                                                                                                                            | Contatos, Empresas                                                                                                                    |
| `SectorSelect`                  | `src/components/SectorSelect.tsx`                                   | Select do shadcn com `SECTORS` (área do contato; aria-label "Área do contato", placeholder "Área").                                                                                                                                                                                                              | Hoje (etapa 1), Contatos                                                                                                              |
| `CompanyGenderToggle`           | `src/components/CompanyGender.tsx`                                  | Segmentado `h-7` com 3 botões: "♂ no", "♀ na", "em" (com tooltips de exemplo); o ativo fica `bg-primary`.                                                                                                                                                                                                        | Hoje (LeadFields, CompanyFix), Contatos, Empresas                                                                                     |
| `TablePagination`               | `src/components/TablePagination.tsx`                                | "X–Y de N {noun}", "Anterior", "Página P de T", "Próxima"; some com uma página.                                                                                                                                                                                                                                  | Contatos                                                                                                                              |
| `NativeSelect`                  | `src/components/ui/native-select.tsx` (projeto, não shadcn)         | `<select>` nativo `h-9` com o visual dos inputs.                                                                                                                                                                                                                                                                 | Modelos, Contatos (pendências), `CompanySelect`, `IndustrySelect`, painel (Indicadores e metas, Competição, Busca, Hunters, Períodos) |
| `useConfirm` / `ConfirmDialog`  | `src/components/useConfirm.tsx`, `src/components/ConfirmDialog.tsx` | `ask({ title, desc, word?, action?, reversible?, run })` abre um AlertDialog: título, desc + "Essa ação não pode ser desfeita." (omitido com `reversible`), campo "Digite **WORD** para confirmar" (aceita maiúsculas), "Cancelar" e o botão vermelho (`action` ou "Excluir"). Trata o loading e o erro (toast). | Painel, Empresas (excluir empresa), Contatos (descartar em lote), `FunnelControl` (desfazer etapa), HolidaysAdmin (remover feriado)   |
| `ContactTable` (painel)         | `src/components/painel/ContactTable.tsx`                            | Tabela crua de contatos com seleção, exclusão individual ou em lote e coluna opcional Hunter/Atividade.                                                                                                                                                                                                          | Painel: Hunters, Busca                                                                                                                |
| `GroupSubgroupSelect`           | `src/components/painel/periodos/GroupSubgroupSelect.tsx`            | Par de NativeSelects Grupo → Subgrupo ("Sem grupo"/"Sem subgrupo").                                                                                                                                                                                                                                              | Painel: Períodos (MembersCard, AddMembersDialog)                                                                                      |
| `CompanySelect`                 | `src/components/CompanySelect.tsx`                                  | `NativeSelect` `h-7 text-xs` com as empresas do hunter em ordem alfabética e uma opção vazia configurável ("Sem empresa cadastrada", "Vincular empresa…", "Texto livre (sem cadastro)"). Grava `company_id`.                                                                                                     | Hoje (LeadFields), Contatos, Importar                                                                                                 |
| `IndustrySelect`                | `src/components/IndustrySelect.tsx`                                 | `NativeSelect` com os setores (ramos) ativos; placeholder desabilitado "Setor da empresa…" e borda amarela enquanto vazio; setor inativo já escolhido aparece com "(inativo)".                                                                                                                                   | Empresas (cadastro e lista)                                                                                                           |
| `AutoFillButton`                | `src/components/contatos/AutoFillButton.tsx`                        | Botão "Preencher empresa e área (N)" + AlertDialog próprio (não usa `useConfirm`).                                                                                                                                                                                                                               | Contatos                                                                                                                              |
| `NameCard`                      | `src/components/configuracoes/NameCard.tsx`                         | Card com título, descrição, um input e "Salvar" (toast com a mensagem recebida).                                                                                                                                                                                                                                 | Configurações (duas vezes)                                                                                                            |
| `GoalsDialog`                   | `src/components/painel/dashboard/GoalsDialog.tsx`                   | Dialog de metas com um `fieldset` (`GoalForm`) por escopo: equipe, grupos e exceções por hunter.                                                                                                                                                                                                                 | Painel: Indicadores (Metas)                                                                                                           |
| `Section` / `BarList`           | `src/components/painel/dashboard/shared.tsx`                        | Card com título e frase de explicação; lista de barras horizontais (`chart-1`) com rótulo, valor e nota.                                                                                                                                                                                                         | Painel: Indicadores                                                                                                                   |
| `Warn` (local)                  | `src/components/hoje/QueueCard.tsx`                                 | Pill amarela warning-soft.                                                                                                                                                                                                                                                                                       | Hoje                                                                                                                                  |
| Pills de situação da importação | `RowStatus` em `src/components/importar/ImportPreview.tsx`          | Pills "Novo" (whatsapp), "Já cadastrado" (muted), avisos (warning). São iguais ao StatusBadge, mas foram reimplementadas.                                                                                                                                                                                        | Importar                                                                                                                              |
| Hooks                           | `src/hooks/useCadencia.ts`, `usePainel.ts`, `useSelection.ts`       | Dados do hunter (inclui `useCompanies`, `useAddCompanies`, `useUpdateCompany`, `useDeleteCompany`, `useSectors`, `useSectorTemplates`, `useBulkPatchContacts` e `useImportContacts`), dados do admin, seleção por checkbox.                                                                                      | —                                                                                                                                     |

Feedback global: todo sucesso e erro de ação vai para **toast (sonner)**. Não há banners
inline, exceto o aviso amarelo de membros sem grupo, a confirmação inline da AdminArea (a única
confirmação destrutiva que não usa `useConfirm`, além do AlertDialog próprio do `AutoFillButton`),
o `CompanyFix`, o aviso de carregamento/erro da fila em Envios de hoje e a mensagem de erro em
vermelho da aba Indicadores.

Pills soltas de 11px também foram reimplementadas inline em `/empresas` ("cadência do setor
incompleta", "sem contatos"), no cartão de Hoje (setor da empresa, atrasado, `Warn`), nas abas de
Hoje (contador), na aba Setores ("{k}/5") e nos Alertas dos Indicadores (Alta/Média).

---

## 4. Tokens visuais atuais (`src/styles.css`)

- **Stack:** Tailwind v4 (`@theme inline`), `tw-animate-css`, tokens shadcn em OKLCH.
- **Fonte:** `Inter Tight` (400, 500, 600 e 700, via Google Fonts), com fallback `ui-sans-serif,
system-ui`. `-webkit-font-smoothing: antialiased`.
- **Raio:** `--radius: 0.5rem`, com as variantes sm, md, lg, xl, 2xl, 3xl e 4xl derivadas.
- **Paleta (`:root`, único tema):** azul-ardósia frio, com matiz em torno de 250–255.
  | Token             | Valor                         | Uso                                |
  | ----------------- | ----------------------------- | ---------------------------------- |
  | background        | `oklch(0.985 0.004 250)`      | fundo quase branco azulado         |
  | foreground        | `oklch(0.24 0.02 255)`        | texto                              |
  | card / popover    | `oklch(1 0 0)`                | branco                             |
  | primary           | `oklch(0.34 0.045 255)`       | ardósia escura (botões primários)  |
  | secondary / muted | `oklch(0.955 0.008 250)`      |                                    |
  | muted-foreground  | `oklch(0.52 0.02 255)`        |                                    |
  | accent            | `oklch(0.94 0.014 250)`       | item de nav ativo, hover, pódio 2º |
  | destructive       | `oklch(0.55 0.2 22)`          | vermelho                           |
  | border / input    | `oklch(0.905 / 0.9 0.01 252)` |                                    |
  | ring              | `oklch(0.55 0.08 250)`        |                                    |
- **Cores semânticas do projeto** (cada uma com uma variante `-soft` para fundo):
  | Token    | Claro                         | Soft claro               | Uso                                                       |
  | -------- | ----------------------------- | ------------------------ | --------------------------------------------------------- |
  | linkedin | `oklch(0.48 0.13 252)` (azul) | `oklch(0.94 0.035 252)`  | canal LinkedIn, "Outbound" no logo, em_cadencia, pódio 3º |
  | whatsapp | `oklch(0.5 0.13 155)` (verde) | `oklch(0.945 0.045 155)` | canal WhatsApp, "Novo" na importação                      |
  | success  | **idêntico a whatsapp**       | idêntico                 | respondeu, Respostas, "Projeto vendido", "Na meta"        |
  | warning  | `oklch(0.58 0.14 70)` (âmbar) | `oklch(0.95 0.05 80)`    | avisos de dado faltando, descartado, pódio 1º, "Perto"    |
  - `success` e `whatsapp` têm **os mesmos valores** (`oklch(0.5 0.13 155)` e soft
    `oklch(0.945 0.045 155)`): "respondeu", "Na meta" e o canal WhatsApp são indistinguíveis pela
    cor.
  - `chart-1` a `chart-5` estão definidos; só `chart-1` é usado, na aba Indicadores do painel
    (gráficos `recharts` via `ui/chart`, heatmap e barras).
- **Só tema claro:** não há tokens `.dark`, variante `dark:` nem tokens `sidebar-*` (removidos com
  os componentes sem uso).
- **Utilitário próprio:** `table-dense` (th e td com padding de 0.375rem × 0.5rem e fonte de
  0.8125rem), usado em todas as tabelas.
- **Responsividade:** poucos breakpoints nas telas (cerca de 20 usos de `sm:`, `md:`, `lg:` e `xl:`
  em rotas e componentes fora de `ui/`, a maioria nos grids da aba Indicadores). Não há hook de
  mobile (`use-mobile.tsx` foi removido). Nas capturas de celular, a nav do topo mostra só "Envios
  de hoje" e "Empresas" (ver "Shell e navegação"); a barra de abas do painel quebra em linhas e
  cabe (ver 2.9).
- **Tipografia sem escala:** os tamanhos vêm de utilitários soltos (`text-xs`, `text-sm`,
  `text-base`, `text-lg`, `text-xl`, `text-2xl`) e de valores arbitrários: **`text-[11px]` aparece
  26 vezes** (em 14 arquivos: pills, contadores, avisos, código do modelo). Os H1 também variam
  (`text-2xl font-bold` nas telas do hunter, `text-xl font-semibold` no painel).
- **Destaques recorrentes:** pills de 11px `rounded-full` (status, avisos, contadores), botões
  `size="sm"` e inputs `h-7 text-xs` nas linhas densas.

### Uso dos componentes shadcn/ui (`src/components/ui/`)

Restam **17 arquivos** em `ui/` (os 30 componentes shadcn sem uso foram apagados), e todos são
usados. Número de arquivos fora de `ui/` que importam cada um:

| Componente                 | Arquivos                                                                      |
| -------------------------- | ----------------------------------------------------------------------------- |
| button                     | 36                                                                            |
| input                      | 26                                                                            |
| card                       | 22                                                                            |
| label                      | 13                                                                            |
| native-select (do projeto) | 13                                                                            |
| checkbox                   | 6                                                                             |
| table                      | 5 (ContactsTable, ContactRow, ImportPreview, CompetitionTable, ActivityBoard) |
| select                     | 4 (SectorSelect, GenderCard, ContactsToolbar, ContactRow)                     |
| tabs                       | 4 (hoje, painel, CompetitionBoard, ActivityBoard)                             |
| badge                      | 3 (PeriodDetail, GroupsCard, MembersCard)                                     |
| dialog                     | 3 (NewPeriodButton, AddMembersDialog, GoalsDialog)                            |
| textarea                   | 3 (PasteCard, CompanyForm, SectorEditor)                                      |
| alert-dialog               | 2 (ConfirmDialog, AutoFillButton)                                             |
| chart                      | 1 (Indicadores › Tendencia)                                                   |
| popover                    | 1 (Funnel)                                                                    |
| radio-group                | 1 (AdminArea)                                                                 |
| sonner                     | 1 (root)                                                                      |

**Tabelas fora do padrão:** há **9 `<table>` cruas em 6 arquivos do painel**, sem `ui/table` e com
estilos diferentes entre si (umas com `table-dense`, outras com `py-1` ou `p-2`, `text-sm` ou
`text-xs`): `ContactTable` (Hunters e Busca), `MembersCard` (Períodos) e, nos Indicadores,
`Execucao.tsx` (`Execucao`, lista de atrasados, `Heatmap`, `Ritmo`), `Funil.tsx` (`ConversaoPor`),
`Metas.tsx` e `Tendencia.tsx` (`Coortes`). As tabelas das telas do hunter e do ranking usam
`ui/table`.

**Listas sem paginação nem lotes:** `ContactTable` do painel (até 2000 linhas em Hunters e na Busca
com data), a prévia do Importar (todas as linhas coladas), a tabela de membros do período, a lista
de empresas em `/empresas`, o placar e a tabela de atividade.

---

## 5. Regras que o redesign não pode quebrar

1. **Paginação:** a tabela de contatos mostra **50 por página** (`paginate` + `TablePagination`).
   "Selecionar todos" vale para **todo o filtro**, não só a página.
2. **Filas de envio:** **50 cartões por vez**, com "Mostrar mais". A fila de LinkedIn 1 sem data
   pode ter milhares de itens.
3. **Fontes únicas:** colunas, abas, rótulos, pontos e CSVs saem de `STEPS` e `FUNNEL`
   (`cadencia.ts`). O redesign não pode fixar no código "5 etapas", nomes de etapa ou pontos.
   `STATUS_LABEL` e `SECTORS` também são a fonte dos rótulos.
4. **Datas previstas** são sempre calculadas por `plannedDates` (dias úteis, feriados), nunca
   gravadas. Toda tela que mostra previsão usa essa função.
5. **Ações destrutivas** passam por `useConfirm` (`src/components/useConfirm.tsx`:
   `ask({ title, desc, word?, action?, reversible?, run })`), nunca pelo `confirm()` do navegador.
   As que hoje exigem palavra continuam exigindo: limpar contatos de hunter (EXCLUIR), transferir
   (TRANSFERIR), excluir hunter (EXCLUIR), excluir setor (EXCLUIR) e encerrar período (nome do
   período). As reversíveis (descartar em lote, desfazer etapa do funil, remover feriado) usam
   `reversible` e não dizem "não pode ser desfeita".
6. **Senha de admin:** exclusão em massa e feriados (AdminArea) exigem `ADMIN_PASSWORD`, com
   bloqueio por tentativas. Uma falha bloqueia a área de novo. O período da competição geral só se
   edita no painel, aba Competição (`painelSetPeriod`, `has_role`).
7. **Hunter não exclui contatos** (sem DELETE no RLS). Exclusão só pelo admin, via server
   functions.
8. **Excluir hunter** só funciona com zero contatos (o cascade apagaria os contatos).
9. **Ranking/placar:** é **só do admin** — fica na aba Competição do painel; `/ranking` redireciona
   para `/painel?aba=competicao` e a função SQL `ranking` devolve vazio para quem não é admin. Não
   voltar a mostrar placar aos hunters. A aba do painel fica na URL (`?aba=`), e links diretos
   dependem disso; `/indicadores?…` também é link direto (filtros, aba e ordenação na URL). O cliente recebe só totais (`getCompetition`). Admins não aparecem. Período
   encerrado: "Placar oficial" (snapshot) e "Maturação atual" (ao vivo) são visões distintas e
   precisam continuar distinguíveis.
10. **AT marcada tira o contato das filas**, e a pontuação conta pela data de registro, não pela
    data da reunião (texto do regulamento).
11. **Mensagens:** copiar ou abrir o WhatsApp é bloqueado sem empresa (e, no LinkedIn 1, sem área
    quando o modelo usa [DOR_DO_SETOR] e sem cargo quando usa [CARGO]). O fluxo de completar o dado
    (`CompanyFix`, o vínculo com a empresa e os campos do lead) precisa continuar acessível no
    cartão.
12. **Listas e consultas grandes** usam `fetchAll`. Não renderizar milhares de linhas sem
    paginação ou lotes. Hoje a `ContactTable` do painel (até 2000), a pré-visualização da
    importação e os membros do período violam isso (a lista de `/empresas` também não pagina); o
    redesign deve corrigir, não piorar.
13. **Selects simples** usam `NativeSelect`; erros em toast usam `errorMessage`.
14. **Estrutura de código:** rotas finas; componentes em `src/components/<tela>/` (`contatos`,
    `empresas`, `hoje`, `importar`, `configuracoes`, `ranking`, `painel`); regras puras em
    `src/lib/<tela>.ts` com testes (`contatos.ts`, `empresas.ts`, `fila.ts`, `importar.ts`,
    `ranking.ts`, `dashboard.ts`...). O redesign troca só `src/routes/`, `src/components/` e os
    tokens; não mexe em `src/lib/`, `src/hooks/` nem em `*.functions.ts`/`*.server.ts`, e não deve
    mover lógica para componentes.
15. **Planilha externa:** o link "Abrir planilha" e os CSVs (`/api/public/planilha/*.csv`) dependem
    das mesmas regras, por isso as mudanças de rótulo em `STEPS` e `FUNNEL` também afetam a
    planilha.
16. **Área × setor:** "Área" (`contacts.sector`, `SECTORS`, alimenta [DOR_DO_SETOR]) e "Setor"
    (`sectors`, ramo da empresa, define a cadência) são coisas diferentes e precisam continuar
    distinguíveis na UI.
17. **Empresa do contato:** com `company_id`, nome e concordância vêm da empresa cadastrada (trigger
    copia para `contacts.company`/`company_gender`); a edição desses campos é feita em `/empresas`.
    Sem vínculo, o texto livre continua valendo.
18. **Cadência por setor:** a mensagem vem de `pickTemplate` (setor da empresa, senão o modelo
    padrão). Setores são escritos só pelo admin, via `setores.functions.ts`; setor com empresas não
    é excluído, só desativado (excluir exige a palavra EXCLUIR).
19. **Preenchimento automático** (`enriquecimento.ts`) só preenche campos vazios e, na dúvida,
    deixa em branco. O redesign não deve sobrescrever dados que o hunter já escreveu.
20. **Indicadores:** o cálculo fica em `src/lib/dashboard.ts` (`computeDashboard`), reaproveitando
    `plannedDates`, `isActive`, `computedStatus` e as datas de pontuação, para que envios,
    atrasados e funil batam com Envios de hoje e com o placar. O "hoje" vem do navegador (fuso de
    São Paulo). A tela não deve recalcular métricas por conta própria. O semáforo das metas
    ("Na meta", "Perto", "Abaixo") mostra ícone e rótulo, nunca só cor; as faixas (100%, 70%, 10
    pontos no prazo) e a herança equipe → grupo → hunter vêm de `dashboard.ts` (`volumeProgress`,
    `onTimeProgress`, `resolveGoal`). Metas e `respondeu_em` são lidas e escritas só por server
    functions do painel.
21. **Testes de ponta a ponta:** `bun run e2e` (Playwright contra o build e um Supabase simulado,
    relógio fixo em 12/11/2026) cobre as telas em `e2e/*.spec.ts`. Mudou uma tela ou um fluxo,
    ajuste o teste no mesmo commit; nunca pule ou apague teste.
