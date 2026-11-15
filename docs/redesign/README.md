# Redesign do frontend

Plano: o **Claude Design** desenha o sistema visual e as telas; o **Claude Code** implementa
tela a tela, em PRs pequenos que vão para o `main` funcionando. A lógica não muda.

| Fase | O quê                                                                                   | Status    |
| ---- | --------------------------------------------------------------------------------------- | --------- |
| 0    | Inventário, screenshots do "antes", testes de fumaça e regras de proteção               | concluída |
| 1    | Design no Claude Design: tokens e componentes primeiro, depois as telas (Hoje primeiro) | a fazer   |
| 2    | Implementação: tokens → shell/navegação → uma tela por PR                               | a fazer   |

## O que levar para o Claude Design

- [`inventario.md`](inventario.md): objetivo, dados, ações, estados e problemas de UX de cada
  tela, componentes compartilhados, tokens atuais e as regras que o redesign não pode quebrar.
- [`screenshots/`](screenshots/): todas as telas em `desktop/` (1440 px) e `celular/` (Pixel 7),
  com dados de exemplo; inclui os estados vazios de Hoje e Contatos e as 4 abas do painel.
- O próprio repositório, para o design usar os nomes e dados reais (`STEPS`, `FUNNEL`).

## Testes de fumaça (rede de segurança)

`e2e/` tem testes Playwright que abrem cada tela, conferem os textos-chave e executam a ação
principal (marcar envio, paginar e descartar contatos, importar, salvar configurações, abas do
painel), verificando o que seria gravado no banco. O Supabase e as server functions são
**simulados** no navegador (`e2e/support/mock.ts`, dados em `e2e/fixtures/data.ts`), então os
testes não precisam de credenciais e nunca tocam a produção.

```sh
bun run e2e           # testes de fumaça (desktop e celular)
bun run screenshots   # regenera docs/redesign/screenshots/
```

Na primeira vez numa máquina nova, instale o navegador com `bunx playwright install chromium`.
O CI roda os testes de fumaça num job separado.

Se o redesign mudar um texto-chave ou o nome de um botão de propósito, atualize o teste no
mesmo PR. Se um teste quebrar sem que a mudança fosse intencional, o comportamento mudou.
