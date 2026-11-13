---
name: publicar
description: Leva o trabalho do branch dev para produção abrindo o pull request dev -> main, com título em Conventional Commits e descrição do que muda. Use quando pedirem para publicar, subir para produção, fazer deploy ou abrir o PR para o main.
---

# Publicar (dev → main)

Produção é o branch `main`: a Vercel publica cada push nele. Nunca envie direto para o `main`.

1. Confirme que está tudo no `dev` remoto: `git status` limpo e `git log origin/dev..dev`
   vazio. Se houver commits locais, rode a skill `verificar` e faça o push do `dev`.
2. Liste o que vai entrar: `git fetch origin main` e `git log --oneline origin/main..dev`.
   Se não houver nada, avise e pare.
3. Veja se já existe PR aberto `dev` → `main`; se existir, não abra outro — diga o link.
4. Confira se algum commit depende de migração ainda não aplicada em produção (arquivos novos
   em `supabase/migrations/` desde o `main`). Se depender, diga isso no topo do PR: a
   migração precisa ser aplicada (`bun run db:push`) antes do merge.
5. Abra o PR com:
   - título em Conventional Commits, resumindo o conjunto (ex.: `feat: ...`);
   - descrição em português: o que muda para o usuário, o que muda por dentro, como foi
     validado (verificações e testes de ponta a ponta) e o que fazer depois do merge.
6. Sugira o merge com "Create a merge commit" (mantém os commits do `dev` no histórico) e
   lembre de testar o deploy de preview do `dev` na Vercel antes.

Não faça o merge: quem aprova é uma pessoa.
