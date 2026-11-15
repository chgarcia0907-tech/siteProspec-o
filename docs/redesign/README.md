# Redesign do frontend

Plano: o **Claude Design** desenha o sistema visual e as telas; o **Claude Code** implementa
tela a tela, em PRs pequenos que vão para o `main` funcionando. A lógica não muda.

| Fase | O quê                                                                                   | Status    |
| ---- | --------------------------------------------------------------------------------------- | --------- |
| 0    | Inventário, screenshots do "antes" e regras de proteção                                 | concluída |
| 1    | Design no Claude Design: tokens e componentes primeiro, depois as telas (Hoje primeiro) | a fazer   |
| 2    | Implementação: tokens → shell/navegação → uma tela por PR                               | a fazer   |

## O que levar para o Claude Design

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
