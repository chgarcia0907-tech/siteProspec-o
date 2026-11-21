# Plano: login com Google, acessos por cargo e agenda dos CNs

Data: 21/11/2026 · Branch de trabalho: `dev` · Status: proposta, aguardando as decisões da seção 1

Objetivo de produto: fazer o hunter marcar mais ATs. A agenda dos CNs é a parte que mexe direto
na métrica (menos idas e vindas para achar horário). O login com Google e os cargos são a base
para ela: a plataforma precisa saber quem é CN e ter acesso à agenda de cada um.

---

## 0. Como está hoje (pontos de partida no código)

| Tema              | Hoje                                                                                                                  | Onde                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Login             | E-mail e senha do Supabase Auth, senha com **mínimo de 6** caracteres; qualquer e-mail pode criar conta               | `src/components/auth/AuthForm.tsx`                                                               |
| Recuperar senha   | **Não existe** ("esqueci minha senha")                                                                                | —                                                                                                |
| MFA               | **Não existe**                                                                                                        | —                                                                                                |
| Papéis            | Enum `app_role` com um único valor, `admin`, em `user_roles`; o admin é dado por um trigger que olha um e-mail fixo   | `supabase/migrations/20261010200102_admin_roles.sql`, `20261010200850_admin_email_guilherme.sql` |
| Checagem de papel | `has_role(uid, 'admin')` repetido em cada `*.functions.ts` (`assertAdmin`) e no SQL de `public.ranking()`             | `painel.functions.ts`, `periodos.functions.ts`, `setores.functions.ts`, `admin.functions.ts`     |
| Ações sensíveis   | Senha compartilhada `ADMIN_PASSWORD` com bloqueio (5 tentativas / 15 min)                                             | `src/lib/admin.server.ts`                                                                        |
| Perfil            | `profiles` com `email`, `display_name`, `message_name`, `gender`; leitura liberada para todo logado; sem foto         | migração inicial, `src/routes/_authenticated/configuracoes.tsx`                                  |
| Navegação         | Grupo "Administração" aparece só para `isAdmin`                                                                       | `src/components/AppSidebar.tsx`, `src/routes/_authenticated/route.tsx`                           |
| Calendário        | Nenhuma integração                                                                                                    | —                                                                                                |
| Time comercial    | `time_comercial` já diz quem é hunter e quem é CN (`papel`), com login, apelidos e ids do Pipedrive                   | `supabase/migrations/20261118164342_ats_registro_e_eventos.sql`                                  |
| ATs               | `ats` guarda hunter, CN (`cn_login`) e o horário atual (`agendada_atual`) de cada AT; editar evento é "dono ou admin" | mesma migração, `src/lib/ats.ts`, `/ats`                                                         |

> O plano reaproveita `time_comercial` e `ats`: a lista de CNs da agenda sai daí, as ATs já
> marcadas de cada CN contam como horário ocupado, e o horário escolhido abre o registro de AT
> já preenchido.

---

## 1. Decisões

### Já decididas

- **Login só com a conta Google @polijunior.com.br.** Senha, 2FA e recuperação ficam com o Google
  Workspace da Poli; o app não guarda senha de ninguém. Fica uma única conta de emergência com
  senha (ver D5).
- **Sem upload de foto.** A foto é a da conta Google, atualizada a cada login. Para trocar, a pessoa
  troca no Google.

### Precisam da sua resposta

| #   | Decisão                                                             | Recomendação                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Quem pode entrar?                                                   | **Só quem está na lista de liberados** (e-mail + cargo, cadastrados pelo gerente na tela de Acessos). Uma conta @polijunior fora da lista vê "peça acesso ao gerente". Assim o cargo já vem certo no primeiro login.                                                                       |
| D2  | Uma pessoa tem **um cargo** ou vários?                              | **Um cargo por pessoa** (Hunter, CN ou LO/Gerente). Se um CN também prospectar, o cargo CN ganha a permissão de prospecção.                                                                                                                                                                |
| D3  | Onde mora o cargo, já que `time_comercial.papel` existe?            | **`profiles.cargo_id` manda nas permissões**; `time_comercial` continua sendo o cadastro do Pipedrive (login, apelidos, ids). A migração copia `papel` para `cargo_id` e um trigger mantém `papel` igual ao cargo (hunter/cn), para a tela de ATs e a carga da planilha não mudarem.       |
| D4  | Permissões **fixas no código** ou **editáveis numa matriz**?        | **Matriz editável** (cargo × permissão) na tela de Acessos, com a lista de permissões fixa no código. Você aloca cargos e ajusta o que cada cargo pode, sem deploy.                                                                                                                        |
| D5  | O que vira o `admin` atual?                                         | O `admin` vira o cargo **LO/Gerente** com as permissões de hoje. Fica um papel técnico **"dono da plataforma"** (só ele edita a matriz) com a **conta de emergência**: e-mail e senha forte + MFA, entrada fora da tela normal, para o caso de o login Google quebrar.                     |
| D6  | A `ADMIN_PASSWORD` compartilhada continua?                          | **Sai.** Com login individual pelo Google (e o 2FA do Workspace), a exclusão passa a exigir a permissão (`contatos.excluir`, `feriados.editar`), a confirmação com palavra do `useConfirm` e grava quem excluiu. Senha compartilhada não diz quem fez a ação.                              |
| D7  | **Projeto no Google Cloud** em nome de quem?                        | Criar o projeto **dentro da organização Google da Poli Júnior**, com tela de consentimento **"Interna"**. Só contas @polijunior entram e os escopos de agenda não passam pela verificação do Google. Precisa de alguém com acesso de administrador do Workspace/GCP da Poli. **Pedir já.** |
| D8  | A agenda **lê** só livre/ocupado ou também **cria o evento** da AT? | **Fase 3: só livre/ocupado.** Fase 4 (opcional): criar o evento na agenda do CN com link do Meet ao registrar a AT.                                                                                                                                                                        |

---

## 2. Visão da arquitetura

```
                 ┌──────────────────────────── Supabase ────────────────────────────┐
 Navegador       │ auth.users (provider google) ── profiles (+ cargo, avatar_url)   │
 (React Query) ──┤ acessos_liberados (e-mail → cargo)                               │
                 │ cargos ── cargo_permissoes          has_permission(uid, perm)   │
                 │ google_contas (refresh token cifrado, só service role)           │
                 └──────────────────────────────────────────────────────────────────┘
                          ▲                                   ▲
 Server functions ────────┘ assertPermission(ctx, "...")      │ service role
 (TanStack Start)  agenda.functions.ts ──► Google Calendar API: freeBusy (só livre/ocupado)
```

Um só consentimento do Google no login dá **identidade, nome, foto e acesso a livre/ocupado da
agenda**. Não há fluxo OAuth separado para a agenda.

Princípios (seguem o `AGENTS.md`):

- **Uma fonte de verdade para permissões**: `PERMISSOES` em `src/lib/acessos.ts` (chave, rótulo,
  grupo), igual a `STEPS`/`FUNNEL`. Telas, menu e server functions derivam dela.
- **Checagem no servidor sempre**: o menu esconder um item é conforto; quem protege é
  `assertPermission` (TS) e `has_permission` (SQL/RLS).
- **Regras puras testáveis** em `src/lib/` (`acessos.ts`, `perfil.ts`, `agenda.ts`), com
  `*.test.ts` ao lado. Nada de lógica de horário em componente.
- **Privacidade da agenda**: o app nunca lê título, descrição nem participantes dos eventos; só
  intervalos ocupados (escopo `calendar.freebusy`). Tokens cifrados e invisíveis ao cliente.

---

## 3. Fases e pull requests

Cada item abaixo é um PR para o `dev` (dados e regras separados de tela, uma tela por PR, como
pede o `AGENTS.md`). Rodar `/verificar` antes de cada push.

A fase 1 não depende do Google: anda enquanto o projeto no Google Cloud (D7) é criado.

### Fase 1 — Cargos e permissões

**PR 1.1 `feat(db): cria cargos, matriz de permissões e has_permission`** (via `/nova-migracao`)

Migração (nova, sem editar as antigas):

```sql
create table public.cargos (
  id text primary key,            -- 'hunter' | 'cn' | 'gerente'
  nome text not null,             -- 'Hunter' | 'Coordenador de Negócios' | 'LO/Gerente'
  ordem int not null default 0
);
create table public.cargo_permissoes (
  cargo_id text references public.cargos(id) on delete cascade,
  permissao text not null,        -- chave de PERMISSOES em src/lib/acessos.ts
  primary key (cargo_id, permissao)
);
alter table public.profiles
  add column cargo_id text not null default 'hunter' references public.cargos(id);

create function public.has_permission(_user_id uuid, _perm text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')               -- dono da plataforma: tudo
      or exists (select 1 from public.profiles p
                 join public.cargo_permissoes cp on cp.cargo_id = p.cargo_id
                 where p.id = _user_id and cp.permissao = _perm)
$$;
```

- RLS: `cargos` e `cargo_permissoes` com leitura para logados e escrita só service role. A
  pessoa **não** pode trocar o próprio `cargo_id` (coluna fora do `GRANT UPDATE` de
  `authenticated`).
- Dados iniciais: os três cargos; usuários com `user_roles.admin` → `gerente`; quem está em
  `time_comercial` com `papel = 'cn'` → `cn`; os demais → `hunter`. O papel `admin` continua
  existindo como "dono da plataforma".
- Trigger mantém `time_comercial.papel` igual ao cargo (hunter/cn) quando a pessoa tem `user_id`
  ligado.
- `bun run db:types` e testes de `acessos.ts`.

Permissões iniciais (`PERMISSOES`, `src/lib/acessos.ts`):

| Permissão                                                        |         Hunter          | CN  | LO/Gerente |
| ---------------------------------------------------------------- | :---------------------: | :-: | :--------: |
| `prospeccao.usar` — Início, Envios, Empresas, Contatos, Importar |            ✓            |  ✓  |     ✓      |
| `agenda.buscar` — buscar horários com os CNs                     |            ✓            |  ✓  |     ✓      |
| `agenda.receber_at` — aparece como CN disponível na busca        |                         |  ✓  |     ✓      |
| `ats.gerenciar` — remarcar/no-show/cancelar AT de outro hunter   |                         |  ✓  |     ✓      |
| `indicadores.ver`                                                |                         |  ✓  |     ✓      |
| `competicao.ver` — placar e atividade                            |                         |  ✓  |     ✓      |
| `painel.periodos` — períodos, grupos, membros, transferências    |                         |     |     ✓      |
| `painel.setores` — setores e cadências                           |                         |     |     ✓      |
| `painel.metas`                                                   |                         |     |     ✓      |
| `painel.auditoria`                                               |                         |     |     ✓      |
| `contatos.excluir` e `feriados.editar`                           |                         |     |     ✓      |
| `acessos.gerenciar` — liberar pessoas, alocar cargos, desativar  |                         |     |     ✓      |
| `acessos.permissoes` — editar esta matriz                        | só "dono da plataforma" |     |            |

**PR 1.2 `refactor(painel): troca has_role(admin) por permissões`**

- `assertPermission(ctx, perm)` único em `src/lib/acessos.server.ts`, substituindo os
  `assertAdmin` de `painel.functions.ts`, `periodos.functions.ts`, `setores.functions.ts`,
  `admin.functions.ts`. `painelIsAdmin` vira `minhasPermissoes` (devolve a lista do usuário).
- SQL: `public.ranking()` passa a usar `has_permission(auth.uid(), 'competicao.ver')` (a regra do
  Hackathon anda junto com o TS); as políticas de `ats`/`at_eventos` que dizem "dono ou admin"
  passam a "dono ou `ats.gerenciar`".
- `AppSidebar` monta os grupos a partir das permissões; o destino depois do login também
  (gerente → Indicadores, demais → Início).
- e2e: o mock (`e2e/mock-supabase.mjs`) responde `has_permission`; um teste por cargo em
  `navegacao.spec.ts` (o que cada um vê no menu e o bloqueio por URL direta).

**PR 1.3 `feat(acessos): tela de pessoas e cargos`** (tela; capturas antes/depois)

- Menu próprio "Acessos" em Administração (como Indicadores):
  - **pessoas**: foto, nome, e-mail, cargo (select), login do `time_comercial` e apelidos, agenda
    conectada ou não, último acesso, ativa/desativada;
  - **liberar acesso**: e-mail @polijunior + cargo → linha em `acessos_liberados` (tabela nova,
    só service role). A pessoa entra com o Google e já cai no cargo certo;
  - **desativar** em vez de excluir (ban do Supabase Auth, corta a sessão na hora): mantém
    contatos e histórico;
  - matriz cargo × permissão (só para o dono da plataforma), com `useConfirm` ao salvar.
- Server functions em `src/lib/acessos.functions.ts` (`assertPermission` antes do service role).
- Toda troca de cargo, liberação e desativação grava em `acessos_log` (quem, quando, o quê).

### Fase 2 — Login com Google

**PR 2.1 `feat(db): aceita só contas google liberadas e copia nome e foto`**

- Hook `before_user_created` do Supabase Auth: recusa e-mail fora de `@polijunior.com.br` ou fora
  de `acessos_liberados` (exceto a conta de emergência). Regra do domínio também em
  `src/lib/acessos.ts` (`allowedEmail`), testada, para a mensagem na tela.
- `handle_new_user` lê o cargo de `acessos_liberados`.
- Trigger em `auth.users` (insert e update de `raw_user_meta_data`): copia `full_name` para
  `display_name` (só se estiver vazio, para não apagar o nome editado) e `avatar_url`/`picture`
  para `profiles.avatar_url` (sempre, assim a foto acompanha o Google a cada login).
- Antes de publicar, conferir quem usaria e-mail fora do domínio:

  ```sql
  select email from auth.users where lower(email) not like '%@polijunior.com.br';
  ```

  Essas contas precisam ser trocadas para o e-mail da Poli (admin API) antes do PR 2.3, senão a
  pessoa perde o acesso aos próprios contatos.

**PR 2.2 `feat(auth): entra com a conta google da poli`** (tela; capturas; e2e)

- Google Cloud (D7): consentimento **Interno**, cliente OAuth Web com redirect
  `https://ctxsmboaqbjgslctojeq.supabase.co/auth/v1/callback`. Supabase: provider Google ligado;
  URLs de retorno da produção e das prévias da Vercel liberadas em Authentication → URL
  Configuration.
- `/auth` passa a ter um botão só, "Entrar com Google":

  ```ts
  supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/retorno`,
      scopes: "https://www.googleapis.com/auth/calendar.freebusy",
      queryParams: { hd: "polijunior.com.br", access_type: "offline" },
    },
  });
  ```

  O `hd` só filtra a tela do Google; quem garante o domínio é o hook do PR 2.1.

- Rota `/auth/retorno`: com a sessão nova, se vier `provider_refresh_token`, manda para a server
  function `agendaGuardarToken` (cifra e grava em `google_contas`, ver fase 3) e segue para
  Início/Indicadores. O Google só devolve o refresh token no primeiro consentimento; se faltar e
  não houver token guardado, o botão "Reconectar agenda" refaz o login com `prompt: "consent"`.
- Contas que já existem com o mesmo e-mail @polijunior são ligadas pelo Supabase (mesmo `user_id`,
  contatos preservados). **Testar com uma conta real** antes de publicar.
- Erros do Google e do hook em português ("Esta conta não está liberada. Peça acesso ao gerente.").
- e2e: o mock responde `/auth/v1/authorize` redirecionando de volta com uma sessão falsa;
  `auth.spec.ts` cobre entrar, conta não liberada e retorno sem refresh token.

**PR 2.3 `feat(auth)!: desliga o login por senha`** (depois que todos entraram uma vez com o Google)

- Script único (admin API) troca a senha de todas as contas por uma aleatória, menos a de
  emergência, para senhas antigas não abrirem mais a porta pela API.
- Conta de emergência: só o dono da plataforma, senha forte + MFA TOTP do Supabase, formulário
  em `/auth?emergencia` (fora da tela normal).
- Remove `ADMIN_PASSWORD` e `admin_attempts` do fluxo de exclusão (D6): exclusões passam a usar
  `assertPermission` + `useConfirm` com palavra + `acessos_log`. A remoção da tabela vai numa
  migração própria, depois do deploy.
- Rodapé `BREAKING CHANGE: login só com conta Google @polijunior.com.br`.

**PR 2.4 `feat(configuracoes): mostra o perfil com a foto do google`** (tela)

- `profiles` (migração): `bio text` (até 160), `linkedin_url text`, `whatsapp text`,
  `cargo_titulo text` (ex. "Diretor de Negócios"). A foto **não é editável** no app.
- Cartão "Meu perfil" em Configurações: foto e e-mail do Google (só leitura, com o aviso "para
  trocar a foto, troque na sua conta Google"), nome, título, bio, LinkedIn, WhatsApp.
- Componente compartilhado `src/components/Avatar.tsx`: mostra `avatar_url` e, se não houver ou a
  imagem falhar (`onError`), as iniciais (`initials` em `src/lib/perfil.ts`, testada), com tokens do
  design system. Usado na barra lateral (troca o e-mail por foto + nome), em Acessos, no painel,
  no placar e na agenda.

### Fase 3 — Agenda dos CNs (Google Calendar)

**Como funciona para o hunter**

1. A agenda já fica conectada no login com Google (sem passo extra para a maioria).
2. O hunter abre **Agenda** (menu Prospecção), escolhe os próximos dias (padrão: 5 dias úteis),
   a duração da AT (30/45/60 min) e, se quiser, CNs específicos.
3. A tela mostra os horários em que **o hunter está livre e pelo menos um CN também**, com a foto
   dos CNs livres em cada horário, ordenados pelo mais cedo e pelo número de CNs livres.
4. O hunter marca 2 ou 3 horários e clica em **"Copiar sugestão"**: o texto pronto vai para a
   mensagem do prospect ("terça (25/11) às 14h ou quarta (26/11) às 10h?").
5. Quando o prospect aceita um horário, **"Registrar AT neste horário"** abre o formulário de
   `/ats` já com CN, data e hora preenchidos.

**PR 3.1 `feat(db): guarda o acesso à agenda google`** (entra antes do PR 2.2)

- Tabela `google_contas` (`user_id` pk, `google_email`, `refresh_token_cifrado`, `escopos`,
  `conectado_em`, `erro`), RLS ligada **sem nenhuma policy** (só service role) e RPC
  `agenda_status()` que devolve ao cliente só "conectada: sim/não" de cada pessoa.
- `profiles`: `agenda_inicio`/`agenda_fim` (janela de trabalho, padrão 08:00–19:00).
- Segredos novos na Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (o mesmo cliente OAuth do
  Supabase, para renovar o token) e `GOOGLE_TOKEN_KEY` (chave AES-256). Nunca no repositório.
- `src/lib/google.server.ts`: cifrar/decifrar (AES-GCM, `node:crypto`), renovar access token,
  `freeBusy`; URL base por variável para o e2e apontar para um mock. Token revogado ou conta
  suspensa → grava `erro` e a pessoa vê "Reconectar agenda".
- `agendaGuardarToken` (usada pelo `/auth/retorno`) e `agendaDesconectar` (revoga no Google e
  apaga a linha) em `src/lib/agenda.functions.ts`.

**PR 3.2 `feat(agenda): calcula horários livres em comum`** (regra pura + server function)

- `src/lib/agenda.ts`, sem I/O, com testes:
  - `freeSlots({ busy, janela, duracao, passo, dias, holidays, agora })` — subtrai os ocupados da
    janela de trabalho, pula fins de semana e feriados (o mesmo Set de `holidays` de
    `cadencia.ts`), descarta horários que já passaram e dá folga mínima (ex.: 2 h a partir de
    agora);
  - `atsComoOcupado(ats, duracao)` — as ATs `agendada` de cada CN (`ats.cn_login`,
    `agendada_atual`) também bloqueiam o horário, mesmo que não estejam na agenda Google;
  - `commonSlots(hunter, cns)` — interseção hunter × cada CN, com a lista de CNs livres por
    horário; `rankSlots` ordena (pode pesar para equilibrar: CN com menos ATs na semana primeiro);
  - `suggestionText(slots)` — o texto em português para copiar.
  - Fuso sempre `America/Sao_Paulo`.
- `agendaHorarios` (`assertPermission('agenda.buscar')`): CNs vêm de `time_comercial`
  (`papel = 'cn'`, `ativo`, com `user_id`) cruzado com `agenda.receber_at`; chama `freeBusy` uma
  vez por pessoa em paralelo e devolve **só os horários livres em comum** — o cliente nunca
  recebe a agenda ocupada de ninguém.
- CN sem agenda conectada aparece como "agenda não conectada" (não some em silêncio).

**PR 3.3 `feat(agenda): tela de horários com os cns`** (tela; capturas; e2e)

- Rota `src/routes/_authenticated/agenda.tsx`, componentes em `src/components/agenda/`
  (`FiltrosAgenda`, `GradeHorarios`, `SugestaoCopiar`). Seguir `docs/redesign/DESIGN.md`, só
  tokens de `src/styles.css`, só desktop.
- e2e `agenda.spec.ts` com mock do Google (`e2e/mock-google.mjs`) e o relógio fixo de 12/11/2026.
- Documentar no `AGENTS.md` (seção Arquitetura) login, cargos, permissões e agenda.

### Fase 4 — Depois de medir o uso (opcional)

- **Criar o evento da AT**: ao registrar a AT em `/ats`, oferecer "criar evento na agenda do CN"
  com link do Meet e o prospect como convidado (escopo extra `calendar.events`, pedido só a quem
  usar). Guardar `ats.google_event_id`; remarcar/cancelar no `/ats` atualiza o evento. Cuidado
  para não duplicar o que o Pipedrive (task "AT - 16h30 @hunter") já faz.
- **Indicador novo**: tempo entre "respondeu" e "AT marcada", para ver se a agenda encurtou o
  caminho até a reunião.

---

## 4. Ordem sugerida e tamanho

| Ordem | PR                                                  | Depende de    | Esforço |
| ----- | --------------------------------------------------- | ------------- | ------- |
| 0     | Pedir o projeto no Google Cloud da Poli (D7)        | admin da Poli | —       |
| 1     | 1.1 cargos e `has_permission`                       | —             | M       |
| 2     | 1.2 trocar `has_role` por permissões                | 1.1           | M       |
| 3     | 1.3 tela de Acessos (com lista de liberados)        | 1.2           | M       |
| 4     | 3.1 guardar token da agenda                         | —             | P       |
| 5     | 2.1 hook de domínio/liberados + nome e foto         | 1.3           | P       |
| 6     | 2.2 login com Google                                | 2.1, 3.1, GCP | M       |
| 7     | 2.4 perfil com foto do Google                       | 2.2           | P       |
| 8     | 2.3 desligar senha (depois de todos entrarem 1 vez) | 2.2           | P       |
| 9     | 3.2 + 3.3 agenda                                    | 2.2           | G       |
| 10    | Fase 4                                              | uso medido    | —       |

## 5. Riscos e cuidados

- **Trancar-se para fora**: a migração 1.1 mantém o dono da plataforma com tudo, e a conta de
  emergência existe antes de desligar a senha (2.3). Testar migrações em branch do Supabase (ou
  local) antes do `db:push` em produção.
- **Saída de alguém da Poli**: suspender a conta no Workspace impede novos logins, mas não derruba
  uma sessão aberta. Por isso "Desativar" em Acessos continua necessário.
- **Contas com e-mail pessoal**: rodar a consulta do PR 2.1 e migrar antes do 2.3.
- **Refresh token do Google**: só vem no primeiro consentimento; sem ele, "Reconectar agenda" com
  `prompt: "consent"`. Token revogado → `erro` e aviso na tela, nunca falha calada.
- **Foto do Google**: se a pessoa não tiver foto ou o Workspace esconder, cai nas iniciais.
- **RLS de `profiles`**: hoje qualquer logado lê todos os perfis. WhatsApp e LinkedIn entram aí;
  confirmar que isso é aceitável para a equipe ou mover os contatos pessoais para uma view só com
  nome e foto.
- **Testes de ponta a ponta**: o Playwright não passa pela tela real do Google; o mock simula o
  retorno do login. Cada fase acrescenta rotas ao mock (`has_permission`, authorize, Google).
  Nunca pular teste para ficar verde.
- **LGPD**: a agenda lê só livre/ocupado e nada é guardado além do token; dizer isso na tela de
  login ("pedimos para ver se você está livre ou ocupado, nunca o conteúdo dos eventos").

## 6. O que preciso de você para começar

1. Respostas para D1–D8 (pode ser só "segue as recomendações").
2. Quem na Poli tem acesso de administrador ao Google Workspace/Google Cloud (para o projeto OAuth
   interno). É o que mais pode atrasar.
3. A lista de quem é CN e quem é LO/Gerente hoje (para os dados iniciais da migração 1.1).
4. Qual e-mail fica como conta de emergência do dono da plataforma.
