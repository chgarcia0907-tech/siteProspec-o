---
name: verificar
description: Roda todas as verificações do projeto (typecheck, lint, testes de unidade, build e testes de ponta a ponta) e explica o que falhou. Use antes de cada commit ou push, ao terminar uma mudança, ou quando pedirem para "verificar", "checar se está tudo ok" ou "rodar os testes".
---

# Verificar o projeto

Rode as verificações nesta ordem e pare na primeira que falhar (cada uma depende da anterior
estar ok):

1. `bun run typecheck`
2. `bun run lint` — se só houver erros de formatação (`prettier/prettier`), rode
   `bun run format` e repita.
3. `bun run test` — testes de unidade (Vitest, `src/**/*.test.ts`).
4. `bun run build`
5. `bun run e2e` — testes de ponta a ponta (Playwright contra o Supabase simulado em `e2e/`).
   Gera um build próprio apontando para o mock; não precisa de banco real nem login.

Se não houver `node_modules`, rode `bun install` antes.

## Ao relatar

- Diga quais passaram e, para o que falhou, o arquivo, a linha e a causa provável.
- Falha num teste de ponta a ponta pode ser mudança intencional de tela: leia o teste em
  `e2e/*.spec.ts` antes de concluir que o app quebrou. Se a mudança for intencional, ajuste o
  teste junto, no mesmo commit, e diga isso.
- Nunca desative, pule (`test.skip`, `.only`) ou apague um teste para ficar verde.
- Se mudou regra de pontuação, confira também o teste de equivalência em
  `src/lib/competition.test.ts` (ver AGENTS.md).
