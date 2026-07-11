/**
 * Cliente WhatsApp Cloud API (Meta) para Edge Functions.
 * Secrets esperados no Supabase:
 *   WHATSAPP_TOKEN              — token permanente (System User) ou temporário
 *   WHATSAPP_PHONE_NUMBER_ID    — Phone Number ID do número de envio
 *   WHATSAPP_BUSINESS_ACCOUNT_ID — opcional (WABA ID)
 *   WHATSAPP_GRAPH_VERSION      — opcional (default v22.0)
 */

export type WhatsAppSendOk = { ok: true; result: unknown; provider: "meta" };
export type WhatsAppSendFail = {
  ok: false;
  result: unknown;
  provider: "meta";
  error: string;
  httpStatus: number;
};

export type WhatsAppSendResult = WhatsAppSendOk | WhatsAppSendFail;

const corsSafe = (msg: string) => msg;

/** Normaliza telefone BR para E.164 sem '+' (ex.: 5562999999999). */
export function formatarNumeroBr(numero: string): string {
  let n = String(numero || "").replace(/\D/g, "");
  // remove zero à esquerda do DDD (ex.: 0629... → 629...)
  if (n.startsWith("0")) n = n.replace(/^0+/, "");
  if (!n.startsWith("55")) n = `55${n}`;
  return n;
}

function graphVersion(): string {
  const v = (Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v22.0").trim();
  return v.startsWith("v") ? v : `v${v}`;
}

export function metaCredentials():
  | { ok: true; token: string; phoneNumberId: string; wabaId: string | null }
  | { ok: false; error: string } {
  const token = (Deno.env.get("WHATSAPP_TOKEN") ?? "").trim();
  const phoneNumberId = (Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "").trim();
  const wabaId = (Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") ?? "").trim() || null;

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error:
        "Credenciais Meta ausentes. Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID nos Secrets das Edge Functions.",
    };
  }
  return { ok: true, token, phoneNumberId, wabaId };
}

/** Extrai mensagem legível do erro Graph API. */
export function extrairErroMeta(result: unknown): string {
  const r = result as {
    error?: {
      message?: string;
      error_user_msg?: string;
      error_user_title?: string;
      code?: number;
      error_data?: { details?: string };
      type?: string;
    };
  } | null;

  const err = r?.error;
  if (!err) return "Falha ao enviar via WhatsApp Cloud API";

  const parts = [
    err.error_user_title,
    err.error_user_msg,
    err.error_data?.details,
    err.message,
  ].filter(Boolean) as string[];

  let msg = parts[0] || "Falha ao enviar via WhatsApp Cloud API";

  // Dicas em PT para códigos comuns
  if (err.code === 190) {
    msg =
      "Token da Meta inválido ou expirado. Gere um token permanente (System User) e atualize WHATSAPP_TOKEN.";
  } else if (err.code === 131047) {
    msg =
      "Fora da janela de 24h: só é permitido template aprovado. Crie um template na Meta e use type=template.";
  } else if (err.code === 131026) {
    msg = "Mensagem não entregue (número inválido ou sem WhatsApp).";
  } else if (err.code === 133010) {
    msg = "Conta WhatsApp Business ainda não registrada/pronta na Cloud API.";
  }

  if (err.code != null && !msg.includes(String(err.code))) {
    msg = `${msg} (código Meta ${err.code})`;
  }
  return corsSafe(msg);
}

/**
 * Envia mensagem de texto livre (só funciona dentro da janela de 24h
 * ou em cenários de teste liberados pela Meta).
 */
export async function enviarTextoMeta(
  numero: string,
  mensagem: string
): Promise<WhatsAppSendResult> {
  const creds = metaCredentials();
  if (!creds.ok) {
    return {
      ok: false,
      provider: "meta",
      error: creds.error,
      httpStatus: 500,
      result: { error: creds.error },
    };
  }

  const to = formatarNumeroBr(numero);
  if (to.length < 12 || to.length > 15) {
    return {
      ok: false,
      provider: "meta",
      error: `Número inválido após formatação: ${to}`,
      httpStatus: 400,
      result: { error: "invalid_number", to },
    };
  }

  const url = `https://graph.facebook.com/${graphVersion()}/${creds.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: mensagem,
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    console.log("Resposta Meta Cloud API:", JSON.stringify(result));

    if (!response.ok) {
      return {
        ok: false,
        provider: "meta",
        error: extrairErroMeta(result),
        httpStatus: response.status,
        result,
      };
    }

    return { ok: true, provider: "meta", result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Erro Meta Cloud API:", msg);
    return {
      ok: false,
      provider: "meta",
      error: msg,
      httpStatus: 500,
      result: { error: msg },
    };
  }
}

/**
 * Envia template aprovado na Meta (necessário fora da janela de 24h).
 * components: array no formato da Graph API (body/header parameters).
 */
export async function enviarTemplateMeta(opts: {
  numero: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}): Promise<WhatsAppSendResult> {
  const creds = metaCredentials();
  if (!creds.ok) {
    return {
      ok: false,
      provider: "meta",
      error: creds.error,
      httpStatus: 500,
      result: { error: creds.error },
    };
  }

  const to = formatarNumeroBr(opts.numero);
  const url = `https://graph.facebook.com/${graphVersion()}/${creds.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: opts.templateName,
          language: { code: opts.languageCode || "pt_BR" },
          ...(opts.components?.length ? { components: opts.components } : {}),
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    console.log("Resposta Meta template:", JSON.stringify(result));

    if (!response.ok) {
      return {
        ok: false,
        provider: "meta",
        error: extrairErroMeta(result),
        httpStatus: response.status,
        result,
      };
    }

    return { ok: true, provider: "meta", result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      provider: "meta",
      error: msg,
      httpStatus: 500,
      result: { error: msg },
    };
  }
}
