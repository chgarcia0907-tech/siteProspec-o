# Cadência Outbound

Plataforma de prospecção outbound dos hunters: cadência de 5 toques (LinkedIn e WhatsApp),
fila do dia, funil (AT → venda), ranking/competição por período e exportação para Google Sheets.

Desenvolvido com o Claude Code e publicado na Vercel. Leia o `AGENTS.md` (carregado pelo
`CLAUDE.md`) antes de mudar a arquitetura: ele registra as decisões de projeto e o fluxo de
trabalho.

## Stack

- TanStack Start (React 19, roteamento por arquivos em `src/routes`) + Vite + nitro (deploy na Vercel)
- Supabase (Postgres, Auth, RLS) — cliente em `src/integrations/supabase`
- React Query, Tailwind CSS 4, shadcn/ui (`src/components/ui`)
- Vitest para testes das regras de negócio

## Onde fica cada coisa

| Pasta / arquivo                                | Conteúdo                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/cadencia.ts`                          | Regras da cadência (`STEPS`), etapas do funil (`FUNNEL`), datas previstas em dias úteis, parser do LinkedIn, modelos de mensagem. Fonte única — telas, CSVs e exports importam daqui. |
| `src/lib/competition.ts`                       | Cálculo puro da pontuação/ranking. `competition.server.ts` carrega os dados com service role.                                                                                         |
| `src/lib/contatos.ts`, `fila.ts`, `ranking.ts` | Regras puras de cada tela (filtros, filas do dia, CSV), com testes.                                                                                                                   |
| `src/lib/*.functions.ts`                       | Server functions (ações de admin, painel, períodos). Sempre validam `has_role`/senha antes do service role.                                                                           |
| `src/hooks/`                                   | `useCadencia` (dados do hunter, React Query + RLS), `usePainel` (dados do admin), `useSelection`.                                                                                     |
| `src/routes/_authenticated/*`                  | Telas logadas. As rotas só guardam o estado e compõem os componentes.                                                                                                                 |
| `src/components/<tela>/`                       | Componentes de cada tela (`contatos`, `hoje`, `ranking`, `painel`).                                                                                                                   |
| `src/routes/api/public/*`                      | Endpoints CSV/JSON consumidos pela planilha (protegidos por token).                                                                                                                   |
| `src/integrations/supabase/types.ts`           | Tipos gerados do banco. O tipo `Contact` deriva daqui.                                                                                                                                |

## Rodando localmente

Requer [Bun](https://bun.sh). As variáveis públicas do Supabase já estão no `.env`
versionado. As rotas de servidor (admin, planilha) precisam também de
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` e `SHEET_EXPORT_TOKEN`: coloque-os num
`.env.local` (ignorado pelo git) e carregue no terminal antes de subir o servidor.

```sh
bun install
set -a; source .env.local; set +a   # opcional: só para testar admin e planilha
bun run dev                          # http://localhost:8080
```

## Verificações

Rode antes de cada push (o CI em `.github/workflows/ci.yml` roda as mesmas):

```sh
bun run typecheck   # TypeScript
bun run lint        # ESLint + Prettier (bun run format corrige a formatação)
bun run test        # Vitest
bun run build       # build de produção
```

## Deploy

A Vercel faz o build (`bun run build`) a cada push. O nitro detecta a Vercel e gera
`.vercel/output`; fora dela, gera um servidor Node em `.output`
(`node .output/server/index.mjs`). Segredos de servidor ficam nas variáveis de ambiente
do projeto na Vercel.

## Banco de dados e migrações

Todas as migrações ficam em `supabase/migrations/`, aplicadas pelo
[Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
npx supabase login
npx supabase link --project-ref djxfcjgrjntfdgvgyaoe
bun run db:new nome_da_mudanca   # cria supabase/migrations/<timestamp>_nome_da_mudanca.sql
bun run db:push                  # aplica as pendentes no banco
bun run db:types                 # regenera src/integrations/supabase/types.ts
```

SQL que só pode rodar depois de publicar a versão do app que o entende fica em
`pendente-pos-publicacao/` e é executado manualmente após o deploy.

### Primeira vez com o CLI (uma vez só)

As migrações de `20261010200102` a `20261106154640` foram aplicadas em produção pelo
drizzle, não pelo Supabase CLI, então o CLI ainda não sabe que elas já rodaram. Antes do
primeiro `db:push`, confira com `npx supabase migration list` e marque como aplicadas as que
aparecerem só no lado local:

```sh
npx supabase migration repair --status applied 20261010200102 20261010200850 20261010222519 20261010223448 20261011171543 20261012200246 20261023173127 20261023181702 20261103192940 20261106154640
```

Faça o mesmo com qualquer uma das 7 migrações iniciais (`20260928…` a `20261001…`) que
apareça como pendente. Depois disso, `db:push` aplica só o que é novo (hoje,
`20261112150000_unschedule_lovable_sheet_sync`).
