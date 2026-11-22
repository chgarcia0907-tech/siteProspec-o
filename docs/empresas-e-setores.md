# Empresas e setores na Cadência Outbound

Versão do documento: 22/11/2026. Descreve empresas, setores, cadências por setor e a evolução com
subsetor e persona (migração `20261122180804_setor_subsetor_persona.sql`).

## 0. Situação

| Parte                                    | Estado                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empresas e setores (PR #6)               | No `dev` e no `main`. Migração `20261113120000_companies_sectors.sql` aplicada em 13/11/2026 no Supabase `ctxsmboaqbjgslctojeq`.                                                                                                                                                                                |
| Subsetor e persona: migração             | `20261122180804_setor_subsetor_persona.sql`, aditiva, já aplicada em produção (nunca editar). As correções (pai do setor não troca, acento solto, permissões das funções de persona, mensagem só com espaços) estão em `20261122185416_endurece_subsetor_persona.sql`, que só vale depois do `bun run db:push`. |
| Subsetor e persona: regras (`src/lib/`)  | `personas.ts`, `resolveTemplate` em `fila.ts` e os auxiliares de `empresas.ts` já existem, com testes. Ainda não são usados pelas telas.                                                                                                                                                                        |
| Subsetor e persona: telas e server funcs | Entram em PRs seguintes (uma tela por PR). Até lá o app se comporta como antes: só setores de primeiro nível e cadência "qualquer persona".                                                                                                                                                                     |

## 1. Dois conceitos que não se confundem

| Conceito                               | Onde fica                                                    | Exemplo                        | Para que serve                                                                             |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| **Setor da empresa** (ramo de atuação) | Tabela `sectors`, ligado à empresa por `companies.sector_id` | Varejo, Saúde, Indústria       | Escolhe qual cadência de mensagens o contato recebe                                        |
| **Área do contato**                    | Coluna `contacts.sector` (texto)                             | Tecnologia / TI, RH, Marketing | Preenche a tag `[DOR_DO_SETOR]` com um texto fixo (`SECTOR_PAIN` em `src/lib/cadencia.ts`) |

Além desses dois, há dois conceitos novos:

| Conceito     | Onde fica                                                    | Exemplo                | Para que serve                                                     |
| ------------ | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------ |
| **Subsetor** | Linha de `sectors` com `parent_id`; `companies.subsector_id` | Indústria › Metalurgia | Cadência mais específica que a do setor                            |
| **Persona**  | `contacts.persona` e `sector_templates.persona` (lista fixa) | Owner da Operação      | Papel do contato na decisão; escolhe a mensagem dentro da cadência |

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

| Coluna                     | Tipo        | Regra                                                                                       |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `id`                       | uuid        | Chave                                                                                       |
| `name`                     | text        | Único sem diferenciar maiúsculas e espaços nas pontas (`lower(btrim(name))`)                |
| `active`                   | boolean     | Padrão `true`. Inativo some da lista do hunter, mas continua nas empresas que já o usam     |
| `sort`                     | integer     | Ordem na lista (desempate pelo nome)                                                        |
| `parent_id`                | uuid        | Vazio = setor de primeiro nível; preenchido = subsetor daquele setor (`ON DELETE RESTRICT`) |
| `created_at`, `updated_at` | timestamptz | `updated_at` atualizado por trigger                                                         |

Acesso: qualquer usuário logado lê. Escrita só pela service role, nas server functions do painel
(seção 5). Não existe política de escrita para hunters.

Subsetor (regras do banco, trigger `sectors_check_level`): só um nível (o pai não pode ter pai);
o pai **não muda** depois de criado ("O setor pai não pode ser trocado"); o nome é único dentro do
mesmo pai (pode haver "Outros" em dois setores). O subsetor tem `active` e `sort` próprios e a
cadência dele fica em `sector_templates` com o `sector_id` do subsetor. Nenhum subsetor é criado
pela migração: o admin cria pela tela.

### 2.2 `sector_templates` (cadência de cada setor)

| Coluna       | Tipo        | Regra                                                                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| `sector_id`  | uuid        | Setor ou subsetor; apagar o setor apaga a cadência dele                                           |
| `persona`    | text        | `''` = qualquer persona (as linhas que já existiam) ou uma das 4 chaves da seção "Personas"       |
| `step`       | integer     | Etapa de 1 a 5 (as mesmas de `STEPS`: LinkedIn 1, WhatsApp 1, LinkedIn 2, WhatsApp 2, LinkedIn 3) |
| `code`       | text        | Código livre da mensagem (ex.: `VAR-IN01`)                                                        |
| `body`       | text        | Texto com as mesmas tags dos modelos padrão. Vazio significa "usar o modelo padrão"               |
| `updated_at` | timestamptz |                                                                                                   |

Chave: (`sector_id`, `persona`, `step`). `persona` é `NOT NULL DEFAULT ''` (e não nulo) para que o
`upsert` do PostgREST continue achando o conflito pela chave primária; a versão publicada, que
grava sem `persona`, segue funcionando. Acesso igual ao de `sectors`: leitura para logados e escrita só pela
service role.

### 2.3 `companies` (empresas prospectadas pelo hunter)

| Coluna                     | Tipo        | Regra                                                                                                  |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `id`                       | uuid        | Chave                                                                                                  |
| `user_id`                  | uuid        | Dono (hunter). Apagar a conta apaga as empresas dela                                                   |
| `name`                     | text        | Obrigatório. Único por hunter, sem diferenciar maiúsculas e espaços nas pontas                         |
| `gender`                   | text        | Concordância nas mensagens: `masculino` ("no"), `feminino` ("na", padrão) ou `sem_artigo` ("em")       |
| `sector_id`                | uuid        | Obrigatório, sempre um setor de **primeiro nível**. Em uso não pode ser apagado (`ON DELETE RESTRICT`) |
| `subsector_id`             | uuid        | Opcional. Precisa ser filho de `sector_id` (trigger `companies_check_sector`)                          |
| `week_start`               | date        | Segunda-feira da semana de prospecção                                                                  |
| `period_id`                | uuid        | Período da competição ou ciclo, carimbado por trigger no cadastro (o ativo, senão o último)            |
| `created_at`, `updated_at` | timestamptz | `updated_at` atualizado por trigger                                                                    |

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

### 2.5 `contacts.persona` e a sugestão

`contacts.persona` é texto anulável com CHECK nas 4 chaves. **Nulo quer dizer "sugerida"**: a
persona é calculada na hora pelo cargo (`suggestPersona`) e não fica gravada. Gravar um valor,
mesmo igual à sugestão, quer dizer "confirmada pelo hunter" e tira o selo "sugerida". Assim, mudar a
regra corrige os contatos que ainda não foram confirmados. O trigger **não** copia subsetor nem
persona para o contato: o subsetor é lido pela empresa (`company_id`).

## Personas

Lista fixa em `src/lib/personas.ts` (`PERSONAS`), nesta ordem:

| Chave                    | Rótulo                 | Exemplos de cargo                       |
| ------------------------ | ---------------------- | --------------------------------------- |
| `owner_processo`         | Owner do Processo      | analista, assistente, supervisor, líder |
| `owner_operacao`         | Owner da Operação      | gerente, head, gestor                   |
| `patrocinador_executivo` | Patrocinador Executivo | CEO, diretor, sócio, fundador           |
| `owner_tecnologia`       | Owner da Tecnologia    | CIO, CTO, TI, sistemas                  |

Regra da sugestão (`matchPersona`/`suggestPersona`): texto sem acento e em minúsculas, palavra
inteira. Vale a primeira regra que casar, nesta prioridade: tecnologia, patrocinador, operação,
processo. "Coordenador" é operação quando o texto cita operação, logística, produção, engenharia
ou manutenção; senão é processo. Exceções: "desenvolvimento de negócios", "desenvolvimento
comercial" e "business development" não são tecnologia; "product owner" e "process owner" não são
patrocinador. Vale o cargo; sem pista no cargo, o headline; sem pista nenhuma, Owner da Operação.

**Par TS/SQL:** `suggestPersona`/`matchPersona` (TS) ↔ `suggest_persona`/`match_persona` (SQL).
O SQL existe porque o trigger `stamp_resposta_origem` precisa da mesma persona que a fila mostrou.
Mudou uma palavra? Crie outra migração (nunca edite uma aplicada). O teste de guarda em
`personas.test.ts` confere que o SQL carrega as mesmas palavras, mas não a semântica.

## 3. Fluxo de uso

### 3.1 Admin: setores e cadências (Painel Admin, aba "Setores e cadências")

1. Cria o setor pelo nome (e, com um setor selecionado, subsetores dele). A ordem é a próxima livre.
2. Edita nome, ordem e "Ativo".
3. Escreve as 5 mensagens ("qualquer persona" e, se quiser, uma cadência por persona), com código e pré-visualização ao lado (contato de exemplo e o nome do
   próprio admin). "Preencher vazias com o padrão" copia os modelos padrão para as etapas vazias.
4. A lista mostra quantas empresas usam cada setor e quantas etapas têm mensagem própria (ex.: 3/5).
5. Exclusão só para setor sem empresas, com a confirmação "EXCLUIR". Com empresas, a saída é
   desmarcar "Ativo".

### 3.2 Hunter: empresas da semana (aba Empresas)

1. Cola uma ou várias empresas, uma por linha (também aceita `;`).
2. Escolhe o setor (obrigatório) e, se houver, o subsetor (opcional; só os ativos), a concordância e um dia qualquer da semana; a
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

Para cada contato e etapa, `resolveTemplate` (`src/lib/fila.ts`) usa a **primeira mensagem não
vazia** nesta ordem:

1. subsetor da empresa + persona do contato;
2. subsetor da empresa, qualquer persona;
3. setor da empresa + persona do contato;
4. setor da empresa, qualquer persona;
5. modelo padrão da equipe (`message_templates`).

Empresa sem subsetor começa no nível 3; contato sem empresa (ou setor sem mensagem) cai no padrão.
A persona do contato é a **efetiva**: a gravada ou, se for nula, a sugerida pelo cargo
(`contactPersona`). Setor ou subsetor inativo continua valendo para quem já o usa. Corpo só com
espaços conta como vazio.

`pickTemplate` continua existindo como forma compatível (só setor, qualquer persona, sem
subsetor), até cada tela migrar para `resolveTemplate`.

**Par TS/SQL:** `resolveTemplate` (TS) ↔ `stamp_resposta_origem` (SQL, que carimba
`contacts.resposta_modelo` com o código da mensagem em uso). Mesma ordem dos cinco níveis; ao
mudar uma, revise a outra.

O cartão mostra o nome do setor e o código da mensagem usada (passando o mouse, `templateOriginLabel`
diz de onde veio, ex.: "Indústria › Metalurgia · Owner da Operação", "Indústria · qualquer persona"
ou "Modelo padrão da equipe"). As tags são as mesmas em qualquer caso (`renderTemplate` em `cadencia.ts`).

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
| `topSectors`, `subsectorsOf`     | Setores de primeiro nível e subsetores de um setor, na ordem do admin                                                                                                    |
| `sectorPath(...)`                | Nome para exibir: "Indústria" ou "Indústria › Metalurgia"                                                                                                                |
| `sectorOptions(...)`             | Opções do seletor setor › subsetor (só ativos, mais o valor atual); `parseSectorOption` decodifica o valor                                                               |
| `cadenceGaps(...)`               | Etapas sem mensagem "qualquer persona" no subsetor nem no setor (aviso de cadência incompleta)                                                                           |
| `personaFilled(...)`             | Etapas preenchidas na aba de uma persona (contador do painel)                                                                                                            |

A normalização da plataforma é **mais simples** que a `normEmp_()` do Controle de Prospecção:
não remove sufixos societários (ltda, s a, me...) nem corta em 60 caracteres. "Ambev" e
"Ambev S.A." são empresas diferentes na plataforma e a mesma no Controle.

## 5. Onde fica cada coisa

| Arquivo                                                               | Papel                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261113120000_companies_sectors.sql`            | Tabelas, RLS, índices e triggers                                                                                                                         |
| `src/lib/empresas.ts`                                                 | Tipos `Company`, `Sector`, `SectorTemplates` e as regras puras                                                                                           |
| `supabase/migrations/20261122180804_setor_subsetor_persona.sql`       | Subsetor, persona, triggers de nível e `suggest_persona`/`stamp_resposta_origem`                                                                         |
| `src/lib/personas.ts`                                                 | `PERSONAS`, `matchPersona`, `suggestPersona`, `contactPersona`                                                                                           |
| `src/lib/fila.ts`                                                     | `resolveTemplate`, `templateOriginLabel`, `pickTemplate` e `missingForMessage`                                                                           |
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
| Subsetor              | `sectors.name`, por `companies.subsector_id`         |
| Semana de prospecção  | `companies.week_start`                               |
| Momento do cadastro   | `companies.created_at`                               |
| Contatos ligados      | `contacts` com o mesmo `company_id`                  |

O que a plataforma **não** tem hoje: núcleo do hunter, site ou domínio da empresa, CNPJ e
qualquer leitura da Base Ativa do Controle.
