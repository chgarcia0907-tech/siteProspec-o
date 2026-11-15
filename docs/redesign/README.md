# Redesign do frontend

Plano: o **Claude Design** desenha o sistema visual e as telas; o **Claude Code** implementa
tela a tela, em PRs pequenos que vão para o `main` funcionando. A lógica não muda.

| Etapa | O quê                                                                                | Status    |
| ----- | ------------------------------------------------------------------------------------ | --------- |
| 0     | Consolidar o `main` (PR #13) e voltar ao fluxo `dev` → `main`                        | concluída |
| 1     | Limpeza: componentes e dependências sem uso, rotas de importar e configurações (#14) | concluída |
| 2     | Inventário atualizado, screenshots e briefing para o Claude Design                   | concluída |
| 3     | Design no Claude Design (tokens → componentes base → navegação → Hoje → Indicadores) | a fazer   |
| 4     | Implementação: tokens → componentes base → navegação → uma tela por PR               | a fazer   |

## O que levar para o Claude Design

- [`briefing-claude-design.md`](briefing-claude-design.md): o pedido de design, em ordem de
  prioridade, com as restrições. **Comece por ele.**
- [`../../motion-audits/cadencia-outbound-2026-11-15.html`](../../motion-audits/cadencia-outbound-2026-11-15.html):
  auditoria de movimento (abra no navegador; tem demos).
- [`inventario.md`](inventario.md): objetivo, dados, ações, estados e problemas de UX de cada
  tela, componentes compartilhados, tokens atuais e as regras que o redesign não pode quebrar.
- [`screenshots/`](screenshots/): todas as telas em `desktop/` (1440 px) e `celular/`
  (Pixel 7), com os dados simulados dos testes, incluindo as 6 abas do painel.
- O próprio repositório, para o design usar os nomes e dados reais (`STEPS`, `FUNNEL`).

## Rede de segurança

Os testes de ponta a ponta em `e2e/` (Playwright com Supabase simulado, `bun run e2e`) cobrem
os fluxos de cada tela. Durante o redesign, um teste que quebra sem querer indica que o
comportamento mudou; texto ou botão mudado de propósito se ajusta no teste do mesmo PR.

Para regenerar as screenshots depois de mudar uma tela:

```sh
bun run screenshots
```
