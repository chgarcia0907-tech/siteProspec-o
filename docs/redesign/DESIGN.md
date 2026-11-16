# Design system · Outbound NTec (tema escuro)

Referência visual: canvas "Cadência Outbound · Redesign NTec" no Claude Design (14 pranchetas).
Tokens: `src/styles.css`. Este documento dá as regras que os tokens sozinhos não carregam.

O redesign troca **só a apresentação**. Regras de produto, dados e cálculos seguem o
`inventario.md` (seção 5). Nada de lógica nova em componente.

## 1. Princípios

- **Só tema escuro, só desktop.** Não existe `.dark` nem `dark:`; não há layout de celular.
  Largura de trabalho: conteúdo com `max-w-[1120px]` ao lado da navegação lateral.
- **Hierarquia antes de densidade.** Cada tela responde primeiro à pergunta principal
  (ex.: Indicadores → "a equipe está no ritmo?") e deixa o detalhe um nível abaixo.
- **Ação principal sempre visível e única.** Um botão primário por região.
- **Estado tem palavra.** Cor nunca é o único sinal (atrasado, na meta, sem empresa…).
- **Nada de gradiente, sombra pesada, borda lateral colorida ou emoji na UI.**

## 2. Cores

Use sempre as classes do token, nunca hex no componente.

| Papel                                                | Classe                                                                                 | Uso                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| Fundo da página                                      | `bg-background`                                                                        | `#121212`                            |
| Navegação lateral                                    | `bg-sidebar`                                                                           | `#181818`                            |
| Cartão / tabela                                      | `bg-card border border-border rounded-xl`                                              | `#1E1E1E`                            |
| Faixa interna, cabeçalho de tabela, pré-visualização | `bg-surface-inset`                                                                     | `#232323`                            |
| Controle (input, select, botão secundário)           | `bg-control border-input`                                                              | `#2A2A2A` / `#3D3D3D`                |
| Título e valor                                       | `text-heading`                                                                         | `#FFFFFF`                            |
| Corpo                                                | `text-foreground`                                                                      | `#DEDEDE`                            |
| Secundário                                           | `text-muted-foreground`                                                                | `#A8A8A8`                            |
| Legenda                                              | `text-subtle-foreground`                                                               | `#8F8F8F`                            |
| Ação principal, link, foco, ativo                    | `bg-primary text-primary-foreground` / `text-primary`                                  | azul NTec `#8AB8F2`, texto **preto** |
| Item ativo, aba ativa, linha selecionada             | `bg-primary-soft`                                                                      |                                      |
| Destrutivo                                           | `bg-destructive text-destructive-foreground` (botão) / `text-destructive-text` (texto) | `#CF6679`, texto preto no botão      |

**Semânticas do produto** (cada uma com `-soft` para o fundo do selo):

| Token         | Cor                                                       | Onde                                                                                  |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `linkedin`    | `#8AB8F2`                                                 | selo de etapa LinkedIn, ponto da aba, "Em cadência"                                   |
| `whatsapp`    | `#03DAC6` (teal)                                          | selo de etapa WhatsApp, ponto da aba                                                  |
| `success`     | `#A5D6A7` (verde)                                         | Respondeu, Na meta, Novo (importação), Projeto vendido                                |
| `warning`     | `#FFB74D` (ícone/barra), `warning-text` `#FFCC80` (texto) | sem empresa/área/cargo, Perto da meta, membro sem grupo, cadência do setor incompleta |
| `destructive` | `#CF6679`, `destructive-text` `#E08A99`                   | Atrasado, Abaixo da meta, Descartado, Excluir                                         |

`whatsapp` e `success` são diferentes de propósito (matiz e luminosidade). Não reutilize um
pelo outro.

**Contraste:** texto sobre `primary`, `whatsapp`, `success` e `destructive` sólidos é sempre
`#000000`. Texto colorido sobre fundo escuro usa a variante clara (`warning-text`,
`destructive-text`, `primary-text-strong`).

## 3. Tipografia

Host Grotesk nos títulos (`font-display`), Nunito Sans no corpo (`font-sans`), JetBrains Mono
em códigos de modelo e variáveis (`font-mono`).

| Classe            | Tamanho | Peso        | Uso                                                                            |
| ----------------- | ------- | ----------- | ------------------------------------------------------------------------------ |
| `text-title`      | 30/36   | 700 display | título da tela (H1), um por tela                                               |
| `text-section`    | 20/28   | 600 display | título de seção (H2)                                                           |
| `text-card-title` | 16/22   | 600 display | título de cartão, nome do lead (`text-card` seria a cor do cartão no Tailwind) |
| `text-body`       | 15/22   | 400         | corpo padrão                                                                   |
| `text-dense`      | 13/18   | 400         | tabelas, filtros, controles compactos                                          |
| `text-caption`    | 12/16   | 400–700     | legenda, selo, eyebrow. **Mínimo da UI**: nada de 11px                         |
| `text-kpi`        | 40/46   | 700 display | valor de KPI principal                                                         |

Eyebrow (classe `.eyebrow`): acima do H1, maiúsculas, azul, ex.: "Painel do administrador",
"Quinta-feira, 12 de novembro", "68 contatos".

## 4. Espaço, raio e densidade

- Espaçamento em base 4: 4, 8, 12, 16, 24, 32, 48, 64. Página: `px-10 py-8`; entre seções `gap-6`.
- Raios: `rounded-sm` (4) selos · `rounded-md` (6) botões e campos · `rounded-lg` (8) filtros,
  segmentados e banners · `rounded-xl` (10) cartões e tabelas · `rounded-full` chips.
- **Confortável** (formulários, cartões, Envios de hoje): controles `h-9`–`h-11`, cartão `p-4`–`p-6`.
- **Compacta** (todas as tabelas): `table-dense`, linhas de ~40 px, controles `h-8`, `text-dense`.

## 5. Componentes base

Todos sobre shadcn/ui (Radix). Ícones: lucide, traço 1.75, 16–18 px, `currentColor`.

- **Button**
  - `default` = primário (azul, texto preto, hover `primary-hover`).
  - `secondary` = `bg-control border-input`.
  - `ghost` = transparente, hover `bg-control`.
  - `destructive` = vermelho sólido, texto preto, só dentro do diálogo de confirmação.
  - Novo `destructive-ghost` = `text-destructive-text`, hover `bg-destructive-soft`, para ícones de lixeira e a zona de risco.
  - Pressionado: `translate-y-px`.
- **Selos** (`Badge`), todos `text-caption font-semibold`:
  - Canal (`ChannelBadge`): `rounded-sm bg-linkedin-soft text-linkedin` / `bg-whatsapp-soft text-whatsapp`, com o rótulo de `STEPS`.
  - Situação (`StatusBadge`): `rounded-full`, rótulos de `STATUS_LABEL`.
    - Aguardando início: contorno `border-input`, texto muted.
    - Em cadência: `linkedin-soft`.
    - Respondeu: `success-soft`.
    - Concluído: `bg-divider`.
    - Descartado: `destructive-soft`.
  - Funil (`FunnelBadge`): `rounded-sm`, azul que se intensifica por etapa de `FUNNEL`; a última etapa ("Projeto vendido") é `bg-success text-black`.
  - Pendência: `rounded-sm bg-warning-soft text-warning-text`, "sem empresa" / "sem área" / "sem cargo".
- **Tabela de dados**
  - Visual: `bg-card rounded-xl border overflow-x-auto` + `table-dense`.
  - Cabeçalho `bg-surface-inset`, hover de linha, seleção por checkbox com barra de lote acima (`bg-primary-soft border-primary/35`).
  - Paginação: `TablePagination`, 50 por página.
  - Comportamento: cabeçalho fixo e ordenação.
- **Cartão de KPI**
  - Normal: `bg-card`, rótulo `text-dense text-muted-foreground`, valor `text-kpi text-heading`, comparação `text-dense` (queda em `destructive-text`, alta em `success`).
  - Em alerta: `bg-destructive-soft/50 border-destructive-border` e valor `text-destructive-text`.
  - A métrica-guia (ATs marcadas) tem o rótulo em `text-primary`.
- **Linha de alerta**: selo de severidade em maiúsculas ("Alta" `destructive-soft`, "Média" `warning-soft`) + frase com o nome em `text-heading`.
- **Indicador de meta**: barra de 6 px (`bg-divider` + preenchimento) + "realizado / meta" + palavra.
  - Na meta: `success`.
  - Perto: `warning`.
  - Abaixo: `destructive`.
- **Diálogo de confirmação** (`useConfirm`)
  - Visual: `bg-popover rounded-xl`.
  - Texto: "Essa ação não pode ser desfeita.".
  - Campo "Digite **PALAVRA** para confirmar" quando houver palavra; o botão `destructive` só habilita depois de digitar.
- **Estados**
  - Vazio: cartão com borda tracejada `border-input`, ícone, título curto e frase (ex.: "Fila em dia" / "Nada na fila de LinkedIn 1 para esta data.").
  - Carregando: skeleton em `bg-divider` + texto "Carregando…".
  - Erro: `border-destructive-border bg-destructive-soft/40` + "Tentar de novo".
- **Banner de aviso**: `rounded-lg border-warning-border bg-warning-soft/60 text-warning-text` + ação ghost (ex.: membros sem grupo).
- **Segmentado** (filtros de intervalo, abas internas): `bg-card border rounded-lg p-[3px]`, item ativo `bg-primary-soft text-heading`.
- **Zona de risco**: ações destrutivas separadas das comuns, num bloco `border-destructive-border` no fim da tela.

## 6. Navegação

- **Sidebar fixa à esquerda** (`bg-sidebar`, ~232 px), três grupos:
  - **Prospecção:** Envios de hoje (com contador), Empresas, Contatos, Importar conexões.
  - **Referência:** Modelos, Configurações.
  - **Administração:** Painel Admin, só para `has_role` admin.
- Usuário e "Sair" no rodapé da sidebar.
- Item ativo: `bg-primary-soft text-heading`.
- **Painel**: eyebrow "Painel do administrador" + H1 com o nome da aba + abas sublinhadas (`border-b-2 border-primary` na ativa). Cada aba continua em `/painel?aba=…`.

## 7. Padrões por tela

- **Envios de hoje (prioridade)**
  - Topo: barra de progresso do dia (feitos / total, atrasados, com dados faltando) e abas por etapa de `STEPS` com contagem.
  - Cartão:
    - Linha principal: nome (`text-card-title`) + selos (Atrasado · previsto DD/MM, pendências), cargo · empresa, e a meta-linha (selo de canal, código do modelo em mono + "modelo padrão"/"cadência do setor", previsto, setor).
    - Ações à direita, nesta ordem: Avançar no funil (ghost) · Copiar mensagem / Abrir WhatsApp (secundário) · **Marcar como enviado** (primário).
    - Os campos do lead (nome, empresa, concordância, área, cargo) ficam **recolhidos** numa faixa `bg-surface-inset` que só aparece quando falta dado que a mensagem usa ("A mensagem usa empresa, área e cargo. Complete antes de copiar." + "Completar dados").
    - Cartão atrasado: `border-destructive-border`.
  - Rodapé: "Mostrando X de Y" + "Mostrar mais 50".
- **Indicadores**
  1. Filtros (segmentado de intervalo + datas + selects).
  2. "A equipe está no ritmo desta semana?": 4 KPIs grandes (ATs marcadas, Mensagens enviadas, Conversão LinkedIn 1 → AT, Envios atrasados) + faixa de 6 KPIs secundários.
  3. Duas colunas: "Quem precisa de ajuda" (alertas) e "Metas da semana".
  4. "Detalhamento" em abas internas: Execução por hunter, Envios por dia, Ritmo, Funil, Origem, Conversão, Tendência, Abastecimento.
- **Contatos**: 9 colunas.
  - Colunas: ☐, Contato (nome + cargo), Empresa (+ "texto livre" ou setor), Área, Telefone, Cadência, Próximo envio, Situação, menu de ações.
  - Cadência: 5 marcadores, um por etapa de `STEPS`. Enviada = preenchida na cor do canal; próxima = contorno; atrasada = contorno `destructive`.
  - Edição detalhada no menu da linha, não em inputs na tabela inteira.
- **Setores e cadências**: um editor com uma aba por etapa (status "própria"/"padrão"), código, mensagem, variáveis clicáveis e pré-visualização ao lado. Um botão "Salvar setor e cadência".

## 6b. Início do hunter (`/inicio`)

Prancheta "Início" do Claude Design. Responde primeiro "a equipe está perto da meta de ATs?" e
depois "o que eu faço hoje?". Números de destaque com tokens próprios desta tela: `text-hero`
(48/52, título), `text-giant` (120/96, ATs da equipe), `text-numeral` (96/88, conversão) e
`text-big` (64/60, envios e atrasados). Cores pelo design system: AT do hunter em `bg-primary`,
AT da equipe em `bg-primary-soft`, vaga livre em `bg-surface-inset`, atrasados em
`bg-destructive-soft`.

## 6a. Nome da plataforma

O nome é **Outbound NTec**, com "NTec" em `text-primary`. Use sempre o componente `Marca`
(`src/components/Marca.tsx`) na navegação lateral e nas páginas públicas; nos títulos das abas
do navegador, o texto simples "Outbound NTec".

## 7a. Páginas públicas (`/` e `/auth`)

As duas páginas sem login seguem a TasteSkill (`design-taste-frontend`) por cima deste design
system: mesmas cores e fontes, outra escala.

- **Motivo:** uma pasta por etapa de `STEPS` (`FolderStack`, `src/components/inicio/`), na cor
  do canal (`bg-linkedin`/`bg-whatsapp`, texto preto), empilhadas com a primeira na frente. A aba
  tem o formato `folder-tab`; ele volta na moldura das telas, nas abas do login e no nome do rodapé.
- **Escala só destas páginas:** `text-display` (título de cartaz), `text-statement` (frase de
  destaque, até 3 linhas) e `text-lead` (texto corrido, 20px). Nas telas do app continue com a
  escala da seção 3.
- **Sem eyebrow, sem monoespaçada, sem sombra parada:** a sombra fica só no formulário aberto
  sobre o campo azul do fim da página.
- **Recortes da interface** levam `data-ui` e usam os componentes reais (`StatusBadge`,
  `ChannelBadge`) com dados de exemplo.
- **Movimento:** `rise-in` no topo (sem script) e `reveal` nas seções (`Reveal.tsx`), que só
  esconde depois que o script arma a seção.

## 8. Acessibilidade

- Contraste mínimo 4,5:1 para texto (3:1 a partir de 24 px). Os pares deste documento já passam.
- Elementos reais: `<button>`, `<a href>`, `<label>` + campo; nada de `onClick` em `div`.
- Botão só com ícone leva `aria-label` ("Excluir Delta", "Sair").
- Foco visível: contorno 2 px `ring` com offset 2 px.
- Alvos clicáveis com no mínimo 32 px de altura em tabelas e 36 px no resto.
