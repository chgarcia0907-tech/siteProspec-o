# Plano: acessos por cargo, perfil com foto e agenda dos CNs

Data: 21/11/2026 · Branch de trabalho: `dev` · Status: proposta, aguardando as decisões da seção 1

Objetivo de produto: fazer o hunter marcar mais ATs. A agenda dos CNs é a parte que mexe direto
na métrica (menos idas e vindas para achar horário). O controle de acesso e o perfil são a base
para ela: a plataforma precisa saber quem é CN para saber de quem ler a agenda.

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
| Perfil            | `profiles` com `email`, `display_name`, `message_name`, `gender`; leitura liberada para todo logado                   | migração inicial, `src/routes/_authenticated/configuracoes.tsx`                                  |
| Navegação         | Grupo "Administração" aparece só para `isAdmin`                                                                       | `src/components/AppSidebar.tsx`, `src/routes/_authenticated/route.tsx`                           |
| Calendário        | Nenhuma integração                                                                                                    | —                                                                                                |
| Time comercial    | `time_comercial` já diz quem é hunter e quem é CN (`papel`), com login, apelidos e ids do Pipedrive                   | `supabase/migrations/20261118164342_ats_registro_e_eventos.sql`                                  |
| ATs               | `ats` guarda hunter, CN (`cn_login`) e o horário atual (`agendada_atual`) de cada AT; editar evento é "dono ou admin" | mesma migração, `src/lib/ats.ts`, `/ats`                                                         |

> O plano reaproveita `time_comercial` e `ats`: a lista de CNs da agenda sai daí, as ATs já
> marcadas de cada CN contam como horário ocupado, e o horário escolhido abre o registro de AT
> já preenchido.

---

## 1. Decisões antes de começar (precisam da sua resposta)

| #   | Decisão                                                                 | Recomendação                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Login com Google** (conta @polijunior.com.br) como caminho principal? | **Sim.** É o login mais seguro que dá para ter sem custo (a senha e o 2FA ficam com o Google Workspace da Poli) e é o mesmo consentimento que a agenda vai pedir. Senha continua existindo, com regras fortes, para quem precisar.                                          |
| D2  | Cadastro aberto ou **só por convite**?                                  | **Convite pelo gerente** (e-mail + cargo já escolhidos). Enquanto o convite não está pronto, travar o cadastro aberto ao domínio `@polijunior.com.br`.                                                                                                                      |
| D3  | Uma pessoa tem **um cargo** ou vários?                                  | **Um cargo por pessoa** (Hunter, CN ou LO/Gerente). Mais simples de entender e de auditar. Se um CN também prospectar, o cargo CN ganha a permissão de prospecção.                                                                                                          |
| D3b | Onde mora o cargo, já que `time_comercial.papel` existe?                | **`profiles.cargo_id` manda nas permissões**; `time_comercial` continua sendo o cadastro do Pipedrive (login, apelidos, ids). A migração 2.1 copia `papel` para `cargo_id` e um trigger mantém `papel` igual ao cargo (hunter/cn) para a tela de ATs e a carga não mudarem. |
| D4  | Permissões **fixas no código** ou **editáveis numa matriz**?            | **Matriz editável** (cargo × permissão) na tela de Acessos, com a lista de permissões fixa no código. Você aloca cargos e ajusta o que cada cargo pode, sem deploy.                                                                                                         |
| D5  | O que vira o `admin` atual?                                             | O `admin` vira o cargo **LO/Gerente** com todas as permissões de hoje. Fica um papel técnico **"dono da plataforma"** (só ele gerencia a matriz de permissões), para ninguém se trancar para fora.                                                                          |
| D6  | A `ADMIN_PASSWORD` compartilhada continua?                              | **Substituir na fase 5** por reautenticação da própria pessoa (código do 2FA ou senha dela). Senha compartilhada não diz quem fez a exclusão. Até lá, continua.                                                                                                             |
| D7  | **Projeto no Google Cloud** em nome de quem?                            | Criar o projeto **dentro da organização Google da Poli Júnior**, com tela de consentimento **"Interna"**. Assim os escopos de agenda não passam pela verificação do Google e só contas @polijunior entram. Precisa de alguém com acesso de admin do Workspace/GCP da Poli.  |
| D8  | A agenda **lê** só livre/ocupado ou também **cria o evento** da AT?     | **Fase 4: só livre/ocupado.** Fase 5 (opcional): criar o evento na agenda do CN com link do Meet ao registrar a AT.                                                                                                                                                         |

---

## 2. Visão da arquitetura

```
                 ┌──────────────────────────── Supabase ────────────────────────────┐
 Navegador       │ auth.users ── profiles (+ cargo, foto, bio, linkedin...)         │
 (React Query) ──┤ cargos ── cargo_permissoes          has_permission(uid, perm)   │
                 │ storage: bucket "avatars" (<uid>/avatar.webp)                    │
                 │ google_contas (refresh token cifrado, só service role)           │
                 └──────────────────────────────────────────────────────────────────┘
                          ▲                                   ▲
 Server functions ────────┘ assertPermission(ctx, "...")      │ service role
 (TanStack Start)  agenda.functions.ts ──► Google Calendar API: freeBusy (só livre/ocupado)
                   /api/google/conectar e /api/google/callback (OAuth da agenda)
```

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

### Fase 1 — Login mais seguro (sem mudar cargos ainda)

**PR 1.1 `feat(auth): exige senha forte e restringe o cadastro ao domínio da poli`**

- Supabase (painel → Authentication): senha mínima **10** caracteres com letras e números;
  "Secure password change" e "Secure email change" ligados; confirmação de e-mail obrigatória;
  limites de tentativa (rate limits) revisados. _Proteção contra senhas vazadas (HaveIBeenPwned)
  só existe no plano Pro do Supabase: avaliar._
- Migração: hook `before_user_created` (ou trigger em `auth.users`) que recusa e-mail fora de
  `@polijunior.com.br`. Regra do domínio também em `src/lib/acessos.ts` (`allowedEmail`) para a
  mensagem de erro na tela.
- `AuthForm`: `minLength={10}`, medidor simples de força (regra pura `passwordIssues` em
  `src/lib/acessos.ts`, testada), mensagens em português para os erros do Supabase.
- e2e: `auth.spec.ts` novo cobrindo senha fraca e e-mail fora do domínio.

**PR 1.2 `feat(auth): adiciona recuperação de senha`**

- "Esqueci minha senha" no `/auth` → `resetPasswordForEmail`; rota `/auth/nova-senha` que trata
  o evento `PASSWORD_RECOVERY` e chama `updateUser({ password })`.
- Template de e-mail do Supabase em português.

**PR 1.3 `feat(auth): entra com a conta google da poli`** _(depende de D1 e D7)_

- Google Cloud: projeto na organização da Poli, consentimento **Interno**, cliente OAuth Web com
  redirect `https://ctxsmboaqbjgslctojeq.supabase.co/auth/v1/callback`.
- Supabase: provider Google ligado com client id/secret.
- `/auth`: botão "Entrar com Google" (`signInWithOAuth({ provider: "google", options: { queryParams: { hd: "polijunior.com.br" } } })`).
  O `hd` só filtra a tela do Google; quem garante o domínio é o hook do PR 1.1.
- Contas que já existem com o mesmo e-mail são ligadas automaticamente pelo Supabase (identity
  linking por e-mail confirmado). Testar com uma conta real antes de publicar.

**PR 1.4 `feat(auth): ativa verificação em duas etapas para quem usa senha`**

- MFA TOTP do Supabase (`supabase.auth.mfa.enroll/challenge/verify`), cadastro em Configurações.
- Obrigatório para o cargo LO/Gerente quando entrar por senha (checar `aal2` no
  `_authenticated/route.tsx` e no `assertPermission` das permissões sensíveis). Quem entra pelo
  Google herda o 2FA do Workspace.

### Fase 2 — Cargos e permissões

**PR 2.1 `feat(db): cria cargos, matriz de permissões e has_permission`** (via `/nova-migracao`)

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

- RLS: `cargos` e `cargo_permissoes` com leitura para logados e escrita só service role.
  `profiles_update_own` passa a **impedir** que a pessoa troque o próprio `cargo_id` (policy com
  `WITH CHECK` comparando com o valor atual, ou coluna fora do `GRANT UPDATE`).
- Dados iniciais: os três cargos; usuários com `user_roles.admin` → `cargo_id = 'gerente'`;
  quem está em `time_comercial` com `papel = 'cn'` → `cn`; os demais → `hunter`. O papel `admin`
  continua existindo como "dono da plataforma".
- Trigger mantém `time_comercial.papel` igual ao cargo (hunter/cn) quando a pessoa tem
  `user_id` ligado, para a tela de ATs e a carga da planilha seguirem funcionando sem mudança.
- `bun run db:types` e testes de `acessos.ts`.

Permissões iniciais (`PERMISSOES`, `src/lib/acessos.ts`):

| Permissão                                                        |         Hunter          | CN  | LO/Gerente |
| ---------------------------------------------------------------- | :---------------------: | :-: | :--------: |
| `prospeccao.usar` — Início, Envios, Empresas, Contatos, Importar |            ✓            |  ✓  |     ✓      |
| `agenda.buscar` — buscar horários com os CNs                     |            ✓            |  ✓  |     ✓      |
| `agenda.receber_at` — aparece como CN disponível na busca        |                         |  ✓  |     ✓      |
| `indicadores.ver`                                                |                         |  ✓  |     ✓      |
| `competicao.ver` — placar e atividade                            |                         |  ✓  |     ✓      |
| `painel.periodos` — períodos, grupos, membros, transferências    |                         |     |     ✓      |
| `painel.setores` — setores e cadências                           |                         |     |     ✓      |
| `painel.metas`                                                   |                         |     |     ✓      |
| `painel.auditoria`                                               |                         |     |     ✓      |
| `contatos.excluir` e `feriados.editar`                           |                         |     |     ✓      |
| `acessos.gerenciar` — convidar, alocar cargos, desativar pessoas |                         |     |     ✓      |
| `acessos.permissoes` — editar esta matriz                        | só "dono da plataforma" |     |            |

**PR 2.2 `refactor(painel): troca has_role(admin) por permissões`**

- `assertPermission(ctx, perm)` único em `src/lib/acessos.server.ts`, substituindo os
  `assertAdmin` de `painel.functions.ts`, `periodos.functions.ts`, `setores.functions.ts`,
  `admin.functions.ts`. `painelIsAdmin` vira `minhasPermissoes` (devolve a lista do usuário).
- SQL: `public.ranking()` passa a usar `has_permission(auth.uid(), 'competicao.ver')`
  (lembrar da regra do Hackathon que anda junto com o TS); as políticas de `ats`/`at_eventos`
  que hoje dizem "dono ou admin" passam a "dono ou `ats.gerenciar`" (permissão nova, do
  LO/Gerente e, se você quiser, do CN).
- `AppSidebar` monta os grupos a partir das permissões; redirecionamento pós-login
  (`AuthForm`) também (gerente → Indicadores, demais → Início).
- e2e: o mock (`e2e/mock-supabase.mjs`) responde `has_permission`; um teste por cargo em
  `navegacao.spec.ts` (o que cada um vê no menu e o bloqueio por URL direta).

**PR 2.3 `feat(acessos): tela de pessoas e cargos no painel`** (tela; capturas antes/depois)

- Nova aba "Acessos" no `/painel` (ou menu próprio em Administração, como Indicadores):
  - lista de pessoas: foto, nome, e-mail, cargo (select), login do `time_comercial` e apelidos
    (hoje só editáveis pela carga), status da agenda (conectada ou não), último acesso,
    ativo/desativado;
  - **convidar**: e-mail + cargo → `supabase.auth.admin.inviteUserByEmail` com o cargo em
    `data`, lido pelo `handle_new_user`;
  - **desativar** em vez de excluir (ban do Supabase Auth): mantém contatos e histórico;
  - matriz cargo × permissão (só para o dono da plataforma), com `useConfirm` ao salvar.
- Server functions em `src/lib/acessos.functions.ts` (`assertPermission` antes do service role).
- Toda troca de cargo grava em `acessos_log` (quem, quando, de → para).

### Fase 3 — Perfil com foto

**PR 3.1 `feat(db): adiciona foto e dados de perfil`**

- `profiles`: `avatar_path text`, `bio text` (até 160), `linkedin_url text`, `whatsapp text`,
  `cargo_titulo text` (texto livre, ex. "Diretor de Negócios"), `atualizado_em`.
- Storage: bucket `avatars` **privado**; policies em `storage.objects`: logado lê tudo do bucket;
  cada pessoa grava/apaga só em `<seu uid>/`. Limite de 2 MB e só `image/webp|png|jpeg`.
- Regras puras em `src/lib/perfil.ts`: validação de LinkedIn/WhatsApp, iniciais para o avatar
  sem foto, nome exibido (`display_name` → e-mail).

**PR 3.2 `feat(configuracoes): edita perfil com foto`** (tela)

- Cartão "Meu perfil" em Configurações: foto com recorte quadrado e redução no navegador para
  256×256 WebP (canvas, sem biblioteca nova), nome, título, bio, LinkedIn, WhatsApp.
- Componente compartilhado `src/components/Avatar.tsx` (foto ou iniciais, tokens do design
  system), usado na barra lateral (troca o e-mail pela foto + nome), no painel, no placar e na
  agenda.
- e2e: mock do Storage (`/storage/v1/object/...`) e teste do upload em `configuracoes.spec.ts`.

### Fase 4 — Agenda dos CNs (Google Calendar)

**Como funciona para o hunter**

1. Na primeira vez, o hunter e cada CN clicam em "Conectar minha agenda Google" (uma vez só).
2. O hunter abre **Agenda** (menu Prospecção), escolhe os próximos dias (padrão: 5 dias úteis),
   a duração da AT (30/45/60 min) e, se quiser, CNs específicos.
3. A tela mostra os horários em que **o hunter está livre e pelo menos um CN também**, com a
   foto dos CNs livres em cada horário, ordenados pelo mais cedo e pelo número de CNs livres.
4. O hunter marca 2 ou 3 horários e clica em **"Copiar sugestão"**: o texto pronto vai para a
   mensagem do prospect ("terça (25/11) às 14h ou quarta (26/11) às 10h?").
5. Quando o prospect aceita um horário, **"Registrar AT neste horário"** abre o formulário de
   `/ats` já com CN, data e hora preenchidos.

**PR 4.1 `feat(db): guarda a conexão com o google agenda`**

- Tabela `google_contas` (`user_id` pk, `google_email`, `refresh_token_cifrado`, `escopos`,
  `conectado_em`, `erro`), RLS ligada **sem nenhuma policy** (só service role) e view/RPC
  `agenda_status()` que devolve ao cliente apenas "conectada: sim/não" de cada pessoa.
- `profiles`: `agenda_inicio`/`agenda_fim` (janela de trabalho, padrão 08:00–19:00),
  respeitada no cálculo.
- Segredos novos na Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`
  (chave AES-256 para cifrar o refresh token). Nunca no repositório.

**PR 4.2 `feat(agenda): conecta a agenda google`**

- Fluxo OAuth próprio (independente de como a pessoa fez login):
  `src/routes/api/google/conectar.ts` → Google com `scope=calendar.freebusy`,
  `access_type=offline`, `prompt=consent`, `state` assinado (uid + nonce + validade, contra
  CSRF) → `src/routes/api/google/callback.ts` troca o código, cifra (AES-GCM, `node:crypto`) e
  grava em `google_contas`. Desconectar revoga o token no Google e apaga a linha.
- Cliente Google em `src/lib/google.server.ts` (renovar access token, `freeBusy`), com a URL base
  vinda de variável para o e2e apontar para um mock.
- Botão em Configurações ("Agenda Google: conectada como fulano@polijunior.com.br").

**PR 4.3 `feat(agenda): calcula horários livres em comum`** (regra pura + server function)

- `src/lib/agenda.ts`, sem I/O, com testes:
  - `freeSlots({ busy, janela, duracao, passo, dias, holidays, agora })` — subtrai os ocupados
    da janela de trabalho, pula fins de semana e feriados (o mesmo Set de `holidays` de
    `cadencia.ts`), descarta horários que já passaram e dá folga mínima (ex.: 2 h a partir de
    agora);
  - `commonSlots(hunter, cns)` — interseção hunter × cada CN, com a lista de CNs livres por
    horário; `rankSlots` ordena (pode pesar para equilibrar: CN com menos ATs na semana primeiro);
  - `atsComoOcupado(ats, duracao)` — as ATs `agendada` de cada CN (`ats.cn_login`,
    `agendada_atual`) também bloqueiam o horário, mesmo que não estejam na agenda Google;
  - `suggestionText(slots)` — o texto em português para copiar.
  - Fuso sempre `America/Sao_Paulo`.
- `src/lib/agenda.functions.ts`: `agendaHorarios` (`assertPermission('agenda.buscar')`) carrega
  os tokens do hunter e dos CNs com `agenda.receber_at` e agenda conectada, chama
  `freeBusy` uma vez por pessoa em paralelo e devolve **só os horários livres em comum** — o
  cliente nunca recebe a agenda ocupada de ninguém.
- Os CNs vêm de `time_comercial` (`papel = 'cn'`, `ativo`, com `user_id`) cruzado com a
  permissão `agenda.receber_at`.
- CN sem agenda conectada aparece como "agenda não conectada" (não some em silêncio).

**PR 4.4 `feat(agenda): tela de horários com os cns`** (tela; capturas; e2e)

- Rota `src/routes/_authenticated/agenda.tsx`, componentes em `src/components/agenda/`
  (`FiltrosAgenda`, `GradeHorarios`, `SugestaoCopiar`). Seguir `docs/redesign/DESIGN.md`, só
  tokens de `src/styles.css`, só desktop.
- e2e `agenda.spec.ts` com mock do Google (`e2e/mock-google.mjs`) e o relógio fixo de 12/11/2026.
- Documentar no `AGENTS.md` (seção Arquitetura) as regras novas, como nas outras features.

### Fase 5 — Fechamento (opcional, depois de medir o uso)

- **Criar o evento da AT**: ao registrar a AT em `/ats`, oferecer "criar evento na agenda do CN"
  com link do Meet e o prospect como convidado (escopo extra `calendar.events`, pedido só a quem
  usar). Guardar `ats.google_event_id`; remarcar/cancelar no `/ats` atualiza o evento. Cuidado
  para não duplicar o que o Pipedrive (task "AT - 16h30 @hunter") já faz.
- **Trocar a `ADMIN_PASSWORD`** por reautenticação da própria pessoa (`aal2`/senha), mantendo o
  log de quem excluiu.
- **Indicador novo**: tempo entre "respondeu" e "AT marcada", para ver se a agenda encurtou o
  caminho até a reunião.

---

## 4. Ordem sugerida e tamanho

| Ordem | PR                                            | Tipo                  | Esforço |
| ----- | --------------------------------------------- | --------------------- | ------- |
| 1     | 1.1 senha forte + domínio                     | dados + tela pequena  | P       |
| 2     | 1.2 recuperar senha                           | tela                  | P       |
| 3     | 2.1 cargos e `has_permission`                 | dados                 | M       |
| 4     | 2.2 trocar `has_role` por permissões          | refactor              | M       |
| 5     | 2.3 tela de Acessos                           | tela                  | M       |
| 6     | 3.1 + 3.2 perfil com foto                     | dados + tela          | M       |
| 7     | 1.3 login com Google (precisa do GCP da Poli) | config + tela pequena | P       |
| 8     | 4.1 → 4.4 agenda                              | dados + server + tela | G       |
| 9     | 1.4 MFA para gerentes                         | tela + guarda         | P       |
| 10    | Fase 5                                        | —                     | —       |

O login com Google (1.3) e a agenda (4.x) dependem do mesmo projeto no Google Cloud; vale pedir o
acesso na primeira semana para não travar a fase 4.

## 5. Riscos e cuidados

- **Trancar-se para fora**: a migração 2.1 precisa manter o dono da plataforma com tudo; testar em
  branch do Supabase (ou local) antes do `db:push` em produção.
- **Refresh token do Google**: só vem no primeiro consentimento (`prompt=consent` resolve);
  token revogado ou senha trocada → marcar `erro` e pedir reconexão na tela, não falhar calado.
- **RLS de `profiles`**: hoje qualquer logado lê todos os perfis. WhatsApp e LinkedIn entram aí;
  confirmar que isso é aceitável para a equipe ou mover os contatos pessoais para uma view só
  com nome e foto.
- **Testes de ponta a ponta**: cada fase acrescenta rotas ao mock (`has_permission`, Storage,
  Google). Nunca pular teste para ficar verde.
- **LGPD**: a agenda lê só livre/ocupado e nada é guardado além do token; dizer isso na tela de
  conexão.

## 6. O que preciso de você para começar

1. Respostas para D1–D8 (pode ser só "segue as recomendações").
2. Quem na Poli tem acesso de administrador ao Google Workspace/Google Cloud (para o projeto OAuth
   interno).
3. A lista de quem é CN e quem é LO/Gerente hoje (para os dados iniciais da migração 2.1).
