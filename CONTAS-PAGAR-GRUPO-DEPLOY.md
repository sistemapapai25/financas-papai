# Deploy — Resumo diário de Contas a Pagar no grupo do WhatsApp

> Criado em 2026-06-23. Envia ao **grupo** do WhatsApp uma mensagem única com as contas
> (DESPESA, em aberto) que **vencem hoje** + as **atrasadas**. Espelha a arquitetura do
> lembrete de desafios (edge function + cron + uazapiGO + template editável).

## Arquivos no repositório

- `supabase/functions/contas-pagar-grupo/index.ts` — a edge function.
- `supabase/migrations/20260623120000_contas_pagar_grupo_template.sql` — template editável (tela Configuração de Mensagens).
- `src/pages/ContasAPagar.tsx` — card "Resumo no grupo do WhatsApp" (listar grupos, pré-visualizar, enviar agora).

## ⚠️ Lembrete: subir no GitHub NÃO publica nada no Supabase

A edge function, a migration e o cron precisam ser aplicados **manualmente no painel do Supabase**
(projeto ref `ghzwyigouhvljubitowt`).

---

## Passo 1 — Deploy da edge function

1. Supabase → **Edge Functions** → **Create a new function**.
2. Nome/slug: **`contas-pagar-grupo`** (confira a URL: `.../functions/v1/contas-pagar-grupo` — o padrão "hyper-action" precisa ser trocado ANTES do deploy).
3. Cole o conteúdo de `supabase/functions/contas-pagar-grupo/index.ts`, **removendo a 1ª linha** `import "../deno-shim.d.ts";` (o bundler do painel não aceita).
4. **Deploy**.

## Passo 2 — Criar o template editável

No Supabase → **SQL Editor**, rode o conteúdo de
`supabase/migrations/20260623120000_contas_pagar_grupo_template.sql`.
Depois ele aparece na tela **Configuração de Mensagens** como
"Resumo diario de Contas a Pagar (grupo)".

Variáveis do template: `{data}` `{lista}` `{total}` `{qtd}` `{qtd_hoje}` `{qtd_atrasadas}`.
A linha de cada conta (`{lista}`) é montada pelo código: `• Descrição — R$ valor (vence hoje / atrasada)`.

## Passo 3 — Descobrir o JID do grupo

1. Abra a tela **Contas a Pagar** no sistema.
2. No card "Resumo no grupo do WhatsApp", clique **Listar grupos**.
3. Clique **Usar** no grupo certo (salva o JID no navegador). Ou copie o JID (`120363...@g.us`) e cole no campo.
4. Clique **Pré-visualizar** para ver a mensagem e **Enviar ao grupo agora** para testar de verdade.

> Se "Listar grupos" não trouxer nada (depende da versão da uazapiGO), pegue o JID pelo painel/app
> da uazapiGO e cole no campo manualmente.

## Passo 4 — Envio automático às 8h (cron + secret)

O envio do navegador (Passo 3) usa o JID salvo localmente. **O cron das 8h NÃO enxerga isso** —
ele precisa do JID num secret.

1. Supabase → **Settings → Edge Functions → Secrets** → adicione:
   - `CONTAS_PAGAR_GRUPO_ID` = o JID do grupo (ex.: `120363012345678901@g.us`)
   - (opcional) `ENABLE_CONTAS_PAGAR_GRUPO` = `true` (default já é `true`)
   - `UAZAPI_BASE_URL` / `UAZAPI_TOKEN` já existem (reaproveitados do lembrete de desafios).
2. SQL Editor — primeiro **copie o Authorization** do cron que já funciona (desafios):
   ```sql
   select jobid, jobname, schedule, command
   from cron.job
   where jobname ilike '%lembrete%' or jobname ilike '%contas%';
   ```
3. Crie o cron diário (use o MESMO header Authorization do job de desafios):
   ```sql
   select cron.schedule(
     'contas-pagar-grupo-diario',
     '0 8 * * *',
     $$
     select net.http_post(
       url := 'https://ghzwyigouhvljubitowt.supabase.co/functions/v1/contas-pagar-grupo',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer COLE_AQUI_O_MESMO_TOKEN_DO_JOB_DE_DESAFIOS'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Para refazer/atualizar: `select cron.unschedule('contas-pagar-grupo-diario');` e rode de novo.

> Horário: `0 8 * * *` é o mesmo schedule do lembrete de desafios — então o resumo sai junto, às 8h.
> Quando não houver nenhuma conta vencendo/atrasada, a função **não envia** (não polui o grupo).

## Modos da função (body do POST)

- `{ "listar_grupos": true }` → lista grupos (nome + JID).
- `{ "dry_run": true, "grupo_id": "..." }` → devolve a mensagem montada **sem enviar**.
- `{ "grupo_id": "...@g.us" }` → envia para esse grupo (ignora o secret).
- `{}` → envio normal do cron (usa o secret `CONTAS_PAGAR_GRUPO_ID`).
