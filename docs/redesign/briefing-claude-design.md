# Briefing para o Claude Design

Pedido de design para o redesign do frontend da **Cadência Outbound**. Leia junto com
[`inventario.md`](inventario.md) (o que cada tela faz, hoje) e as capturas em
[`screenshots/`](screenshots/) (`desktop/` com 1440 px e `celular/` com a largura de um Pixel 7).

## O produto em uma frase

Hunters (estudantes que fazem prospecção outbound) importam conexões do LinkedIn e mandam uma
cadência de 5 mensagens, alternando LinkedIn e WhatsApp, até marcar uma reunião (AT) com a
empresa. **Métrica-guia: ATs marcadas por semana.** O administrador acompanha a equipe, as metas
e a competição num painel.

## Quem usa e onde

| Perfil | Telas                                                                                         | Contexto de uso                                                                    |
| ------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Hunter | Envios de hoje, Empresas, Contatos, Importar conexões, Modelos, Configurações                 | Todo dia, em sessões curtas e repetitivas; muitas vezes no **celular** (WhatsApp). |
| Admin  | Painel: Indicadores, Hunters, Períodos e grupos, Setores e cadências, Competição, Busca geral | No computador, para acompanhar a semana e agir sobre quem está parado.             |

## O que pedimos, em ordem

### 1. Fundamentos (tokens)

Tokens atuais em `src/styles.css` (Tailwind 4 + shadcn/ui, cores em `oklch`, fonte Inter Tight,
raio 0,5rem, só tema claro). Pedimos:

- **Escala tipográfica** de 5 a 6 passos com uso definido (título da tela, título de cartão,
  corpo, corpo denso de tabela, legenda). Hoje há `text-[11px]` solto em 26 lugares e tabelas
  com 13px.
- **Cores semânticas distintas:** `success` e `whatsapp` são hoje a mesma cor. Mantenha
  `linkedin`, `whatsapp`, `warning`, `success` e `destructive`, cada uma com variante suave.
  O semáforo de metas usa três estados (na meta, perto, abaixo).
- **Densidade:** duas densidades (confortável para formulários e cartões; compacta para tabelas
  do painel).
- Só tema claro. Não precisa de modo escuro.

### 2. Componentes base

Estes se repetem e hoje cada tela faz o seu:

- **Tabela de dados**, com cabeçalho fixo, ordenação, linhas expansíveis, seleção por checkbox,
  ações em lote e **paginação de 50 por página** (`TablePagination`). Substitui as 6 tabelas
  feitas à mão do painel e a tabela de Contatos. Precisa de uma versão para o celular.
- **Cartão de KPI** (valor, comparação com o período anterior, estado de alerta).
- **Linha de alerta** com severidade (alta, média).
- **Indicador de meta** (realizado / meta, com o semáforo).
- **Selos:** canal (LinkedIn/WhatsApp), situação do contato (5 situações), etapa do funil
  (5 etapas), pendência (sem empresa, sem área, sem cargo).
- **Diálogo de confirmação** de ação destrutiva, com e sem palavra a digitar
  (`useConfirm`).
- **Estados vazio, carregando e erro**, padronizados.

### 3. Navegação

Hoje há 6 itens no topo para o hunter e 7 para o admin. **No celular só aparecem "Envios de
hoje" e "Empresas"**; o resto fica escondido numa rolagem lateral. Pedimos o padrão de navegação
para desktop e celular (por exemplo, barra inferior ou menu recolhível no celular). O painel do
admin tem 6 abas, cada uma num endereço (`/painel?aba=...`).

### 4. Envios de hoje (prioridade máxima)

É a tela onde a AT acontece. Para cada etapa da cadência (abas LinkedIn 1, WhatsApp 1,
LinkedIn 2, WhatsApp 2, LinkedIn 3, com contagem), uma fila de cartões, um por lead, atrasados
primeiro.

Problema: **no celular cada cartão ocupa quase uma tela.** Os 5 campos de edição do lead (nome,
empresa, área, cargo, concordância "no/na/em") aparecem sempre, e o botão principal fica no
meio deles.

Pedimos um cartão em que:

- a ação principal (**Marcar como enviado**) e a secundária (**Copiar mensagem** ou **Abrir
  WhatsApp**) fiquem no topo e ao alcance do polegar;
- os campos de edição fiquem recolhidos e só apareçam quando falta um dado que a mensagem usa
  (os selos "sem empresa", "sem área" e "sem cargo" indicam isso);
- "Atrasado", a data prevista, o modelo da mensagem (ex.: "M1") e o funil ("Avançar no funil")
  continuem visíveis sem pesar.

Estados: carregando a fila, fila vazia ("Nada na fila de LinkedIn 1 para esta data"), erro, e
"Mostrar mais" a cada 50 cartões.

### 5. Indicadores do painel (admin)

Hoje são cerca de 13 blocos numa página só (10 KPIs, alertas, abastecimento, metas, execução por
hunter, envios por dia, ritmo entre etapas, funil, etapa que gerou a resposta e a AT, conversão
por setor e por área, tendência de 12 semanas, coortes). Os dados estão certos; **falta
hierarquia.**

Pedimos uma página que responda primeiro "a equipe está no ritmo desta semana e quem precisa de
ajuda?" (KPIs principais, alertas e metas) e deixe o detalhamento um nível abaixo (seções
recolhíveis, abas internas ou uma segunda vista). Os filtros do topo (intervalo, período, grupo,
subgrupo, hunter, setor, canal) continuam.

### 6. Demais telas

Contatos (tabela grande com edição na linha), Empresas, Importar conexões (colar texto e
pré-visualizar), Modelos (só leitura), Configurações e as outras abas do painel. Elas devem
seguir os componentes base. Os detalhes de cada uma estão no inventário.

## Restrições

- **Não muda regra nem dado.** O redesign troca só a apresentação. Etapas da cadência e do funil,
  rótulos e pontos vêm das listas `STEPS` e `FUNNEL` do código; use os nomes exatos.
- **Listas longas não renderizam tudo**: tabela com 50 por página; fila com 50 cartões por vez.
- **Ações destrutivas sempre confirmam**, num diálogo.
- **Ranking e pontuação são só do admin.** O hunter não vê placar.
- **Stack:** React + Tailwind 4 + shadcn/ui (Radix). Componentes novos devem ser possíveis
  nessa base. Ícones: lucide.
- **Língua:** português do Brasil, com os termos que a equipe usa (AT, lead, hunter, cadência,
  funil, Envios de hoje).

## O que esperamos receber

1. Tokens (cores, tipografia, espaçamento, raio, densidade).
2. Os componentes base acima, com estados.
3. Navegação em desktop e celular.
4. Envios de hoje em desktop e celular.
5. Indicadores em desktop.
6. As demais telas, depois de aprovados os itens 1 a 5.

A implementação segue no Claude Code, uma tela por PR, com capturas de antes e depois.
