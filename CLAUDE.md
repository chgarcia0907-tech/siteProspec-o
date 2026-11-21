@AGENTS.md

## Advisor

Consulte o advisor antes de fechar um plano, depois de ver o mesmo erro duas vezes e antes de
declarar uma tarefa concluída.

## Commands

- Install: `bun install` · dev server: `bun run dev` (port 8080) · build: `bun run build`
- Checks in CI order: `bun run typecheck`, `bun run lint` (ESLint + Prettier), `bun run test`,
  `bun run build`, `bun run e2e`
- Unit tests are Vitest: `bun run test` (never `bun test`); one file:
  `bun run test src/lib/fila.test.ts`; one test: `bun run test src/lib/fila.test.ts -t "filas do dia"`
- E2E one spec: `bun run e2e e2e/hoje.spec.ts`; by name: `bun run e2e -g "marcar como enviado"`
- Format: `bun run format` (there is no lint-fix or format-check script; `bun run lint` checks Prettier)

## Agents

Project subagents live in `.claude/agents/` (`docs`, `grep` and `search` are read-only helpers).

- Pipeline: `planner` → `implementer` → `test-writer` → `code-reviewer`.
- When any step fails (test, build, lint, typecheck, runtime), use `debugger`, then resume from
  the step that failed.
- If `code-reviewer` returns REQUEST CHANGES, send its findings back to `implementer`, then
  review again.
- Skip `planner` for trivial one-file changes.
- Plans live in `.claude/plans/<slug>.md` and are the handoff between agents; the user reviews
  the plan before implementation starts.
- No agent commits, pushes, installs dependencies or edits CI, `bun.lock`, `.env*` or
  `.claude/agents/*` unless the plan says so.
- Invoke with `@agent-planner …` or "Use the planner subagent to …".
