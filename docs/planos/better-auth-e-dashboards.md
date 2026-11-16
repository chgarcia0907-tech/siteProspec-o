# Plano: Better Auth e dashboards personalizáveis

Branch: `feat/better-auth-dashboards` (a partir de `origin/dev` em `391114c`; o pedido citava `8c2c2ce`,
mas a `dev` já avançou: PRs #25, #27 e #28 entraram). Plano de **planejamento apenas**: nenhum código,
migração, dependência, variável de ambiente ou dado foi alterado. As consultas ao banco de produção
(`ctxsmboaqbjgslctojeq`) foram só de leitura e estão resumidas na seção 1.1.

Convenções: ✔ combina · ⚠ combina sob condição · ✖ não combina. "Verificar" marca o que a documentação
não confirma e precisa de prova na Fase 0 (seção 4).

---

## 0. Resumo e decisões em aberto

**Resumo**

1. O banco de produção é pequeno (18 contas, 3.046 contatos, 1,4 MB na maior tabela): migrar a
   identidade é viável com SQL puro no mesmo Postgres, sem script externo, e com os mesmos UUIDs.
2. Todas as 18 contas são e-mail e senha com hash bcrypt, todas confirmadas. **8 das 18 estão banidas**
   no Supabase; o guia oficial de migração as pula, mas os contatos delas dependem do `user_id`, então
   elas precisam migrar (como banidas).
3. Estratégia de RLS recomendada: **manter RLS** com um JWT emitido pelo Better Auth e aceito pelo
   Supabase como emissor OIDC personalizado (opção C do pedido, implementada como "A1"). Não está
   confirmado que funciona com Better Auth: a **Fase 0 é uma prova de conceito obrigatória** antes de
   qualquer migração. Plano B: chave de assinatura própria importada no Supabase (A2); plano C: tirar o
   acesso direto do navegador (B), que contradiz o AGENTS.md.
4. O papel de admin passa a ter **uma fonte única**, `ba."user".role` (plugin admin do Better Auth).
   `public.user_roles` vira projeção mantida por trigger até a limpeza, o que mantém o rollback seguro.
5. Os administradores gerenciam acessos dentro da plataforma (aba "Usuários e acesso"), com proteção do
   último admin e trilha de auditoria. Nada de e-mail fixo em migração ou trigger.
6. Dashboards: um **motor de métricas** em `src/lib` transforma contatos em eventos (data + dimensões),
   reaproveitando `computeDashboard`, `stageScoreDate`, `responseDate` e `resolveGoal`; testes de
   equivalência garantem que cada número bate com Indicadores, Envios de hoje e o placar.
7. A agregação continua em TypeScript no servidor (o volume real é de milhares de linhas); critério e
   método de medição para migrar para SQL estão na seção 2.5.
8. Ambiente de teste: **projeto Supabase de staging separado** + variáveis do Vercel escopadas à branch.
   Risco a auditar antes de tudo: as variáveis de Preview atuais podem apontar para produção.
9. 11 fases pequenas; a Parte 1 vem primeiro, mas o motor de métricas (fase 5) é código puro e pode andar
   em paralelo.
10. Nada neste plano depende de testar em produção; o corte de produção só acontece depois da aprovação
    na Preview e tem rollback sem perda de dados dos hunters.

**Decisões em aberto**

| #   | Decisão                                         | Opções                                                                             | Recomendação                                                                      | O que trava se adiar         |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| 1   | Como o PostgREST aceita o JWT                   | A1 OIDC personalizado · A2 chave própria importada · B sem acesso direto           | A1, validada na Fase 0; A2 de reserva                                             | Toda a Parte 1               |
| 2   | Ambiente de teste do banco                      | Supabase Branching · projeto de staging separado                                   | Staging separado                                                                  | Fase 0 em diante             |
| 3   | Provedor de e-mail (confirmação e redefinição)  | Resend · SMTP do Google Workspace · manter o do Supabase (impossível após o corte) | Resend (gratuito até 3 mil e-mails/mês); precisa de DNS do domínio                | Cadastro e "esqueci a senha" |
| 4   | Destino do `ADMIN_PASSWORD`                     | Manter · trocar por reautenticação com a senha do próprio admin                    | Manter no corte; trocar na fase 4                                                 | Só a fase 4                  |
| 5   | Contas banidas (8)                              | Migrar como banidas · não migrar                                                   | Migrar como banidas (preserva FKs)                                                | Corte                        |
| 6   | Cadastro aberto restrito a `@polijunior.com.br` | Igual ao premissa · convite · lista de permissão                                   | Premissa; contas existentes de outros domínios (4 gmail, 1 usp) migram como estão | Fase 2                       |
| 7   | Hash de senha                                   | Manter bcrypt · rehash para scrypt no próximo login                                | Manter bcrypt; rehash oportunista depois                                          | Nada                         |
| 8   | Biblioteca do grid                              | `react-grid-layout` · `dnd-kit` + CSS grid própria                                 | `react-grid-layout` (arrastar e redimensionar prontos)                            | Fase 6                       |
| 9   | Gráfico dentro do card ou reutilizável          | Spec embutida no card · tabela `charts` separada                                   | Embutida (copiar é o único reuso)                                                 | Fase 6                       |
| 10  | O que o hunter vê da equipe                     | Só ATs por dia/semana (como `/inicio`) · mais métricas                             | Só ATs na v1                                                                      | Fase 9                       |
| 11  | Conversão entre etapas                          | Por evento no intervalo · por coorte                                               | Evento por padrão; coorte só no card "Coortes"                                    | Fase 5                       |
| 12  | Compartilhar "com pessoas escolhidas" na v1     | Sim · só "com todos"                                                               | Sim (tabela pequena)                                                              | Fase 9                       |
| 13  | Variáveis de Preview apontam para produção?     | Auditar agora                                                                      | Auditar antes da Fase 0                                                           | Toda Preview                 |
| 14  | Quando apagar `auth.users`                      | Nunca · após N dias                                                                | Reter por 30 dias úteis após o corte; decisão explícita                           | Fase 4                       |
| 15  | Quem pode compartilhar "com todos"              | Qualquer um · só admin                                                             | Qualquer um (o dado não vai no dashboard)                                         | Fase 9                       |

---

## 1. Parte 1: gestão de acessos

### 1.1 Inventário do acoplamento

**Produção hoje (consultas só de leitura em 16/11/2026)**

| Fato                                    | Valor                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contas em `auth.users`                  | 18 (13 `@polijunior.com.br`, 4 `@gmail.com`, 1 `@usp.br`)                                               |
| Provedor                                | 100% e-mail (`auth.identities`), 0 SSO                                                                  |
| Confirmadas                             | 18 de 18                                                                                                |
| Hash                                    | 18 de 18 começam com `$2` (bcrypt)                                                                      |
| **Banidas** (`banned_until` preenchido) | **8**                                                                                                   |
| Admins (`user_roles`)                   | 2: `guilherme.jeronimo@polijunior.com.br` e uma conta `@gmail.com` (promovida à mão, não pelo trigger)  |
| Volume                                  | `contacts` 3.046 linhas (1,4 MB), `companies` 35, `period_snapshots` 17, `period_members` 23, `goals` 1 |

**Banco (confirmado em `pg_constraint`, `pg_policies` e `information_schema.triggers`)**

| Objeto                                       | Detalhe                                                                                                                                                                                    | O que muda                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| FKs para `auth.users` (`ON DELETE CASCADE`)  | `profiles.id`, `settings.user_id`, `templates.user_id`, `contacts.user_id`, `user_roles.user_id`, `companies.user_id`, `goals.user_id`                                                     | Passam a apontar para `ba."user"(id)` (seção 1.3)       |
| FK indireta                                  | `period_members.user_id → profiles(id)`                                                                                                                                                    | Nada                                                    |
| Sem FK                                       | `period_snapshots.hunter_id`, `admin_attempts.user_id`                                                                                                                                     | Nada; os UUIDs continuam valendo                        |
| Policies com `auth.uid()`                    | `contacts` (select/insert/update), `companies`, `profiles` (insert/update), `settings`, `templates`, `user_roles` (leitura própria)                                                        | Nada, desde que o JWT tenha `sub` = UUID do usuário     |
| Policies `USING (true)` para `authenticated` | `profiles`, `periods`, `groups`, `subgroups`, `period_members`, `period_snapshots`, `holidays`, `sectors`, `sector_templates`, `message_templates`, `competition_settings`, `sync_log`     | Nada                                                    |
| `public.ranking(date)`                       | `SECURITY DEFINER`, chama `has_role(auth.uid(), 'admin')` (`supabase/migrations/20261115180000_ranking_somente_admin.sql:28`)                                                              | Nada, se `auth.uid()` e `has_role` seguirem funcionando |
| Triggers em `auth.users`                     | `on_auth_user_created → handle_new_user` (cria `profiles` e `settings`; `display_name` vem de `raw_user_meta_data`); `on_auth_user_admin → grant_admin_on_confirm` (admin por e-mail fixo) | Viram trigger em `ba."user"`; o de admin é **removido** |
| `has_role(uuid, app_role)`                   | `SECURITY DEFINER`, lê `user_roles`                                                                                                                                                        | Mesma assinatura; fonte muda (seção 1.3)                |

**Código (arquivo:linha, no commit `391114c`)**

| Arquivo                                        | Linha                                | Uso hoje                                                              | Mudança                                                                                                          |
| ---------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/components/auth/AuthForm.tsx`             | 31, 36, 40, 42                       | `signInWithPassword`, `rpc("has_role")`, redirect por papel, `signUp` | `authClient.signIn.email`/`signUp.email`; papel vem da sessão                                                    |
| `src/routes/auth.tsx`                          | 40                                   | `getSession` e redirect para `/inicio`                                | `authClient.getSession`                                                                                          |
| `src/routes/index.tsx`                         | 30                                   | `getSession` e redirect                                               | idem                                                                                                             |
| `src/routes/__root.tsx`                        | 127                                  | `onAuthStateChange` invalida rotas e queries                          | `authClient.useSession` ou evento próprio de login/saída                                                         |
| `src/routes/_authenticated/route.tsx`          | 15, 37                               | `getUser` no `beforeLoad`; `signOut`                                  | sessão do Better Auth; `authClient.signOut`                                                                      |
| `src/hooks/useCadencia.ts`                     | 61, 90, 108, 124, 221, 242, 258, 345 | `supabase.auth.getUser()` só para obter o `user_id` das inserções     | um helper `useUserId()` (ou o id vindo do contexto da rota)                                                      |
| `src/integrations/supabase/client.ts`          | 48-54                                | `createClient` com `persistSession` em `localStorage`                 | `accessToken: () => getJwt()`; sem sessão do Supabase                                                            |
| `src/integrations/supabase/auth-attacher.ts`   | 9                                    | anexa o Bearer do Supabase a cada server function                     | anexa o JWT do Better Auth (ou usa só o cookie de sessão)                                                        |
| `src/integrations/supabase/auth-middleware.ts` | 33-87                                | `requireSupabaseAuth`: valida com `supabase.auth.getClaims(token)`    | `requireSession`: `auth.api.getSession`; mantém `context.supabase` e `context.userId` para não mexer nas funções |
| `src/start.ts`                                 | 31                                   | registra `attachSupabaseAuth`                                         | registra o novo anexador                                                                                         |
| `src/lib/admin.functions.ts`                   | 17                                   | `rpc("has_role")`                                                     | via `context`                                                                                                    |
| `src/lib/painel.functions.ts`                  | 13, 23                               | `assertAdmin` e `painelIsAdmin`                                       | idem                                                                                                             |
| `src/lib/periodos.functions.ts`                | 21, **510**                          | `has_role`; `db.auth.admin.deleteUser(id)`                            | `has_role`; exclusão por `auth.api.removeUser` ou `DELETE` em `ba."user"`                                        |
| `src/lib/setores.functions.ts`                 | 12                                   | `has_role`                                                            | idem                                                                                                             |
| `src/lib/competition.server.ts`                | 61-65                                | `adminIds(db)` lê `user_roles`                                        | lê a projeção até a limpeza, depois `ba."user"`                                                                  |
| `e2e/mock-supabase.mjs`                        | 147-148                              | `/auth/v1/user` e `/auth/v1/*`                                        | mock da sessão (seção 1.6)                                                                                       |
| `playwright.config.ts`                         | 39-43                                | `SUPABASE_*`, `ADMIN_PASSWORD`, `SHEET_EXPORT_TOKEN`                  | acrescentar variáveis do Better Auth                                                                             |

Não mudam: `client.server.ts` (service role), `planilha.server.ts` e `export-sheet.ts` (token, sem sessão),
`admin.server.ts` (a checagem de `ADMIN_PASSWORD` usa só o `userId`).

### 1.2 Estratégia de RLS

**Escolha: manter RLS (A), com o JWT aceito pelo Supabase como emissor OIDC personalizado (A1).**

| Opção                | Como funciona                                                                                                                                                                                                                                                                                                                                 | Veredito                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** (recomendada) | O plugin `jwt` do Better Auth emite um JWT assimétrico (ES256, com `kid`) com `sub` = UUID, `role: "authenticated"` e `iss` = URL do app. O Supabase confia no emissor via **Third-Party Auth › Custom OIDC** (documentação: `/auth/third-party/custom-oidc`). O navegador usa `createClient(..., { accessToken })`. `auth.uid()` lê o `sub`. | Mantém RLS, `ranking()` e `has_role()` como estão e **não mexe nas chaves do Supabase** (rollback simples). Riscos abaixo.              |
| A2                   | O servidor assina o JWT com uma chave privada **importada** nas "JWT Signing Keys" do Supabase (a documentação diz que importar é possível).                                                                                                                                                                                                  | Funciona sem discovery OIDC, mas troca a chave corrente do projeto, o que complica o rollback e a rotação. Plano B se A1 falhar.        |
| B                    | Todo acesso passa por server functions com service role e checagem em código.                                                                                                                                                                                                                                                                 | Contradiz o AGENTS.md ("não usar server functions para CRUD simples") e exige reescrever `useCadencia` inteiro. Só se A1 e A2 falharem. |

**O que a documentação confirma e o que não**

- Confirmado: o Custom OIDC exige JWT assimétrico com `kid`, URL de descoberta
  (`<issuer>/.well-known/openid-configuration`) em HTTPS, chaves lidas do `jwks_uri` e `role:
"authenticated"` no token. Só se configura pelo painel ou pela Management API (não pela CLI). Chaves
  rotacionadas podem levar até 30 minutos.
- Confirmado: o plugin `jwt` do Better Auth expõe `/jwks` e `/token`, aceita `ES256` em
  `jwks.keyPairConfig` e permite `definePayload` e `getSubject`.
- **Verificar:** o plugin `jwt` **não** publica `/.well-known/openid-configuration`. Proposta: uma rota
  nossa (`src/routes/[.]well-known/openid-configuration.ts`) devolvendo `{ issuer, jwks_uri,
id_token_signing_alg_values_supported: ["ES256"], subject_types_supported: ["public"],
response_types_supported: ["id_token"] }`. Não está provado que o Supabase aceita um discovery
  mínimo assim.
- **Verificar:** se o Supabase aceita um segundo emissor convivendo com o Supabase Auth (necessário para
  o rollback) e se aceita `iss` diferente por projeto (staging usa outro domínio).
- **Verificar:** como o PostgREST trata `aud` e `role` de um emissor de terceiros (a doc só cita `role`).
- **Verificar:** o padrão do plugin é EdDSA; o Supabase lista ES256/RS256. Configurar ES256 explicitamente.

**O que checar no painel do Supabase antes de começar**

1. Authentication › JWT Signing Keys: se o projeto já usa chaves assimétricas e qual é a corrente.
2. Authentication › Sign In / Providers › Third-Party Auth: se "Custom OIDC" está disponível no plano.
3. Authentication › SMTP: se há SMTP próprio; Authentication › Email Templates e limites de envio.
4. Authentication › Sign In / Providers › Email: confirmação e cadastro habilitados.
5. Settings › API: schemas expostos (confirmar que o schema `ba` **não** será exposto).
6. Settings › Database: string do pooler (Supavisor, modo transação) para a Vercel.
7. Plano do projeto, backups diários e PITR (define como fazer o backup do corte).
8. Disponibilidade de Branching e preço de um segundo projeto.

### 1.3 Modelo de dados

Tabelas do Better Auth num schema próprio, `ba`, **não exposto** pelo PostgREST: os hashes de senha ficam
inalcançáveis pela API. A conexão do Better Auth usa `DATABASE_URL` (pooler) com `search_path=ba`
(verificar na Fase 0; a alternativa é prefixar as tabelas por configuração).

IDs: `uuid`, mantendo os valores de `auth.users.id`. Para novos usuários, o banco gera o UUID
(`advanced.database.generateId: false`). **Verificar:** o tipo de coluna que o `auth migrate` cria; por
isso as tabelas são escritas à mão em migração (esboço abaixo), não geradas.

```sql
-- Esboço (não é migração).
CREATE SCHEMA ba;
REVOKE ALL ON SCHEMA ba FROM anon, authenticated;

CREATE TABLE ba."user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'user',          -- plugin admin: 'user' | 'admin'
  banned boolean NOT NULL DEFAULT false,
  "banReason" text,
  "banExpires" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ba.account (          -- uma linha 'credential' por usuário (hash bcrypt)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES ba."user"(id) ON DELETE CASCADE,
  "accountId" text NOT NULL, "providerId" text NOT NULL, password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ba.session (...);     -- token, expiresAt, ipAddress, userAgent, impersonatedBy
CREATE TABLE ba.verification (...);
CREATE TABLE ba.jwks (...);        -- chaves do plugin jwt (privada cifrada com BETTER_AUTH_SECRET)

-- Migração dos dados (no mesmo Postgres, uma transação, reexecutável).
INSERT INTO ba."user" (id, name, email, "emailVerified", role, banned, "banReason", "createdAt", "updatedAt")
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)),
       lower(u.email), u.email_confirmed_at IS NOT NULL,
       CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
            THEN 'admin' ELSE 'user' END,
       u.banned_until IS NOT NULL AND u.banned_until > now(),
       CASE WHEN u.banned_until IS NOT NULL THEN 'migrado do Supabase Auth' END,
       u.created_at, now()
FROM auth.users u WHERE u.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, banned = EXCLUDED.banned;

INSERT INTO ba.account (id, "userId", "accountId", "providerId", password)
SELECT gen_random_uuid(), u.id, u.id::text, 'credential', u.encrypted_password
FROM auth.users u WHERE u.encrypted_password IS NOT NULL AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;   -- índice único (userId, providerId)
```

**Atenção ao `banned_until`:** o campo é uma data. As 8 contas "banidas" podem ter `banned_until` no
passado (ban expirado) ou no futuro. A consulta de reconciliação da Fase 1 lista `banned_until` de cada
uma; a regra acima só marca como banida quem ainda está no futuro. Decisão 5 depende desse resultado.

**FKs.** Em duas etapas, para o rollback continuar valendo: na migração aditiva (Fase 1), adicionar FKs
`NOT VALID` + `VALIDATE` para `ba."user"(id)` ao lado das antigas; na limpeza (Fase 4), remover as antigas.
Enquanto as duas existem, o `ON DELETE CASCADE` das duas faz o mesmo.

**Triggers.** `handle_new_user` passa a rodar `AFTER INSERT ON ba."user"` (continua atômico com a criação
da conta; `display_name` vem de `NEW.name`). `grant_admin_on_confirm` é removido: ninguém é admin por
e-mail fixo. O primeiro admin de qualquer ambiente novo é criado por um comando administrativo
(`scripts/criar-admin.ts`, executado por quem tem acesso ao banco).

**Fonte única do papel de admin.** `ba."user".role`. Até a limpeza, um trigger em `ba."user"` mantém
`public.user_roles` como **projeção** (insere/remove a linha `admin`), para que `has_role()` e o rollback
continuem funcionando sem mexer em nenhuma função SQL. Na Fase 4, `has_role()` passa a ler `ba."user"` e
`user_roles` é removida. Nas server functions, `has_role` segue sendo a checagem (agora com `userId` do
contexto), então `assertAdmin` e `painelIsAdmin` não mudam de forma.

**Gestão (tabela nova):** `public.access_audit (id, at, actor_id, action, target_id, detail jsonb)`,
escrita só pela service role.

### 1.4 Runbook de migração e corte

Princípio: **migração aditiva e reexecutável primeiro; corte depois; `auth.users` intacta até decisão
explícita**. O app antigo continua funcionando em cada etapa antes do corte.

**Pré-requisitos (antes da etapa 1)**

- Decisões 1 a 5 e 13 resolvidas; Fase 0 concluída com sucesso na Preview.
- Backup: `pg_dump -Fc` do schema `public` e das tabelas `auth.users` e `auth.identities`, guardado fora do
  repositório; confirmar backup diário/PITR do projeto.
- Consulta de contagem por usuário salva em CSV (abaixo).

**Consulta de contagem (antes e depois; a diferença tem de ser vazia)**

```sql
SELECT u.id, lower(u.email) AS email,
  (SELECT count(*) FROM public.contacts c WHERE c.user_id = u.id)                    AS contatos,
  (SELECT count(*) FROM public.contacts c WHERE c.user_id = u.id AND c.at_marcada_em IS NOT NULL) AS ats,
  (SELECT count(*) FROM public.companies c WHERE c.user_id = u.id)                   AS empresas,
  (SELECT count(*) FROM public.goals g WHERE g.user_id = u.id)                       AS metas,
  (SELECT count(*) FROM public.period_members m WHERE m.user_id = u.id)              AS membros,
  (SELECT count(*) FROM public.period_snapshots s WHERE s.hunter_id = u.id)          AS snapshots,
  (SELECT count(*) FROM public.templates t WHERE t.user_id = u.id)                   AS modelos,
  (SELECT md5(string_agg(c.id::text || coalesce(c.sent1_at::text,'') || coalesce(c.at_marcada_em::text,'') || c.status, ',' ORDER BY c.id))
     FROM public.contacts c WHERE c.user_id = u.id)                                  AS checksum_contatos
FROM auth.users u ORDER BY u.id;   -- depois: FROM ba."user" u
```

Além da contagem: exportar o JSON do placar (`getCompetition` do período ativo), o resultado de
`public.ranking(date)` e os três CSV de `/api/public/planilha/*` antes e depois; comparar byte a byte.

| #   | Etapa                                 | Ação / comando                                                                                                                                                                                                          | Verificação                                                                                              | Rollback                                                                                                            |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Ensaio completo no staging            | Restaurar uma cópia anonimizada (seção 3) e rodar as etapas 3 a 9. Criar antes uma conta de teste **com senha conhecida** pelo Supabase Auth e conferir que ela entra no Better Auth com a mesma senha (prova o bcrypt) | Login da conta de teste; consulta de contagem sem diferença; `ranking()` igual                           | Descartar o staging                                                                                                 |
| 2   | Congelar mudanças                     | Avisar o time; nenhuma migração nova entra na `dev` até o fim                                                                                                                                                           | —                                                                                                        | —                                                                                                                   |
| 3   | Migração aditiva em produção (Fase 1) | `bun run db:push` (schema `ba`, cópia dos dados, FKs novas, triggers de projeção). **O app não muda.**                                                                                                                  | Consulta de contagem de `ba."user"` igual à de `auth.users`; 18 linhas em `ba.account` com hash idêntico | `DROP SCHEMA ba CASCADE` e remover as FKs novas                                                                     |
| 4   | Fechar cadastros                      | No painel do Supabase: desativar novos cadastros horas antes do corte                                                                                                                                                   | Tentativa de cadastro recusada                                                                           | Reativar                                                                                                            |
| 5   | Sincronização incremental             | `SELECT ba.sync_from_supabase()` (o mesmo SQL da cópia, com `ON CONFLICT DO UPDATE`): pega contas e senhas alteradas desde a etapa 3                                                                                    | Contagens iguais                                                                                         | —                                                                                                                   |
| 6   | Corte (janela de baixo uso)           | Aprovar o PR para `main` (`/publicar`); a Vercel publica. Variáveis de produção do Better Auth já cadastradas                                                                                                           | `/auth` abre; login de um admin e de um hunter; `painelIsAdmin` verdadeiro só para admin                 | **Promover o deployment anterior na Vercel** (volta ao Supabase Auth, intacto)                                      |
| 7   | Conferência pós-corte                 | Rodar a consulta de contagem, o JSON do placar, `ranking()` e as planilhas; abrir Envios de hoje com um hunter real                                                                                                     | Diferença vazia; mesmos contatos e posições                                                              | Rollback da etapa 6                                                                                                 |
| 8   | Reabrir cadastro                      | Já no Better Auth, restrito a `@polijunior.com.br`                                                                                                                                                                      | Cadastro de teste cria `profiles` e `settings`                                                           | Fechar o cadastro                                                                                                   |
| 9   | Observação (30 dias úteis)            | `auth.users` permanece; novas contas existem só em `ba`                                                                                                                                                                 | —                                                                                                        | Contas criadas depois do corte **não** voltam ao Supabase Auth: no rollback, recriá-las à mão (lista pela consulta) |

**Por que o rollback é seguro:** os UUIDs nunca mudam; as policies usam `auth.uid()` = `sub`, igual para
os dois emissores; `user_roles` é mantida como projeção; `auth.users` e seus hashes ficam intactos.

**O que os usuários veem:** a sessão antiga cai, **todos entram de novo** com o mesmo e-mail e a mesma
senha. Não há redefinição de senha. Banidas continuam sem acesso. A tela de login ganha "esqueci minha
senha" (hoje não existe).

### 1.5 Gestão de acessos

Nova aba **"Usuários e acesso"** em `/painel` (só admin, `AdminGate`), usando o plugin admin por trás de
server functions que **envolvem** os endpoints do Better Auth (regras do projeto antes de chamar a API).

- Lista: nome, e-mail, papel, situação (ativo, banido, e-mail não confirmado), último acesso, contatos.
- Promover e rebaixar: `setRole`. Desativar e reativar: `banUser`/`unbanUser` (bloqueia login e revoga
  sessões). Remover: só com zero contatos (mesma regra de "excluir hunter" em `periodos.functions.ts`).
- **Último admin:** a server function recusa rebaixar, banir ou remover o último admin ativo; um trigger
  `BEFORE UPDATE/DELETE` em `ba."user"` repete a regra no banco (defesa em profundidade). Ninguém rebaixa
  a si mesmo se for o último.
- Auditoria: cada ação grava em `access_audit` (quem, o quê, em quem, quando).
- `ADMIN_PASSWORD` (exclusões e feriados): continua no corte. Com vários admins, uma senha compartilhada
  é um segredo fraco; a Fase 4 troca por **reautenticação com a senha do próprio admin** (o bloqueio de
  tentativas em `admin_attempts` continua). Decisão 4.
- Cadastro: gancho `before` em `/sign-up/email` recusa e-mails fora de `ALLOWED_SIGNUP_DOMAINS`; contas
  novas entram com papel `user` (hunter).

### 1.6 Testes, variáveis de ambiente e e-mail

**Testes**

- `e2e/mock-supabase.mjs` deixa de mockar `/auth/v1/*`. O Better Auth roda no próprio servidor do app e
  precisa de Postgres; no Playwright, um modo `E2E_AUTH=mock` troca o módulo de sessão por um simulado
  (sessão fixa de "Hunter Um" e do admin), como o mock de hoje faz. Isso **não** testa o Better Auth em si.
- Testes de integração do Better Auth contra um Postgres real (serviço do GitHub Actions): verificação do
  bcrypt do Supabase, restrição de domínio, proteção do último admin, a migração SQL sobre uma fixture, e
  o trigger de `handle_new_user`.
- Testes de unidade das regras puras (último admin, domínios permitidos) em `src/lib`.

**Variáveis**

| Variável                       | Onde     | Observação                                                                                                                         |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | servidor | pooler do Supabase (porta de transação), pool pequeno por instância                                                                |
| `BETTER_AUTH_SECRET`           | servidor | cifra a chave privada do JWKS                                                                                                      |
| `BETTER_AUTH_URL`              | servidor | origem pública; na Preview, usar `VERCEL_BRANCH_URL` ou um alias estável (o emissor OIDC precisa de URL estável)                   |
| `RESEND_API_KEY`, `EMAIL_FROM` | servidor | decisão 3                                                                                                                          |
| `ALLOWED_SIGNUP_DOMAINS`       | servidor | `polijunior.com.br`                                                                                                                |
| Mantidas                       |          | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`, `SHEET_EXPORT_TOKEN`, `ADMIN_PASSWORD` |

**E-mail.** Hoje o Supabase envia a confirmação (configuração de SMTP a verificar no painel). Após o corte
o Better Auth envia: `emailVerification.sendVerificationEmail` e `emailAndPassword.sendResetPassword`, com
`requireEmailVerification: true`. Provedor recomendado: Resend (plano gratuito cobre 18 contas com folga).
Exige SPF e DKIM no DNS de `polijunior.com.br`: depende de quem administra o domínio. Custo estimado:
US$ 0 neste volume.

---

## 2. Parte 2: dashboards

### 2.1 Matriz métricas × dimensões

Dimensões usadas: **Hunter** · **Grupo/subgrupo** · **Período** (como dimensão) · **Setor da empresa** ·
**Área do contato** · **Etapa/canal** · **Mensagem de origem** (`resposta_etapa`/`resposta_modelo`) ·
**Situação atual** · **Tempo** (dia, semana de segunda, mês) · **Tem telefone**.

| Métrica (fonte, data de referência)                          | Hunter | Grupo | Período | Setor empresa | Área | Etapa/canal             | Mensagem de origem | Situação | Tempo                     | Telefone |
| ------------------------------------------------------------ | ------ | ----- | ------- | ------------- | ---- | ----------------------- | ------------------ | -------- | ------------------------- | -------- |
| Envios, por etapa e canal (`sent{n}_at`, dia)                | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ✔ (é a própria métrica) | ✖⁴                 | ⚠⁵       | ✔ dia/semana/mês          | ⚠⁵       |
| Contatos importados (`created_at`, dia SP)                   | ✔      | ⚠¹    | ✔       | ⚠³            | ✔    | ✖                       | ✖                  | ⚠⁵       | ✔                         | ⚠⁵       |
| Respostas (`respondeu_em`, senão registro da AT)             | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ⚠⁶                      | ⚠⁶                 | ⚠⁵       | ⚠⁷                        | ⚠⁵       |
| ATs, Leads, Propostas, Aprovações, Vendas (`stageScoreDate`) | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ⚠⁶                      | ⚠⁶                 | ⚠⁵       | ✔                         | ⚠⁵       |
| Empresas cadastradas (`companies`, `week_start`)             | ✔      | ⚠¹    | ✔       | ✔             | ✖    | ✖                       | ✖                  | ✖        | ⚠⁸ semana ou mais         | ✖        |
| Atrasados, parados (hoje, `plannedDates`)                    | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ✔                       | ✖                  | ✖        | ✖⁹                        | ⚠⁵       |
| No prazo e previstos (`onTime`/`due`)                        | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ✔                       | ✖                  | ✖        | ⚠¹⁰ só total do intervalo | ✖        |
| Tempo até a resposta (dias úteis, média)                     | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ⚠⁶                      | ⚠⁶                 | ✖        | ⚠⁷                        | ✖        |
| Coortes de LinkedIn 1 (AT em 14/28 dias)                     | ✔      | ⚠¹    | ⚠²      | ⚠³            | ✔    | ✖                       | ✖                  | ✖        | ✔ semana de entrada       | ✖        |
| Pontos da competição (`computeCompetition`)                  | ✔      | ⚠¹    | ✔       | ✖             | ✖    | ✖                       | ✖                  | ✖        | ⚠¹¹ semana                | ✖        |
| Metas e % da meta (`goals`)                                  | ✔      | ✔     | ✖       | ✖             | ✖    | ✖                       | ✖                  | ✖        | ⚠¹²                       | ✖        |
| Placar congelado (`period_snapshots`)                        | ✔      | ⚠¹    | ✔       | ✖             | ✖    | ✖                       | ✖                  | ✖        | ✖                         | ✖        |

Notas das condições (⚠ e ✖):

1. **Grupo e subgrupo** só valem dentro de **um** período: o hunter muda de grupo entre períodos
   (`period_members`). O construtor exige o filtro de período ao escolher essa dimensão.
2. **Período como dimensão** usa `contacts.period_id`, carimbado na criação. Num **ciclo**, os Indicadores
   contam todos os contatos dos membros pela data de cada etapa (`clampToCycle`), o que difere de agrupar
   por `period_id`. Por isso o período é, antes de tudo, um **filtro de escopo** (membros + datas, igual
   aos Indicadores); como dimensão só vale para competições e "todos".
3. **Setor da empresa** só existe para contatos com `company_id`; os outros caem em "Sem empresa
   cadastrada" (o gráfico mostra a barra, não a esconde).
4. Envios por modelo usam o código **atual** do modelo (limitação documentada em `AGENTS.md`); só a
   resposta e a AT carimbam o modelo no momento. Por isso a dimensão "mensagem de origem" só combina com
   métricas de resposta.
5. **Situação atual** e **telefone** são o valor **de hoje**, não o da data do evento; o gráfico indica
   "situação atual".
6. Só contatos com `resposta_etapa` informado; respostas antigas ficam em "Não informada".
7. Respostas marcadas antes da coluna `respondeu_em` não têm data e **ficam fora de séries por data**
   (aparecem só no total sem série, como "sem data": `undatedResponses`).
8. Empresas têm granularidade semanal (`week_start`): sem série diária.
9. Atrasados e parados são uma **foto de hoje**: não há histórico para série temporal.
10. `onTime`/`due` só fazem sentido como agregado do intervalo, como na tabela de hunters.
11. Os pontos incluem bônus (primeira AT, semanas vencidas); só fatiam por semana, via `computeWeekly`.
12. Meta diária/semanal vira meta do intervalo pelos dias úteis; só 4 métricas têm meta (`envios`, `l1`,
    `ats`, `noPrazo`).

**Pares válidos para razão (derivadas).** Mesma dimensão, mesmo grão e mesma lógica de data, sempre
**por evento no intervalo** (nunca misturar com coorte no mesmo gráfico; decisão 11):

| Numerador ÷ denominador                                                            | Válido | Observação                                           |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| ATs ÷ LinkedIn 1                                                                   | ✔      | é a conversão de `/inicio` (`conversion`)            |
| Respostas ÷ envios                                                                 | ✔      |                                                      |
| ATs ÷ respostas                                                                    | ✔      | datas de referência diferentes: rotular "por evento" |
| Leads ÷ ATs, Propostas ÷ Leads, Aprovações ÷ Propostas, Vendas ÷ Aprovações        | ✔      | funil por evento                                     |
| LinkedIn 1 ÷ importados                                                            | ✔      |                                                      |
| ATs ÷ empresas cadastradas                                                         | ⚠      | só com tempo ≥ semana                                |
| Atrasados ÷ envios, pontos ÷ qualquer métrica, métrica de foto ÷ métrica com série | ✖      | lógicas de data diferentes                           |

Uma razão nunca é somada: nos agrupamentos, divide-se depois de agrupar, e o resultado é `null` (célula
"sem base") quando o denominador é zero.

### 2.2 Catálogo de métricas

Arquivo novo: `src/lib/metricas.ts` (puro, com teste ao lado). Cada métrica declara `id`, rótulo, fonte,
data de referência, agregação (`count`, `distinct`, `avg`) e a função **reaproveitada**; nenhuma regra
nova de pontuação ou de data é escrita.

| id                                                    | Rótulo                          | Fonte                 | Data de referência               | Reaproveita                                      |
| ----------------------------------------------------- | ------------------------------- | --------------------- | -------------------------------- | ------------------------------------------------ |
| `envios`                                              | Mensagens enviadas              | `contacts.sent{n}_at` | dia do envio                     | `HunterRow.sent`, `kpis.envios` (`dashboard.ts`) |
| `envios_linkedin`, `envios_whatsapp`                  | Por canal                       | idem                  | idem                             | `kpis.linkedin`, `kpis.whatsapp`, `STEPS`        |
| `envios_etapa_1..5`                                   | Por etapa                       | idem                  | idem                             | `STEPS`                                          |
| `l1`                                                  | LinkedIn 1 enviados             | `sent1_at`            | dia                              | `kpis.l1`, `competition.linkedin1`               |
| `importados`                                          | Contatos importados             | `created_at`          | dia SP                           | `kpis.importados`                                |
| `empresas`                                            | Empresas cadastradas            | `companies`           | `week_start`                     | `kpis.empresas`                                  |
| `respostas`                                           | Respostas                       | `respondeu_em` / AT   | `responseDate`                   | `responseDate`                                   |
| `ats`, `leads`, `propostas`, `aprovacoes`, `vendidos` | Etapas do funil                 | `FUNNEL[].field`      | `stageScoreDate` (`atScoreDate`) | `FUNNEL`, `stageScoreDate`, `kpis.ats`           |
| `atrasados`                                           | Envios atrasados (hoje)         | filas                 | foto de hoje                     | `lateSince`, `plannedDates`, `computeDashboard`  |
| `parados`                                             | Hunters parados (2+ dias úteis) | `lastSend`            | foto de hoje                     | `HunterRow.idleDays`                             |
| `no_prazo_pct`                                        | % no prazo                      | `onTime`/`due`        | intervalo                        | `onTimeProgress`                                 |
| `tempo_resposta`                                      | Dias úteis até a resposta       | `responseTime`        | `responseDate`                   | `businessDaysBetween`                            |
| `coorte_at14`, `coorte_at28`                          | AT em 14/28 dias do LinkedIn 1  | `cohorts`             | semana do L1                     | `Cohort`                                         |
| `pontos`                                              | Pontuação final                 | competição            | semana/período                   | `computeCompetition`, `computeWeekly`            |
| `meta_*`                                              | Meta e % da meta                | `goals`               | intervalo                        | `resolveGoal`, `volumeProgress`                  |

**Arquitetura do motor (a escolha que garante que os números batem).** Cada contato é convertido em
**eventos** `{ contactId, hunterId, métrica, dia, etapa?, canal?, empresaId?, setorId?, área, períodoId,
origemEtapa?, situação, temTelefone }` por extratores que chamam as funções existentes (por exemplo, o
extrator de `ats` usa `stageScoreDate`). Uma consulta é: filtrar eventos por intervalo e filtros,
agrupar por dimensão (e opcionalmente por uma segunda) e agregar. As razões dividem duas consultas já
agrupadas com a mesma chave. A comparação com o período anterior reaproveita `previousRange`.

**Contrato de equivalência (teste obrigatório, fase 5):** para a fixture de `dashboard.test.ts` e para os
dados do e2e, a soma de cada métrica por hunter igual ao KPI correspondente de `computeDashboard`, a
conversão igual a `conversion()` de `inicio.ts`, e os pontos iguais a `computeCompetition`. No Playwright,
durante a coexistência, o card do dashboard padrão e o tile equivalente de `/indicadores` têm de mostrar o
mesmo valor.

### 2.3 Modelo de dados de dashboards e gráficos

O dado **não** é guardado no dashboard; só a configuração. Cada abertura executa a consulta com as
permissões de **quem está vendo** (seção 2.6), então compartilhar não vaza dado.

```sql
-- Esboço (não é migração). owner_id referencia o usuário do Better Auth.
CREATE TABLE public.dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES ba."user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','all','selected')),
  filters jsonb NOT NULL DEFAULT '{}',      -- período, grupo, hunter, setor, intervalo
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dashboard_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  title text NOT NULL,
  spec jsonb NOT NULL,                      -- validado por Zod no servidor (versão em spec.v)
  layout jsonb NOT NULL,                    -- { x, y, w, h }
  sort int NOT NULL DEFAULT 0
);
CREATE TABLE public.dashboard_shares (
  dashboard_id uuid REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES ba."user"(id) ON DELETE CASCADE,
  PRIMARY KEY (dashboard_id, user_id)
);
```

**RLS** (leitura e escrita direto do navegador, como o resto do CRUD simples do projeto):

- Dono: tudo, `owner_id = auth.uid()` (em `dashboards`; os cards herdam pelo `dashboard_id`).
- Leitura por outros: `visibility = 'all'`, ou existe linha em `dashboard_shares` com o usuário.
- Quem recebe **só lê**; para editar, usa "Duplicar", que cria uma cópia cujo dono é ele (a política de
  `INSERT` exige `owner_id = auth.uid()`).
- `spec` é validada por Zod nas server functions de leitura/execução; um `spec` inválido nunca executa.

**Forma do `spec` (versão 1):**

```json
{
  "v": 1,
  "metrics": ["ats"],
  "ratio": { "num": "ats", "den": "l1" },
  "groupBy": "hunter",
  "breakdown": null,
  "filters": [{ "dim": "setor_empresa", "in": ["<uuid>"] }],
  "range": { "preset": "semana" }, // ou { "from", "to" } ou { "periodId" }
  "compare": "anterior", // ou null
  "chart": "bar"
} // kpi | bar | line | funnel | table | meta
```

**Dashboards padrão.** O código define dois modelos (`src/lib/dashboards.padrao.ts`); a primeira abertura
de cada usuário os cria como linhas reais, por uma server function idempotente (`dashboardGarantirPadrao`).
O do admin reproduz os Indicadores atuais (KPIs principais e secundários, alertas, metas, funil, tendência);
o do hunter mostra os números dele (envios, atrasados, ATs, conversão, funil próprio).

### 2.4 Construtor, tipos de gráfico, filtros e drill-down

**Fluxo do construtor** (diálogo largo, pré-visualização ao vivo à direita; só oferece o que a matriz da
seção 2.1 permite, e explica o motivo das opções desabilitadas):

```
┌ Novo gráfico ───────────────────────────────────────────────────────────────┐
│ 1 Medir      [ ATs marcadas ▾ ]  [+ outra métrica]   ou  [ ATs ÷ LinkedIn 1 ▾ ] │
│ 2 Agrupar    [ Hunter ▾ ]   Quebrar por [ nenhum ▾ ]                          │
│ 3 Filtros    [+ Setor da empresa: Varejo, Indústria ×]  [+ Canal]             │
│ 4 Período    ( Esta semana ▾ ) [ 09/11 – 15/11 ]   [x] comparar com anterior  │
│ 5 Gráfico    [Número] [Barras] [Linha] [Funil] [Tabela] [Meta × real]         │
│ ┌ pré-visualização ───────────────────────────────┐   Título: [____________] │
│ │  (gráfico com os dados atuais)                  │   [Cancelar] [Salvar]    │
│ └─────────────────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Tipos da primeira entrega:** número (KPI com comparação com o período anterior), barras, linha, funil,
tabela e meta × realizado (só onde há meta). Biblioteca: Recharts (já instalada). Nenhum gradiente nem
sombra pesada (`DESIGN.md`); cores e tipografia só pelos tokens de `src/styles.css`.

**Grade.** `react-grid-layout` (decisão 8): arrastar e redimensionar, layout salvo por dashboard em
`dashboard_cards.layout`, 12 colunas, só desktop. Em modo leitura a grade fica travada.

**Filtros do dashboard** (barra no topo, valem para todo card que os suporta; cards que não suportam
mostram um aviso discreto "ignora o filtro X", nunca ignoram em silêncio): período ou intervalo
(`presetRange`, `RANGE_LABEL`), grupo/subgrupo, hunter e setor da empresa.

**Drill-down.** Clicar numa barra, fatia ou número chama `dashboardDetalhar(spec, ponto)`, que reutiliza
o mesmo motor e devolve os contatos por trás do ponto (limite de 200, com "ver todos em Contatos").
Admin vê nome e empresa; hunter, só os contatos dele.

### 2.5 Onde a agregação roda

**Decisão: TypeScript no servidor**, como `computeDashboard` faz hoje.

- Volume medido em produção em 16/11/2026: `contacts` com **3.046 linhas e 1,4 MB**; `companies` com 35;
  18 hunters. Cabe inteiro em memória: `fetchAll` busca em 4 páginas de 1.000 e o cálculo roda em
  milissegundos.
- Regra de ouro: **uma busca por abertura do dashboard**, não uma por card. A server function
  `dashboardExecutar(cards[], filtros)` busca os dados uma vez e calcula todos os cards.
- Como medir (fase 5, antes de qualquer UI): registrar `performance.now()` separando busca e cálculo;
  gerar no staging 50 mil e 100 mil contatos sintéticos; meta de p95 abaixo de 2 s para 12 cards.
- Gatilho para mudar: p95 acima de 2 s com dados reais, ou mais de ~50 mil contatos. Então: uma view
  `contact_events` (desempilha as datas em linhas) com índices por (hunter, dia) e funções SQL para as
  agregações, mantendo o motor de TypeScript como referência dos testes de equivalência.
- Atualização: ao abrir e ao mudar filtro (React Query, `staleTime` de 60 s), sem tempo real.

### 2.6 Visibilidade por papel

|                   | Hunter                                               | Admin                      |
| ----------------- | ---------------------------------------------------- | -------------------------- |
| Dados             | Só os próprios contatos e empresas                   | Todos                      |
| Dimensão "hunter" | Só ele mesmo                                         | Todos                      |
| Totais da equipe  | Só **ATs** por dia/semana (como `inicioResumo` hoje) | Todos                      |
| Drill-down        | Só os contatos dele                                  | Todos, com nome            |
| Metas             | A dele (`resolveGoal`)                               | De qualquer escopo         |
| Dashboards        | Cria e edita os dele; vê os compartilhados           | Idem                       |
| Dashboard padrão  | Números próprios                                     | Reprodução dos Indicadores |

A checagem acontece **no servidor**, no motor: o escopo do usuário (`userId`, papel) restringe os contatos
antes de agrupar. O `spec` salvo pelo dono nunca amplia o que o espectador pode ver.

---

## 3. Ambiente de teste

**Recomendação: projeto Supabase de staging separado** (`cadencia-staging`), por quatro motivos: (1)
Third-Party Auth (Custom OIDC) é configurado por projeto, e não se sabe se branches de Branching herdam
essa configuração; (2) o emissor OIDC precisa de URL estável; (3) Branching cria o banco **sem dados** e
exige que todas as migrações reproduzam o esquema do zero, o que ainda não foi testado; (4) o custo é
parecido (Branching cobra por hora, aproximadamente US$ 10/mês se ficar ligado; um segundo projeto no
plano gratuito custa zero, se houver vaga na organização, ou o preço do plano Pro). Branching continua
como alternativa para testar só migrações.

**Dados.** Cópia **anonimizada** de produção, por script (`scripts/seed-staging.ts`): restaura o schema
por migração, copia as tabelas de `public` e `auth.users`/`auth.identities` e anonimiza nome, headline,
telefone e empresa dos contatos, e-mail e nome das contas (`hunterNN@exemplo.com`), preservando UUIDs,
datas e estatísticas. Os hashes de senha são **substituídos** por um hash conhecido de teste (nunca copiar
hashes reais para staging). Uma conta de teste criada pelo Supabase Auth com senha conhecida valida a
migração do bcrypt.

**Vercel.** Variáveis de Preview **escopadas à branch** `feat/better-auth-dashboards` (a documentação
permite variável Preview por branch; ela sobrescreve a de mesmo nome sem branch): `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*` (embutidas no build),
`DATABASE_URL`, `BETTER_AUTH_*`, `RESEND_API_KEY`. Mudanças em variáveis só valem para deployments novos.

**Auditoria obrigatória antes da Fase 0 (decisão 13):** abrir Vercel › Settings › Environment Variables e
anotar para onde as variáveis **de Preview sem branch** apontam. Se apontarem para produção, qualquer
Preview (inclusive de PRs de outras pessoas) lê e escreve em produção hoje; isso é um risco existente,
independente deste plano, e deve ser corrigido apontando o Preview padrão para o staging.

**Caminho até o merge:** `feat/better-auth-dashboards` → `dev` → `main`, pela skill `/publicar`, uma fase
por PR. Para a Parte 1, o corte de produção é a etapa 6 do runbook (seção 1.4) e só ocorre depois da
aprovação na Preview e do ensaio completo.

---

## 4. Fases

Cada fase vira um ou mais PRs pequenos para a branch de integração, testados na Preview (apontando para o
staging) antes de seguirem para a `dev`. "Testar na Preview" abaixo é o que você executa.

| Fase | Entrega                                                                                                                               | PRs                             | Migrações                                               | Como testar na Preview                                                                                                                                                                                                                                                                     | Pronto quando                                                         | Depende de                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------ |
| 0    | Staging e provas de conceito                                                                                                          | 1 (rascunho, só docs e scripts) | no staging, não em produção                             | **(a)** token do Better Auth chega ao staging e `auth.uid()` retorna o `sub` (consulta `select auth.uid()` via `accessToken`); **(b)** discovery mínimo aceito pelo Custom OIDC; **(c)** login com o bcrypt do Supabase; **(d)** tabelas em `ba` com UUID; **(e)** auditoria da decisão 13 | os cinco itens passam; senão decidir A2 ou B                          | decisões 1, 2, 13                          |
| 1    | Migração aditiva (schema `ba`, cópia, FKs novas, triggers, `sync_from_supabase`)                                                      | 1                               | 1 ou 2 (seguindo `/nova-migracao`)                      | Ensaio completo no staging; consulta de contagem sem diferença; `ranking()` igual                                                                                                                                                                                                          | Diferença vazia no staging; produção só recebe depois da aprovação    | 0                                          |
| 2    | **Código do Better Auth e corte** (auth server, rotas `/api/auth/$`, discovery, login, cadastro, redefinição, token, middleware, e2e) | 2 a 3                           | nenhuma                                                 | Roteiro: login de admin e hunter; cadastro com e-mail de domínio errado (recusa) e certo; esqueci minha senha; Envios de hoje, Contatos, Importar e Painel com os mesmos dados; sair e entrar                                                                                              | Checklist da Preview aprovado; é o PR do corte (runbook 1.4, etapa 6) | 1, decisão 3                               |
| 3    | Aba "Usuários e acesso" (promover, rebaixar, banir, remover, último admin, auditoria)                                                 | 1 a 2                           | `access_audit`                                          | Promover e rebaixar um admin de teste; tentar rebaixar o último (recusa); banir e ver a sessão cair                                                                                                                                                                                        | Ações auditadas e regra do último admin testada                       | 2                                          |
| 4    | Limpeza: remover triggers e FKs antigas, `has_role` lendo `ba`, `user_roles` removida, `ADMIN_PASSWORD` → reautenticação              | 1 a 2                           | 1                                                       | Exclusões e feriados com reautenticação; ranking e planilha iguais                                                                                                                                                                                                                         | 30 dias úteis sem rollback; `auth.users` mantida (decisão 14)         | 2, 3                                       |
| 5    | Motor de métricas e catálogo (puro) com testes de equivalência e medição de volume                                                    | 1                               | nenhuma                                                 | Sem UI: rodar a medição no staging com 50 e 100 mil contatos                                                                                                                                                                                                                               | Equivalência verde; p95 medido                                        | nenhuma (pode andar em paralelo à Parte 1) |
| 6    | Dashboards: tabelas, CRUD, grade somente leitura com cards fixos, dashboard padrão do admin reproduzindo Indicadores                  | 2                               | 1 (`dashboards`, `dashboard_cards`, `dashboard_shares`) | Abrir o padrão do admin e comparar cada card com `/indicadores`, lado a lado                                                                                                                                                                                                               | Todos os valores iguais; capturas antes e depois                      | 2, 5                                       |
| 7    | Construtor e tipos de gráfico                                                                                                         | 2                               | nenhuma                                                 | Criar um gráfico por tipo; tentar combinação inválida (bloqueada com motivo); salvar e reabrir                                                                                                                                                                                             | Pré-visualização igual ao card salvo                                  | 6                                          |
| 8    | Filtros do dashboard e drill-down                                                                                                     | 1 a 2                           | nenhuma                                                 | Aplicar cada filtro; clicar numa barra e conferir a lista contra Contatos                                                                                                                                                                                                                  | Lista bate com o número                                               | 7                                          |
| 9    | Hunter e compartilhamento (padrão do hunter, visibilidade, duplicar)                                                                  | 2                               | nenhuma ou 1                                            | Entrar como hunter e ver só o seu; abrir dashboard do admin compartilhado e confirmar que mostra só os dados do hunter                                                                                                                                                                     | Nenhum dado de outro hunter aparece                                   | 6 a 8                                      |
| 10   | Paridade e retirada de `/indicadores`                                                                                                 | 1                               | nenhuma                                                 | Conferir que o dashboard padrão cobre tudo o que a tela mostra                                                                                                                                                                                                                             | Decisão do time; `/painel?aba=indicadores` já redireciona             | 9                                          |

Observação: em `AGENTS.md`, "uma tela por PR com capturas" vale para as fases 3, 6, 7, 8, 9 e 10; a
Fase 2 mexe em login e cadastro (duas telas), então vai em PRs separados (login, cadastro/redefinição).

## 5. Riscos

| Risco                                                                                   | Probabilidade | Impacto                                     | Mitigação                                                                                                            |
| --------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Supabase não aceita o JWT do Better Auth como emissor (discovery mínimo, `aud`, `role`) | Média         | Alto: invalida a opção A1                   | Fase 0 prova antes de migrar; A2 e B como alternativas; decisão 1                                                    |
| Contas banidas (8) migradas como ativas por engano                                      | Baixa         | Alto: devolve acesso                        | Regra por `banned_until`; teste de integração; conferência na etapa 3                                                |
| Perda de vínculo de dados (UUID, FK, cascata)                                           | Baixa         | Muito alto                                  | UUIDs preservados; FKs novas ao lado das antigas; consulta de contagem e checksum antes/depois; `auth.users` intacta |
| Preview apontando para produção hoje                                                    | Desconhecida  | Alto                                        | Auditar (decisão 13) e corrigir antes da Fase 0                                                                      |
| bcrypt do Supabase não verifica no Better Auth                                          | Baixa         | Alto: todos teriam de redefinir a senha     | Prova na Fase 0 com conta de senha conhecida; `bcryptjs` (puro JS, sem binário nativo na Vercel)                     |
| Sessões simultâneas caem no corte                                                       | Certa         | Baixo                                       | Janela de baixo uso e aviso prévio                                                                                   |
| E-mail não chega (SPF/DKIM)                                                             | Média         | Médio: sem cadastro e sem "esqueci a senha" | Configurar DNS na Fase 2 e testar no staging; plano gratuito do Resend                                               |
| Conexões do Better Auth esgotam o Postgres (serverless)                                 | Média         | Médio                                       | Pooler em modo de transação, pool de 1 a 2 por instância                                                             |
| Mais de um admin sem proteção do último                                                 | Média         | Alto                                        | Regra no servidor e trigger no banco                                                                                 |
| Números do dashboard divergirem dos Indicadores                                         | Média         | Alto: perde a confiança                     | Motor por eventos reaproveitando as funções atuais; testes de equivalência; comparação lado a lado na Fase 6         |
| Hunter ver dado de outro (compartilhamento, drill-down, dimensão hunter)                | Baixa         | Muito alto                                  | Escopo aplicado no servidor pelo espectador; teste por papel em cada fase                                            |
| Desempenho com muitos cards                                                             | Baixa hoje    | Médio                                       | Uma busca por abertura; medição na Fase 5; gatilho para SQL                                                          |
| Mudança de esquema entre o ensaio e o corte                                             | Média         | Médio                                       | Congelar migrações (etapa 2); repetir a consulta de contagem                                                         |
| Escopo: o pedido junta duas iniciativas grandes                                         | Alta          | Médio                                       | Fases pequenas; motor de métricas independente da Parte 1                                                            |

## 6. Fontes consultadas

Código e banco do repositório (`391114c`): `AGENTS.md`, `README.md`, `docs/redesign/DESIGN.md`,
`supabase/migrations/*` (em especial `20260928210133_*`, `20261010200102_admin_roles.sql`,
`20261010200850_admin_email_guilherme.sql`, `20261113120000_companies_sectors.sql`,
`20261115180000_ranking_somente_admin.sql`), `src/integrations/supabase/*`, `src/lib/{dashboard,competition,
inicio,fila}.ts`, `src/lib/*.functions.ts`, `e2e/mock-supabase.mjs`, `playwright.config.ts`; consultas de
leitura ao banco de produção em 16/11/2026.

Documentação (consultada em 16/11/2026):

- Better Auth: guia de migração do Supabase `better-auth.com/docs/guides/supabase-migration-guide`; plugin
  admin `/docs/plugins/admin`; TanStack Start `/docs/integrations/tanstack`; adapter Postgres
  `/docs/adapters/postgresql`; banco de dados `/docs/concepts/database`; e-mail `/docs/concepts/email` e
  `/docs/authentication/email-password`; hooks `/docs/concepts/hooks`; plugin JWT `/docs/plugins/jwt`.
- Supabase: Third-Party Auth `supabase.com/docs/guides/auth/third-party/overview` e `/custom-oidc`; JWTs
  `/docs/guides/auth/jwts`; chaves de assinatura `/docs/guides/auth/signing-keys`; chaves de API
  `/docs/guides/api/api-keys`; Branching `/docs/guides/deployment/branching` e `/branching/pricing`.
- Vercel: ambientes `vercel.com/docs/deployments/environments`; variáveis de ambiente
  `vercel.com/docs/environment-variables` (variáveis de Preview por branch).

**Lacunas conhecidas da documentação** (viram itens da Fase 0): descoberta OIDC com o plugin `jwt`; se o
PostgREST aceita o emissor sem passar pelo Custom OIDC; tipo de coluna do `id` gerado pelo Better Auth no
Postgres e uso de `search_path`; número de branches por plano do Supabase; algoritmo EdDSA versus ES256.
