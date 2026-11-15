# Empresas e setores na Cadência Outbound

Versão do documento: 15/11/2026. Descreve o código do branch `reaplica/empresas-e-testes`
(PR chgarcia0907-tech/siteProspec-o#6) e a migração `20261113120000_companies_sectors.sql`.

## 0. Situação em produção

| Parte                                   | Estado                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banco (Supabase `ctxsmboaqbjgslctojeq`) | Migração **aplicada** em 13/11/2026. As tabelas `sectors`, `sector_templates`, `companies` e a coluna `contacts.company_id` existem.               |
| Código no `main`                        | **Revertido** (PRs #4 e #5). O site publicado não tem a aba Empresas nem a aba Setores e cadências, e o arquivo da migração também saiu do `main`. |
| Código para voltar                      | PR #6, aguardando aprovação. Traz de volta as telas, as regras e o arquivo da migração.                                                            |

Enquanto a #6 não entra, o banco tem as tabelas, mas nada no site as lê ou grava.

## 1. Dois conceitos que não se confundem

| Conceito                               | Onde fica                                                    | Exemplo                        | Para que serve                                                                             |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| **Setor da empresa** (ramo de atuação) | Tabela `sectors`, ligado à empresa por `companies.sector_id` | Varejo, Saúde, Indústria       | Escolhe qual cadência de mensagens o contato recebe                                        |
| **Área do contato**                    | Coluna `contacts.sector` (texto)                             | Tecnologia / TI, RH, Marketing | Preenche a tag `[DOR_DO_SETOR]` com um texto fixo (`SECTOR_PAIN` em `src/lib/cadencia.ts`) |

A coluna `contacts.sector` manteve o nome antigo para não quebrar a planilha, que ainda a
exporta com o cabeçalho "Setor". Na interface ela aparece como **Área**.

## 2. Modelo de dados

```
auth.users ──┬──< companies >── sectors ──< sector_templates
             │        │
             └──< contacts (company_id, opcional)
```

Lê-se: um hunter (`auth.users`) tem várias empresas e vários contatos; cada empresa tem um setor;
cada setor tem até 5 mensagens; um contato pode estar ligado a uma empresa.

### 2.1 `sectors` (ramos de atuação)

| Coluna                     | Tipo        | Regra                                                                                   |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `id`                       | uuid        | Chave                                                                                   |
| `name`                     | text        | Único sem diferenciar maiúsculas e espaços nas pontas (`lower(btrim(name))`)            |
| `active`                   | boolean     | Padrão `true`. Inativo some da lista do hunter, mas continua nas empresas que já o usam |
| `sort`                     | integer     | Ordem na lista (desempate pelo nome)                                                    |
| `created_at`, `updated_at` | timestamptz | `updated_at` atualizado por trigger                                                     |

Acesso: qualquer usuário logado lê. Escrita só pela service role, nas server functions do painel
(seção 5). Não existe política de escrita para hunters.

### 2.2 `sector_templates` (cadência de cada setor)

| Coluna       | Tipo        | Regra                                                                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| `sector_id`  | uuid        | Setor; apagar o setor apaga a cadência dele                                                       |
| `step`       | integer     | Etapa de 1 a 5 (as mesmas de `STEPS`: LinkedIn 1, WhatsApp 1, LinkedIn 2, WhatsApp 2, LinkedIn 3) |
| `code`       | text        | Código livre da mensagem (ex.: `VAR-IN01`)                                                        |
| `body`       | text        | Texto com as mesmas tags dos modelos padrão. Vazio significa "usar o modelo padrão"               |
| `updated_at` | timestamptz |                                                                                                   |

Chave: (`sector_id`, `step`). Acesso igual ao de `sectors`: leitura para logados e escrita só pela
service role.

### 2.3 `companies` (empresas prospectadas pelo hunter)

| Coluna                     | Tipo        | Regra                                                                                            |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `id`                       | uuid        | Chave                                                                                            |
| `user_id`                  | uuid        | Dono (hunter). Apagar a conta apaga as empresas dela                                             |
| `name`                     | text        | Obrigatório. Único por hunter, sem diferenciar maiúsculas e espaços nas pontas                   |
| `gender`                   | text        | Concordância nas mensagens: `masculino` ("no"), `feminino` ("na", padrão) ou `sem_artigo` ("em") |
| `sector_id`                | uuid        | Obrigatório. Um setor em uso não pode ser apagado (`ON DELETE RESTRICT`)                         |
| `week_start`               | date        | Segunda-feira da semana de prospecção                                                            |
| `period_id`                | uuid        | Período da competição ou ciclo, carimbado por trigger no cadastro (o ativo, senão o último)      |
| `created_at`, `updated_at` | timestamptz | `updated_at` atualizado por trigger                                                              |

Acesso (RLS `companies_own`): o hunter lê, cria, edita e apaga **só as próprias** empresas.
Duas empresas de hunters diferentes podem ter o mesmo nome; a plataforma não cruza hunters.

### 2.4 `contacts.company_id` (ligação do contato com a empresa)

| Coluna       | Tipo           | Regra                                                                            |
| ------------ | -------------- | -------------------------------------------------------------------------------- |
| `company_id` | uuid, opcional | Empresa do mesmo hunter. Apagar a empresa deixa o campo vazio e mantém o contato |

Os campos antigos `contacts.company` (texto) e `contacts.company_gender` continuam existindo,
porque planilha, ranking e mensagens leem deles. Dois triggers os mantêm em dia:

1. **`contacts_copy_company`** (antes de inserir ou alterar `company_id`, `company`,
   `company_gender` ou `user_id` no contato):
   1. com empresa ligada, copia o nome e a concordância dela para o contato, e qualquer edição
      manual desses dois campos é sobrescrita;
   2. empresa de outro hunter é recusada ("Empresa inválida para este contato");
   3. se o contato for transferido para outro hunter, perde a ligação e mantém o nome da empresa
      como texto.
2. **`companies_sync_contacts`** (depois de renomear a empresa ou trocar a concordância):
   atualiza todos os contatos ligados a ela.

Contato sem empresa ligada funciona como antes: empresa em texto livre e modelo padrão.

## 3. Fluxo de uso

### 3.1 Admin: setores e cadências (Painel Admin, aba "Setores e cadências")

1. Cria o setor pelo nome. A ordem é a próxima livre.
2. Edita nome, ordem e "Ativo".
3. Escreve as 5 mensagens, com código e pré-visualização ao lado (contato de exemplo e o nome do
   próprio admin). "Preencher vazias com o padrão" copia os modelos padrão para as etapas vazias.
4. A lista mostra quantas empresas usam cada setor e quantas etapas têm mensagem própria (ex.: 3/5).
5. Exclusão só para setor sem empresas, com a confirmação "EXCLUIR". Com empresas, a saída é
   desmarcar "Ativo".

### 3.2 Hunter: empresas da semana (aba Empresas)

1. Cola uma ou várias empresas, uma por linha (também aceita `;`).
2. Escolhe o setor (obrigatório, só os ativos), a concordância e um dia qualquer da semana; a
   tela mostra a semana de segunda a domingo.
3. A tela avisa quantas são novas e quantas já estão cadastradas; só as novas são gravadas, todas
   com o mesmo setor, concordância e semana.
4. A lista vem agrupada por semana (mais recente primeiro) e mostra, para cada empresa: nome e
   concordância editáveis, setor editável, o aviso "cadência do setor incompleta" quando falta
   mensagem em alguma etapa, o número de contatos ligados (ou "sem contatos") e o botão Excluir.
5. Sem nenhum setor ativo, o formulário é trocado pelo aviso "Peça ao administrador para criar os
   setores".

### 3.3 Hunter: ligar contatos às empresas

| Tela              | Como liga                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Importar conexões | Coluna "Empresa" com a empresa **sugerida** pelo headline do LinkedIn; o hunter pode trocar antes de importar |
| Contatos          | Seletor na coluna Empresa; "Texto livre (sem cadastro)" volta ao campo de texto                               |
| Envios de hoje    | Seletor "Vincular empresa…" em cada cartão, destacado quando o contato está sem empresa                       |

### 3.4 Envios de hoje: qual mensagem sai

Para cada contato e etapa, `pickTemplate` (`src/lib/fila.ts`) decide:

1. se o contato tem empresa ligada e o setor dela tem mensagem não vazia naquela etapa, usa essa
   mensagem;
2. senão, usa o modelo padrão da equipe (`message_templates`).

O cartão mostra o nome do setor e o código da mensagem usada (passando o mouse, diz se é do setor
ou o padrão). As tags são as mesmas em qualquer caso (`renderTemplate` em `cadencia.ts`).

No LinkedIn 1, a área e o cargo só são exigidos se a mensagem usar `[DOR_DO_SETOR]` ou `[CARGO]`.
A empresa continua sempre obrigatória.

A tela **Modelos** tem um seletor de cadência ("Modelo padrão da equipe" ou "Setor: ...") para o
hunter ver o texto que vai sair.

## 4. Regras puras (`src/lib/empresas.ts`, testes em `empresas.test.ts`)

| Função                           | O que faz                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `weekStartISO(data)`             | Segunda-feira da semana (domingo pertence à semana que começou na segunda anterior)                                                                                      |
| `weekEndISO(segunda)`            | Domingo da mesma semana                                                                                                                                                  |
| `normalizeCompany(nome)`         | Sem acentos, minúsculas, pontuação vira espaço (o `&` fica). Ex.: "Açúcar Guarani S.A." vira "acucar guarani s a"                                                        |
| `parseCompanyLines(texto)`       | Separa por linha ou `;`, tira vazios e repetidos (pela forma normalizada)                                                                                                |
| `matchCompany(texto, empresas)`  | Empresa cujo nome normalizado aparece como palavra inteira no texto; havendo várias, a de nome mais longo. "Itaú Unibanco" vence "Itaú"; "Vale" não casa com "Valuation" |
| `groupByWeek(empresas)`          | Agrupa por semana, mais recente primeiro, e ordena por nome                                                                                                              |
| `sortSectors(setores)`           | Pela ordem, depois pelo nome                                                                                                                                             |
| `missingSteps(cadência, etapas)` | Etapas sem mensagem própria do setor                                                                                                                                     |

A normalização da plataforma é **mais simples** que a `normEmp_()` do Controle de Prospecção:
não remove sufixos societários (ltda, s a, me...) nem corta em 60 caracteres. "Ambev" e
"Ambev S.A." são empresas diferentes na plataforma e a mesma no Controle.

## 5. Onde fica cada coisa

| Arquivo                                                               | Papel                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261113120000_companies_sectors.sql`            | Tabelas, RLS, índices e triggers                                                                                                                         |
| `src/lib/empresas.ts`                                                 | Tipos `Company`, `Sector`, `SectorTemplates` e as regras puras                                                                                           |
| `src/lib/fila.ts`                                                     | `pickTemplate` e `missingForMessage`                                                                                                                     |
| `src/lib/setores.functions.ts`                                        | Server functions do admin: `sectorSave`, `sectorSaveCadence`, `sectorDelete`, `sectorUsage` (todas conferem `has_role` antes de usar a service role)     |
| `src/hooks/useCadencia.ts`                                            | `useSectors`, `useSectorTemplates`, `useCompanies`, `useAddCompanies`, `useUpdateCompany`, `useDeleteCompany` (cliente do navegador, protegido pelo RLS) |
| `src/routes/_authenticated/empresas.tsx` e `src/components/empresas/` | Aba Empresas (`CompanyForm`, `CompanyList`)                                                                                                              |
| `src/components/painel/setores/`                                      | Aba Setores e cadências (`SetoresTab`, `SectorEditor`)                                                                                                   |
| `src/components/IndustrySelect.tsx`, `CompanySelect.tsx`              | Seletores de setor e de empresa, usados em várias telas                                                                                                  |
| `src/components/SectorSelect.tsx`                                     | Seletor da **área** do contato                                                                                                                           |
| `e2e/empresas.spec.ts`                                                | Testes de ponta a ponta do cadastro, da mensagem por setor e da cadência no painel                                                                       |

## 6. Dados disponíveis para integrações

O que a plataforma sabe sobre cada empresa cadastrada, útil para enviar ao Controle de Prospecção:

| Dado                  | Origem                                               |
| --------------------- | ---------------------------------------------------- |
| Identificador estável | `companies.id`                                       |
| Nome                  | `companies.name`                                     |
| E-mail do hunter      | `profiles.email` (mesmo `id` de `companies.user_id`) |
| Nome do hunter        | `profiles.display_name`                              |
| Setor                 | `sectors.name`, por `companies.sector_id`            |
| Semana de prospecção  | `companies.week_start`                               |
| Momento do cadastro   | `companies.created_at`                               |
| Contatos ligados      | `contacts` com o mesmo `company_id`                  |

O que a plataforma **não** tem hoje: núcleo do hunter, site ou domínio da empresa, CNPJ e
qualquer leitura da Base Ativa do Controle.
