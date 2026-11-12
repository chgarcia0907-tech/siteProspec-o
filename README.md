# Cadência Outbound

Plataforma de prospecção outbound dos hunters: cadência de 5 toques (LinkedIn e WhatsApp),
fila do dia, funil (AT → venda), ranking/competição por período e exportação para Google Sheets.

O projeto está conectado ao [Lovable](https://lovable.dev): commits no branch conectado
sincronizam com o editor. Leia o `AGENTS.md` antes de mudar a arquitetura — ele registra as
decisões de projeto (onde fica cada regra e por quê).

## Stack

- TanStack Start (React 19, roteamento por arquivos em `src/routes`) + Vite
- Supabase (Postgres, Auth, RLS) — cliente em `src/integrations/supabase`
- React Query, Tailwind CSS 4, shadcn/ui (`src/components/ui`)
- Vitest para testes das regras de negócio

## Onde fica cada coisa

| Pasta / arquivo | Conteúdo |
| --- | --- |
| `src/lib/cadencia.ts` | Regras da cadência, datas previstas (dias úteis), parser do LinkedIn, modelos de mensagem. Fonte única — telas, CSVs e exports importam daqui. |
| `src/lib/competition.ts` | Cálculo puro da pontuação/ranking. `competition.server.ts` carrega os dados com service role. |
| `src/lib/*.functions.ts` | Server functions (ações de admin, painel, períodos). Sempre validam `has_role`/senha antes do service role. |
| `src/hooks/useCadencia.ts` | Leitura e escrita dos dados do hunter (React Query + RLS). |
| `src/routes/_authenticated/*` | Telas logadas (hoje, contatos, importar, ranking, painel…). |
| `src/routes/api/public/*` | Endpoints CSV/JSON consumidos pela planilha (protegidos por token). |
| `src/integrations/supabase/types.ts` | Tipos gerados do banco. O tipo `Contact` deriva daqui. |

## Rodando localmente

Requer Node 22 (ou Bun). As variáveis públicas do Supabase já estão no `.env` versionado; segredos de servidor (service role, `ADMIN_PASSWORD`, `SHEET_EXPORT_TOKEN`) ficam no Lovable.

```sh
npm install
npm run dev
```

## Verificações

Rode antes de enviar mudanças (o CI em `.github/workflows/ci.yml` roda as mesmas):

```sh
npm run typecheck   # TypeScript
npm run lint:ci     # ESLint (sem regra de formatação)
npm test            # Vitest
npm run build       # build de produção
```

`npm run lint` inclui o prettier e hoje acusa muitos avisos de formatação no código gerado.
`npm run format` corrige, mas gera um diff grande — faça isso num commit separado, se quiser.

## Banco de dados e migrações

O esquema está espalhado em três lugares, em ordem cronológica:

1. **`supabase/migrations/`** — esquema inicial criado pelo Lovable Cloud (perfis, contatos,
   configurações, modelos, competição, função `ranking`, `sync_settings`). Não editar.
2. **`drizzle/migrations/`** — migrações posteriores, aplicadas em ordem pelo `drizzle-kit`
   (controle em `meta/_journal.json`): papéis de admin, períodos/grupos/snapshots, feriados,
   funil com `*_registrado_em`, tipo de período etc. **Migrações novas entram aqui**, com o
   próximo número da sequência. O `drizzle/schema.ts` fica vazio de propósito: as migrações
   são SQL escritas à mão.
3. **`pendente-pos-publicacao/`** — SQL que só pode rodar depois de publicar a versão do app
   que o entende (ex.: texto dos modelos com tags novas). Rodar manualmente e depois limpar.

Atenção: a tabela `admin_attempts` (bloqueio de tentativas de senha de admin) é usada pelo
código mas não aparece em nenhuma migração deste repositório. Recriar o banco do zero a partir
daqui exige criá-la à mão.

Depois de mudar o esquema, atualize `src/integrations/supabase/types.ts` (o Lovable
regenera esse arquivo) para o TypeScript acusar o que precisa mudar no código.
