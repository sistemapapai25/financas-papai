# WhatsApp Cloud API (Meta) — integração

O app envia mensagens pela **Cloud API oficial da Meta** via Edge Function `whatsapp-send-message`.

## Secrets no Supabase

Project Settings → Edge Functions → **Secrets** (ou CLI):

| Secret | Valor |
|--------|--------|
| `WHATSAPP_TOKEN` | Token de acesso (preferir **permanente** de System User) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID do número de envio |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID (opcional) |
| `WHATSAPP_GRAPH_VERSION` | Opcional, default `v22.0` |

**Nunca** commitar o token no Git.

### CLI (se logado)

```bash
supabase secrets set WHATSAPP_TOKEN="SEU_TOKEN" --project-ref ghzwyigouhvljubitowt
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="SEU_PHONE_NUMBER_ID" --project-ref ghzwyigouhvljubitowt
supabase secrets set WHATSAPP_BUSINESS_ACCOUNT_ID="SEU_WABA_ID" --project-ref ghzwyigouhvljubitowt
```

## Deploy das functions

Subir no GitHub **não** publica a function. Deploy:

```bash
supabase functions deploy whatsapp-send-message --project-ref ghzwyigouhvljubitowt
supabase functions deploy desafio-lembrete-vencimento --project-ref ghzwyigouhvljubitowt
supabase functions deploy contas-pagar-grupo --project-ref ghzwyigouhvljubitowt
```

Ou cole o código no painel (incluindo `_shared/whatsapp-meta.ts`).

## Token temporário vs permanente

- Token de **teste** no painel da Meta expira em ~24h.
- Para produção: **System User** no Business Manager → gerar token permanente com permissões `whatsapp_business_messaging` e `whatsapp_business_management`.

## Janela de 24 horas

Texto livre só funciona se o destinatário interagiu nas últimas 24h (ou em cenários de teste liberados).  
Fora disso: use **template** aprovado.

Body opcional da function:

```json
{
  "numero": "62999999999",
  "template": "nome_do_template",
  "language": "pt_BR",
  "components": []
}
```

## Grupos

A Cloud API **não** envia para grupos `@g.us` como a uazapi.  
O resumo de Contas a Pagar em grupo ainda usa `UAZAPI_*` se configurado; caso contrário, falha com mensagem clara.

## Teste rápido

```bash
curl -X POST "https://ghzwyigouhvljubitowt.supabase.co/functions/v1/whatsapp-send-message" \
  -H "Authorization: Bearer ANON_KEY" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"numero\":\"62XXXXXXXXX\",\"mensagem\":\"Teste Cloud API\"}"
```
