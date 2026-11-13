---
name: nova-migracao
description: Cria uma migração de banco no Supabase do projeto seguindo as regras do repositório (Supabase CLI, tipos regenerados, SQL pós-publicação). Use quando a mudança precisar de tabela, coluna, índice, função, trigger, política RLS ou dado novo no banco.
---

# Nova migração

Banco de produção: Supabase `ctxsmboaqbjgslctojeq` (ver AGENTS.md). Migrações só em
`supabase/migrations/`.

1. Crie o arquivo: `bun run db:new <nome_em_snake_case>`. Nunca edite uma migração que já
   foi aplicada; se precisar corrigir, crie outra.
2. Escreva o SQL de forma idempotente quando der (`if not exists`, `create or replace`) e
   lembre de:
   - RLS ligado em tabela nova, com políticas por `auth.uid()` para dados do hunter; dados
     globais só via service role em server functions (ver AGENTS.md).
   - `grant` explícito para `authenticated`/`service_role` quando a tabela for nova.
   - Etapa nova de funil ou de cadência: além das colunas, atualize `FUNNEL`/`STEPS` em
     `src/lib/cadencia.ts`.
3. Teste a migração localmente se possível (Postgres local ou `npx supabase start`).
4. Não aplique em produção por conta própria. Diga ao usuário para rodar `bun run db:push`
   (exige `npx supabase link --project-ref ctxsmboaqbjgslctojeq`) e, depois,
   `bun run db:types` para regenerar `src/integrations/supabase/types.ts`. Não edite
   `types.ts` à mão.
5. Código que depende da coluna nova só pode ir para o `main` depois que a migração estiver
   aplicada em produção — senão o deploy da Vercel quebra. Avise isso no PR.
6. SQL que só pode rodar depois do deploy (ex.: texto de modelos com tags novas que a versão
   publicada ainda não entende) vai para `pendente-pos-publicacao/`, não para `migrations/`.

Commit no padrão: `feat(db): ...` ou `fix(db): ...`.
