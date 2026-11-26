# Design system · Outbound NTec (tema escuro)

Referência visual: canvas "Cadência Outbound · Redesign NTec" no Claude Design (14 pranchetas).
Tokens: `src/styles.css`. Este documento dá as regras que os tokens sozinhos não carregam.

O redesign troca **só a apresentação**. Regras de produto, dados e cálculos seguem o
`inventario.md` (seção 5). Nada de lógica nova em componente.

## 1. Princípios

- **Só tema escuro, só desktop.** Não existe `.dark` nem `dark:`; não há layout de celular.
  Largura de trabalho: conteúdo com `max-w-[1120px]` ao lado da navegação lateral.
- **Hierarquia antes de densidade.** Cada tela responde primeiro à pergunta principal
  (ex.: Dashboard → "a equipe está no ritmo?") e deixa o detalhe um nível abaixo.
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
  - Persona (`PersonaSelect`): `NativeSelect` (`h-8` no modo compacto); persona ainda não gravada mostra "Sugerida: <rótulo>" e o selo `text-caption bg-warning-soft` "sugerida".
- **Tabela de dados**
  - Visual: `bg-card rounded-xl border overflow-x-auto` + `table-dense`.
  - Cabeçalho `bg-surface-inset`, hover de linha, seleção por checkbox com barra de lote acima (`bg-primary-soft border-primary/35`).
  - Paginação: `TablePagination`, 50 por página.
  - Comportamento: cabeçalho fixo e ordenação.
- **Cartão de KPI**
  - Normal: `bg-card`, rótulo `text-dense text-muted-foreground`, valor `text-kpi text-heading`, comparação `text-dense` (queda em `destructive-text`, alta em `success`).
  - Em alerta: `bg-destructive-soft/50 border-destructive-border` e valor `text-destructive-text`.
  - A métrica-guia (ATs marcadas) tem o rótulo em `text-primary-text-strong`, fundo `bg-primary-soft` e valor em `text-big`. Na faixa de KPIs secundários o alerta usa só o fundo `bg-destructive-soft/50`, sem borda própria.
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
  - **Prospecção:** Início, Envios de hoje (com contador), Empresas, Contatos, ATs, Tasks, Importar conexões.
  - **Referência:** Modelos, Configurações.
  - **Administração:** Dashboard e Painel Admin, só para `has_role` admin.
- Usuário e "Sair" no rodapé da sidebar.
- Item ativo: `bg-primary-soft text-heading`.
- **Painel**: eyebrow "Painel do administrador" + H1 com o nome da aba + abas sublinhadas (`border-b-2 border-primary` na ativa). Cada aba continua em `/painel?aba=…`.

## 7. Padrões por tela

- **Envios de hoje (prioridade)**
  - Topo: barra de progresso do dia (feitos / total, atrasados, com dados faltando) e abas por etapa de `STEPS` com contagem.
  - Cartão:
    - Linha principal: nome (`text-card-title`) + selos (Atrasado · previsto DD/MM, pendências), cargo · empresa, e a meta-linha (selo de canal, código do modelo em mono + "modelo padrão"/"cadência do setor" com o `title` do código dizendo a origem, previsto, setor › subsetor e a persona usada).
    - Ações à direita, nesta ordem: Avançar no funil (ghost) · Copiar mensagem / Abrir WhatsApp (secundário) · **Marcar como enviado** (primário).
    - Os campos do lead (nome, empresa, concordância, persona, área, cargo) ficam **recolhidos** numa faixa `bg-surface-inset` que só aparece quando falta dado que a mensagem usa ("A mensagem usa empresa, área e cargo. Complete antes de copiar." + "Completar dados").
    - Cartão atrasado: `border-destructive-border`.
  - Rodapé: "Mostrando X de Y" + "Mostrar mais 50".
- **Dashboard** (antes "Indicadores")
  1. Filtros (segmentado de intervalo + datas + selects, juntos num cartão). Com filtro fora do padrão, o cartão mostra o resumo em chips e "Limpar filtros". Ao rolar, uma barra compacta fixa no topo (sem sombra, `bg-card`) repete os chips, "Editar filtros" e "Limpar filtros". Filtros, aba do Detalhamento, ordenação e hunter aberto da Execução ficam na URL (`/dashboard?…`); o padrão nunca é escrito nela.
  2. "A equipe está no ritmo desta semana?": 4 KPIs grandes (ATs marcadas, a métrica-guia, em `bg-primary-soft` e `text-big`, mais larga, com a meta da equipe e o semáforo (ícone + rótulo) quando há meta e dia útil; Mensagens enviadas, Conversão LinkedIn 1 → AT, Envios atrasados) + uma faixa única de 6 KPIs secundários (um cartão com divisórias, célula em alerta em `bg-destructive-soft/50`). "Envios atrasados agora" e "Hunters parados" trazem o atalho "Ver por hunter" (leva à Execução ordenada).
  3. "Quem precisa de ajuda" e "Metas da semana" em largura total, um abaixo do outro (a tabela de Metas não rola na horizontal em 1280 px). Alertas: 5 mais urgentes, "Ver todos" abre o resto, selo de severidade de largura fixa, nome do hunter é link para a Execução dele; a regra das metas vai em nota no rodapé de Metas.
  4. "Detalhamento" em abas internas: Execução por hunter, Envios por dia, Ritmo, Funil, Origem, Conversão, Tendência, Abastecimento.
- **Contatos**: 9 colunas.
  - Colunas: ☐, Contato (nome + cargo), Empresa (+ "texto livre" ou setor), Área e persona (a área em texto e, embaixo, o `PersonaSelect` compacto; sem selo, rótulo curto sem "Owner do/da"; a sugestão aparece com borda `border-dashed` e texto discreto até o hunter confirmar), Telefone, Cadência, Próximo envio, Situação, menu de ações.
  - Cadência: 5 marcadores, um por etapa de `STEPS`. Enviada = preenchida na cor do canal; próxima = contorno; atrasada = contorno `destructive`.
  - Edição detalhada no menu da linha, não em inputs na tabela inteira.
- **ATs** (`/ats`): faixa de 5 números do filtro (ATs, Realizadas, No-show em alerta quando houver,
  Remarcadas, Canceladas), filtros num cartão e tabela compacta (data da AT com "era DD/MM" quando
  remarcada, empresa e prospect, hunter, CN, canal, situação, link do card e "Abrir"). O detalhe abre
  em diálogo com os dados, o histórico e as ações; a situação Remarcada usa `warning-soft`.
- **Tasks** (`/tasks`): tasks do Pipedrive dos cards em AT Diag. Agendada e Realizada. Segmentado de
  etapa, faixa de 5 números (abertas, atrasadas em alerta, vencem hoje, próximas, concluídas no prazo),
  tabela "Por hunter" só para o admin (clicar no nome filtra a tela) e "Tasks abertas" com selo de
  situação: "Atrasada N dias" `destructive-soft`, "Vence hoje" `warning-soft`, "No prazo" `success-soft`.
- **Setores e cadências**: lista em árvore (setor e subsetores recuados, com empresas e contador `n/5` de "qualquer persona") e campo "Novo subsetor" do setor aberto. O editor tem abas de persona (Qualquer persona e as 4 personas, cada uma com contador `n/5` calculado de `STEPS`) e, dentro, uma aba por etapa com selo "própria" (texto na aba), "herdada" (vem do subsetor, do setor ou de qualquer persona) ou "padrão" (modelo padrão da equipe), código, mensagem, variáveis clicáveis e pré-visualização ao lado, que na etapa vazia diz de onde a mensagem sai. Um botão "Salvar setor e cadência".

## 6b. Início do hunter (`/inicio`)

Prancheta "Início" do Claude Design. Responde primeiro "a equipe está perto da meta de ATs?" e
depois "o que eu faço hoje?". Números de destaque com tokens próprios desta tela: `text-hero`
(48/52, título), `text-giant` (120/96, ATs da equipe), `text-numeral` (96/88, conversão) e
`text-big` (64/60, envios e atrasados). Cores pelo design system: AT do hunter em `bg-primary`,
AT da equipe em `bg-primary-soft`, vaga livre em `bg-surface-inset`, atrasados em
`bg-destructive-soft`.

## 6c. Dashboard (`/dashboard`)

Regras de produto e métricas: `.claude/plans/dashboard-outbound.md`. Cada aba responde a uma
pergunta e leva a uma decisão; gráfico que não muda decisão não entra. As telas são desenhadas com
as skills `frontend-design` e `ui-ux-pro-max`, mas cores, fontes e componentes vêm deste documento.

**Hierarquia.** Um destaque por aba e o resto quieto: na Visão geral é o cartão de ATs que
avançaram (o único com `bg-primary-soft` e `text-big`); nas outras, a pergunta da aba como H2 e o
gráfico que a responde primeiro. Detalhe e tabelas ficam abaixo.

**Cores dos gráficos** (`--chart-*` em `src/styles.css`, paleta NTec ajustada ao fundo escuro;
contraste ≥ 3:1 sobre `bg-card`). Ordem fixa: `chart-1` azul, `chart-2` azul claro, `chart-3`
laranja, `chart-4` verde-água, `chart-5` roxo. A mesma entidade tem a mesma cor em todas as abas:

| Entidade                     | Cor                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Série única                  | `chart-1`                                                                                         |
| Ciclos                       | em ordem cronológica: o mais antigo exibido em `chart-1`, o seguinte em `chart-2`…                |
| Versões do teste A/B         | A = `chart-1`, B = `chart-3` (azul × laranja, distinguíveis por daltônicos)                       |
| Os dois hunters de uma dupla | o primeiro em ordem alfabética `chart-1`, o outro `chart-3`                                       |
| Canal                        | tokens de canal (`linkedin`, `whatsapp`); outros canais `chart-3`, `chart-5`                      |
| Situação da AT               | realizada `success`, no-show `destructive`, agendada/remarcada `warning`, cancelada `chart-muted` |
| Meta                         | linha tracejada `chart-goal`                                                                      |
| Imaturo / amostra pequena    | `chart-muted` + selo "imatura" ou "n < 10" (cor nunca é o único sinal)                            |
| Rótulo de destaque           | `chart-3` (o valor que sustenta a leitura)                                                        |

Hunters não ganham cor própria (são muitos): em gráficos por hunter, o nome vai no eixo ou no
rótulo direto, e o hunter em foco usa `chart-1` com os demais em `chart-muted`.

**Cartão de gráfico** (componente compartilhado em `src/components/dashboard/shared/`):

- `bg-card border rounded-xl p-6`; título `text-card-title` no formato "Métrica por Dimensão
  (período)", ex.: "ATs que avançaram por semana (26.2)"; abaixo, uma frase de leitura em
  `text-dense text-muted-foreground` quando ajuda.
- Legenda só com 2 séries ou mais, abaixo do título, marcador quadrado de 8 px.
- Linha de fonte no rodapé em `text-caption text-subtle-foreground`: de onde vem o número e o
  recorte (ex.: "Fonte: ATs da plataforma e Pipedrive · safras maduras").
- Estado vazio com a frase do que falta ("Nenhuma safra madura ainda. A primeira amadurece em
  14/12."), carregando em skeleton, erro com "Tentar de novo" (seção 5).

**Regras de gráfico.**

- Uma métrica por gráfico; nunca dois eixos Y; nada de pizza, rosca, radar ou 3D.
- Só grade horizontal (`chart-grid`); texto dos eixos `subtle-foreground` em `text-caption`; eixo
  Y começando em 0 nas barras.
- Toda taxa com o volume: "52,4% (11 de 21)", no rótulo ou no tooltip e na tabela ao lado.
- Rótulos de dados só nos valores que sustentam a leitura, na cor da série (ou `chart-3`).
- Dispersões: pontos com opacidade 0,7, rótulo direto nos pontos que importam, quadrantes pela
  média em linha tracejada `chart-goal` com o nome de cada quadrante em texto.
- Mapas de calor: o valor escrito na célula (`text-caption tabular-nums`) e a escala de
  `surface-inset` → `chart-1` (como o mapa de envios atual), com legenda numérica.
- Safras ou segmentos imaturos em `chart-muted`, fora de ordenações e rankings.
- Números no formato brasileiro (`R$ 400.000`, `42,5%`, `1.250`) e `tabular-nums` em tabelas.
- Cada gráfico tem alternativa em texto: `aria-label` com a leitura principal e a tabela de dados
  acessível (botão "Ver dados" ou a tabela da própria aba).

**Aba Semanas** (`src/components/dashboard/semanas/`): calendário em escada (safras nas linhas,
semanas nas colunas, da primeira safra até a última amadurecer), com a palavra da fase em cada
célula: Prospecção `bg-primary` com texto preto (a única cheia), Cadência `bg-primary-soft`,
Maturação `bg-surface-inset` com borda tracejada, Madura `bg-success-soft text-success`. A coluna
de hoje tem o cabeçalho em `text-primary` com "hoje" e fundo `bg-primary/5`; semanas depois de
hoje ficam com `opacity-80` (fase prevista; mais apagado que isso derruba o contraste do texto
abaixo de 4,5:1). Abaixo, o cartão de metas do ciclo; parâmetros num diálogo "Configurar
dashboard". Safra com prospecção e cadência na mesma semana mostra "Prosp. + cadência" (cor da
prospecção, com contorno `primary-soft`); a semana sem trabalho entre a prospecção e a cadência
(ex.: provas) mostra "Pausa" com borda tracejada. O diálogo da safra escolhe a semana da cadência, e
a prévia de "Gerar semanas" tem, por semana, "Gerar" (desmarcado = pausa, sem safra) e "Cadência na
mesma semana".

**Alocação da semana** (mesma aba, entre o calendário e as metas): seletor de safra no cabeçalho,
faixa `bg-surface-inset` dizendo o que pode ser feito (livre antes da safra, só troca de setor
durante, encerrada depois) e tabela compacta hunter × setor › subsetor, dupla e metas. Hunter sem
alocação leva o selo `bg-warning-soft` "Não alocado"; vigências anteriores aparecem em
`text-caption` embaixo do setor ("antes: Varejo (09/11 a 11/11)").

**Aba Hunters** (`src/components/dashboard/hunters/`): seletores de ciclo e semana no topo;
"Disciplina da semana" em tabela compacta (esforço com ícone, porcentagem e palavra, como o
semáforo das metas; parados em `warning-text`); mapa de calor hunter × dia e participação nas ATs
hunter × semana com o valor escrito em cada célula e o fundo de `surface-inset` a `chart-1` (o
selo "concentração" fica embaixo da célula, em `warning-text`, fora do fundo colorido); duas
dispersões com o primeiro nome no ponto e as médias tracejadas. A ficha do hunter abre abaixo da
tabela (`?ficha=`), com as duas filas lado a lado; no gráfico de esforço, a meta é um contorno
tracejado `chart-goal` atrás da barra do feito (uma linha some quando só uma semana tem meta).

**Aba Conciliação** (`src/components/dashboard/conciliacao/`): contador de pendências na própria
aba (`bg-warning-soft`, some quando zera); no topo, ciclo, hora da última cópia do Pipedrive e
"Sincronizar agora" (mostra o progresso dos lotes no lugar da hora). Faixa "Higiene dos dados" com
as taxas e o volume; uma seção por tipo de pendência, com a sugestão de ligação e o botão primário
"Ligar a este card/contato" na linha; seção sem pendência vira uma linha tracejada ("nenhuma AT sem
card") para a fila mostrar só o que pede ação.

**Aba Visão geral** (`src/components/dashboard/visao/`, a aba padrão; os Indicadores antigos
ficam em `?aba=indicadores`, no fim): a pergunta "Estamos no ritmo para bater a meta do ciclo?"
como H2, com o seletor de ciclo à direita. Na primeira linha, o cartão central (ATs que avançaram
na semana em `text-big`, média e total do ciclo, e "No ritmo"/"Abaixo do ritmo" com ícone; sem
meta, o link para Semanas › Metas do ciclo) e os alertas (selo Alta `bg-destructive-soft`, Média
`bg-warning-soft`, 5 primeiros e "Ver todos"; "Ver" leva à aba do alerta). Abaixo, os fatores
(volume da safra contra a anterior, taxas das safras maduras com o volume); depois, ATs por semana
(marcadas, realizadas e avançaram, metas tracejadas na cor da série) e ATs marcadas por safra de
origem (barras empilhadas pela relação com a semana; "fora de cadência" em `chart-muted`); por
fim, o funil do ciclo e os hunters abaixo da meta de esforço. Os gráficos da Visão não animam (o
número aparece na hora). No menu, o item Dashboard leva um contador vermelho (`bg-destructive`)
com os alertas de nível alto, só para o admin.

**Aba Realização e avanço** (`src/components/dashboard/realizacao/`, depois de Hunters): a pergunta
"As ATs marcadas acontecem e avançam?" como H2, com o seletor de ciclo. Faixa de totais quieta
(ATs, realizadas, não realizadas, avançaram, cada taxa com o volume), sem `bg-primary-soft`. O
destaque é a situação das ATs por semana: barras empilhadas com as cores de situação da tabela
acima (agendada em tom claro de `warning` com contorno tracejado, para não confundir com "sem
desfecho") e "↻ N remarcadas" embaixo de cada semana. Ao lado, o mapa horário × dia útil com a
porcentagem e "n de N" escritos na célula, fundo de `surface-inset` a `chart-1` pela taxa de
no-show + remarcação; com menos de 3 horários a célula fica sem cor. Depois, antecedência em
barras horizontais, tempo por etapa em tabela (mediana acima da meta em `destructive-text` com
ícone; "Editar metas" abre um diálogo no próprio cartão), funil por setor alocado em tabela (selo
"imatura" em `surface-inset`; "Sem alocação" por último e em `muted-foreground`) e perdas por
motivo × etapa.

**Aba Segmentos** (`src/components/dashboard/segmentos/`, entre Hunters e Realização e avanço): a
pergunta "Onde a prospecção converte?" como H2, com as safras maduras e os limites da regra numa
linha embaixo. A dimensão (setor, subsetor, porte, persona, nível, área) é um controle segmentado,
como o de intervalo dos Indicadores, e fica na URL (`?dimensao=`). O destaque é a dispersão
Prospect → AT × % avanço com o nome no ponto e as taxas da base inteira tracejadas em
`chart-goal`; amostra pequena em `chart-muted`. Abaixo, a tabela com a decisão por ícone e palavra
(Fica `success`, Ajusta `warning-text`, Troca `destructive-text`); amostra pequena e "Não
informado" ficam em `muted-foreground`, sem decisão. Depois, os testes A/B (um cartão por teste;
versão A `chart-1`, B `chart-3`; selo `bg-warning-soft` "Parcial: …" com o que falta,
`bg-success-soft` "Conclusivo"), contatos por empresa em barras, canal da AT e mensagem que gerou a
resposta em tabelas, e safra × setor alocado (safra imatura em `muted-foreground` com selo).

**Testes A/B na aba Semanas** (`semanas/TestesAb.tsx`, embaixo das metas do ciclo): tabela com
nome, dimensão, safras, versões e situação; "Novo teste" abre um diálogo com nome, dimensão, safras
e uma caixa por versão com os valores da dimensão em caixas de seleção (valor já usado em outra
versão fica desabilitado). Encerrar pede a decisão em texto; excluir passa pelo `useConfirm`.

**Aba Resultado e ciclos** (`src/components/dashboard/resultado/`, depois de Realização e avanço):
a pergunta "Quanto a prospecção vira de negócio?" como H2. O destaque é a faixa de conversão
(realizadas, vendas, ticket médio, dias até fechar, valor por AT realizada), com "Vendas" em
`bg-primary-soft`; valores em reais no formato brasileiro (`reais` em `format.ts`). Abaixo, o
pipeline em barras horizontais por etapa (ganhos em `text-success`) ao lado da higiene dos dados
(taxas abaixo de 80% em `warning-text` com ícone), as tabelas de valor por AT por porte e por setor
na largura toda (barra `chart-1` do valor por AT; amostra pequena em `muted-foreground`, sem barra) e
os ciclos da plataforma, com o ciclo escolhido em `bg-primary-soft/40`.

**Curvas na aba Semanas** (`semanas/Curvas.tsx`, entre o calendário e a alocação): curvas de safra
em cores cronológicas, com a semana de hoje tracejada; ao lado, dias do cadastro à primeira AT em
barras, P50 e P90 e a maturação sugerida, com "Usar N semanas" (confirmação pelo `useConfirm`,
porque muda todas as abas); embaixo, o mapa safra × semana (mesmo mapa de calor da aba Hunters). O
cartão "Abastecimento e qualidade dos dados" dos Indicadores aparece no fim da aba, com o mesmo
cálculo da semana atual. A aba Indicadores continua no fim, com o aviso "Visão antiga".

**Filtros globais** num cartão no topo, como hoje (ciclo, safra, hunter, dupla, setor alocado),
na URL; com filtro fora do padrão, chips e "Limpar filtros".

## 6a. Nome da plataforma

O nome é **Outbound NTec**, com "NTec" em `text-primary`, precedido do macaquinho do NTec
(`public/favicon.png`, o mesmo do favicon, decorativo). Use sempre o componente `Marca`
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
