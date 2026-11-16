# Estudo: telefone automático para contatos importados do LinkedIn (Apollo)

Data: 16/11/2026 · Status: proposta, nada implementado

## 1. Por que fazer

As etapas 2 e 4 da cadência são WhatsApp. Um contato sem telefone não entra nelas
(`QueueCard` exige pelo menos 10 dígitos em `contact.phone`). Hoje o hunter procura o número
e digita na tabela de contatos. Se o telefone vier junto com a importação, mais contatos
recebem a cadência completa, e isso ajuda a métrica-guia (ATs por semana).

## 2. O que o app tem hoje

| Item | Situação |
| --- | --- |
| Importação (`/importar`) | O hunter cola o texto da página de conexões, e `parseLinkedInConnections` extrai **só** `name`, `headline` e `connected_at` |
| `contacts.phone` | `text`, preenchido à mão em `ContactRow` |
| `contacts.company` | Preenchido à mão. O headline costuma trazer a empresa ("Diretor na Acme"), mas hoje só o cargo é aproveitado (`jobTitleFromHeadline`) |
| URL do perfil, e-mail, domínio | **Não existem.** O texto colado não traz links |
| Servidor | TanStack Start na Vercel: `createServerFn` com `requireSupabaseAuth`, rotas públicas em `src/routes/api/public/*` e `supabaseAdmin` (service role) |

**O principal obstáculo é a identificação, não a chamada à API.** A Apollo encontra a pessoa
pelos dados que recebe (`email`, `linkedin_url`, `name` + `organization_name`/`domain`, ou
`id`). A documentação avisa que só o nome costuma voltar com `200` e nenhum registro
encontrado. Com o que importamos hoje (nome e headline), a taxa de acerto vai ser baixa, e
nomes repetidos podem trazer o telefone da pessoa errada.

## 3. Como a Apollo entrega o telefone (resumo da doc)

- `POST /api/v1/people/match` busca 1 pessoa. `POST /api/v1/people/bulk_match` busca **até 10** pessoas por chamada.
- `reveal_phone_number=true` exige `webhook_url` (HTTPS público) **ou** `poll_only=true`. Sem nenhum dos dois, a API devolve `400`.
- A resposta imediata traz `person.id`, nome, cargo, empresa e `match_confidence` (`high`/`medium`/`low`/`none`), mas **não** traz o celular.
- O celular chega depois, por `POST` no webhook: `people[].id` e `phone_numbers[]` com `sanitized_number`, `type_cd` (`mobile`, `work_direct`…), `status_cd` e `confidence_cd`.
- A Apollo pode reenviar o mesmo webhook, então o endpoint precisa ser idempotente.
- Alternativa ao webhook: `poll_only=true` e consulta posterior pelo `request_id_str` (só quando `phone_enrichment.status = pending`).
- Créditos: 1 crédito pelos dados demográficos ou e-mail, **+8 se vier celular** (até 9 por pessoa). Sem dado novo, não há cobrança. O `run_waterfall_phone` (fontes de terceiros) custa de 8 a 25 créditos ou mais, e alguns fornecedores cobram mesmo quando não acham nada. **Não usar no início.**
- Limite: o exemplo de `429` da documentação mostra 600 chamadas por hora no `match`. O limite real depende do plano (Settings → Integrations → API Keys → Usage).

## 4. Como melhorar a identificação (decisão principal)

Opções, da mais barata para a mais precisa:

1. **Empresa a partir do headline** (`companyFromHeadline`, o complemento de `jobTitleFromHeadline`):
   corta em " na ", " no ", " @ ", " at ", "|" e envia `name` + `organization_name`.
   Não muda nada para o hunter. A precisão é média: headline sem empresa ("Graduando em…") não
   tem como ser buscado.
2. **Ler os links do que já é colado.** Quando o hunter copia a página com Ctrl+A e Ctrl+C, a
   área de transferência também guarda uma versão `text/html` com os
   `<a href="https://www.linkedin.com/in/…">`. No `onPaste` do `Textarea`, dá para ler
   `e.clipboardData.getData("text/html")`, associar cada link ao nome e gravar
   `linkedin_url`. O fluxo do hunter continua igual, e a URL do perfil é o identificador
   mais confiável da Apollo. **Hipótese a validar:** colar a página real no Chrome e conferir se
   os links aparecem e em que ordem.
3. **Importar o CSV oficial do LinkedIn** (Configurações → Obter uma cópia dos seus dados →
   Conexões). O `Connections.csv` traz nome, sobrenome, URL, empresa, cargo e data da conexão,
   e às vezes e-mail. É o mais preciso, mas o LinkedIn demora alguns minutos para gerar o
   arquivo. Serve como importação "em lote", ao lado da colagem.

**Recomendação:** fazer a 1 já (é barata e serve de reserva) e a 2 como caminho principal,
validada antes. A 3 fica como alternativa se a 2 não funcionar.

Em todos os casos, **valide a resposta**: aceite só `match_confidence` `high`/`medium` e
compare o nome devolvido com o nosso (sem acento e sem diferenciar maiúsculas). Assim
evitamos gravar o telefone de um homônimo.

## 5. Arquitetura proposta

```
/importar ──insert──▶ contacts (linkedin_url, company)
     │                          │
     └─ ou botão "Buscar telefones" (BulkActions em /contatos)
                                ▼
 enrichPhones (server fn, requireSupabaseAuth)
   ├─ filtra contatos do próprio hunter, sem telefone e ainda não consultados
   ├─ verifica o orçamento de créditos
   ├─ bulk_match (lotes de 10) + reveal_phone_number + webhook_url
   └─ grava phone_enrichments (status 'pending', apollo_person_id, match_confidence)
                                ▼
 Apollo ──POST──▶ /api/public/apollo/webhook?token=…
   ├─ valida o token (APOLLO_WEBHOOK_TOKEN, timingSafeEqual como no export-sheet)
   ├─ para cada people[].id → phone_enrichments → contact
   ├─ pickBestPhone (celular válido e de alta confiança primeiro, +55 primeiro)
   └─ só preenche contacts.phone se estiver vazio; marca 'found'/'not_found'
```

### 5.1 Banco (`bun run db:new phone_enrichment`, depois `db:push` e `db:types`)

- `contacts.linkedin_url text not null default ''`
- `contacts.phone_source text not null default 'manual'` (`'manual' | 'apollo'`), para mostrar a origem na tela e para fins de LGPD.
- Tabela `phone_enrichments`:
  `id`, `contact_id` (FK com `on delete cascade`), `user_id`, `status`
  (`pending | found | not_found | no_match | error`), `apollo_person_id`, `match_confidence`,
  `numbers jsonb` (todos os números devolvidos, para trocar se o primeiro estiver errado),
  `credits int`, `requested_at`, `received_at`.
  RLS: o hunter só **lê** as próprias linhas. Toda escrita passa pelo service role.
- Uma consulta por contato (índice único em `contact_id`) para não gastar créditos duas vezes.

### 5.2 Código, seguindo o padrão do repositório

| Arquivo | Conteúdo |
| --- | --- |
| `src/lib/enriquecimento.ts` + `.test.ts` | Funções puras: `companyFromHeadline`, `splitName`, `matchPayload(contact)`, `isSamePerson(nosso, apollo)`, `pickBestPhone(phone_numbers)`, `formatPhoneBR` |
| `src/lib/enriquecimento.server.ts` | Cliente HTTP da Apollo (`x-api-key` de `APOLLO_API_KEY`), lotes de 10, tratamento de `429` com espera |
| `src/lib/enriquecimento.functions.ts` | `enrichPhones({ contactIds })` e `enrichmentUsage()` (créditos gastos no mês) |
| `src/routes/api/public/apollo/webhook.ts` | Recebe o resultado, idempotente (não grava se já estiver `found`/`not_found`) |
| `useImportContacts` | Passa a usar `.insert(...).select("id")` para devolver os IDs criados e, se a busca automática estiver ligada, chama `enrichPhones` |
| `ContactRow` / `QueueCard` | Selo "buscando…" ou "via Apollo" ao lado do telefone |

Segredos novos na Vercel: `APOLLO_API_KEY`, `APOLLO_WEBHOOK_TOKEN` e `PUBLIC_APP_URL` (base do
`webhook_url`). A documentação não descreve uma assinatura HMAC do webhook, então a única
proteção é o token na URL. Por isso o handler só aceita `people[].id` que já esteja em
`phone_enrichments` como `pending`.

### 5.3 Webhook ou polling

- **Webhook (recomendado em produção):** não ocupa função na Vercel enquanto espera.
- **`poll_only` (para desenvolvimento local):** o webhook exige HTTPS público, e em local é
  preciso usar webhook.site ou um túnel. Uma opção simples é aceitar os dois modos na mesma
  server function, controlados por uma variável de ambiente.

## 6. Custos e controle

- Custo esperado por contato: 9 créditos quando vem celular, 1 quando vem só o dado
  demográfico, 0 quando não há correspondência.
- Exemplo: 300 contatos por semana × 40% com celular ≈ 300×1 + 120×8 = **~1.260 créditos por semana**.
  A cobertura de celulares brasileiros na Apollo é desconhecida e **precisa ser medida no
  piloto**. Os 40% são só um palpite.
- Proteções:
  1. Um teto mensal (`enrichment_settings.monthly_credit_cap`) verificado antes de cada lote, com o gasto somado de `phone_enrichments.credits`.
  2. Começar com um **botão manual** sobre os contatos selecionados. A busca automática na importação fica como opção, ligada por hunter ou pelo painel, depois do piloto.
  3. Nunca consultar um contato que já tem telefone ou que já foi consultado.
  4. Waterfall desligado.

## 7. LGPD e cuidados

- Telefone celular é dado pessoal. A base legal provável é o legítimo interesse (prospecção
  B2B). Registrar a origem (`phone_source = 'apollo'`, data) e permitir apagar a pedido.
- Telefone digitado pelo hunter nunca é sobrescrito.
- Os números devolvidos ficam em `phone_enrichments.numbers`, visíveis só para o dono e para o
  admin. Não entram nos CSVs públicos da planilha sem uma decisão explícita.
- Confirmar se o plano Apollo da Poli Júnior permite uso da API, e quantos créditos tem.

## 8. Plano em fases

1. **Piloto sem código (1 dia):** separar ~20 contatos reais (nome, empresa do headline e,
   se possível, URL), rodar o `people/match` com `reveal_phone_number` (curl + webhook.site,
   ou o conector Apollo do Claude) e medir: % com match `high/medium`, % com celular, % de
   número correto (o hunter confere) e créditos gastos. **Decidir a partir daqui.**
2. **Identificação:** `companyFromHeadline` preenchendo `company` na importação (já ajuda as
   mensagens) e, se validada, a captura de `linkedin_url` pelo HTML colado.
3. **Busca manual:** migração, server function, webhook e botão "Buscar telefones" em `BulkActions`, com teto de créditos.
4. **Busca automática:** opção na importação, mais um painel de consumo em `/painel`.

## 9. Perguntas em aberto

- Qual é o plano Apollo e qual a cota de créditos por mês? A API está liberada?
- O orçamento é por hunter ou global?
- A colagem com Ctrl+A traz `text/html` com os links dos perfis? (testar no Chrome e no Edge)
- Qual o percentual mínimo de acerto no piloto para valer o custo?
