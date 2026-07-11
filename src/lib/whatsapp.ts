import { supabase } from "@/integrations/supabase/client";

type WhatsAppSendBody = {
  success?: boolean;
  error?: string;
  provider?: string;
  details?: {
    message?: string;
    message_ptbr?: string;
    provider_message?: string;
    provider_message_ptbr?: string;
    error?: boolean | string | { message?: string; code?: number; error_user_msg?: string };
    error_key?: string;
  };
};

export type WhatsAppSendResult = { ok: boolean; motivo?: string };

function extrairMotivo(body: WhatsAppSendBody | null, fallback?: string | null): string {
  if (!body) return fallback || "Falha ao enviar WhatsApp";

  // Edge function Meta já devolve error em português quando possível
  if (body.error && typeof body.error === "string") {
    return body.error;
  }

  const d = body.details;
  const metaErr = d && typeof d === "object" && "error" in d ? (d as { error?: { message?: string; error_user_msg?: string; code?: number } }).error : null;

  const preferido =
    metaErr?.error_user_msg ||
    metaErr?.message ||
    d?.provider_message_ptbr ||
    d?.message_ptbr ||
    d?.provider_message ||
    d?.message ||
    (typeof d?.error === "string" ? d.error : null) ||
    fallback;

  const texto = String(preferido || "Falha ao enviar WhatsApp");

  if (/token.*expir|invalid.*oauth|code.?190|OAuthException/i.test(texto)) {
    return "Token da Meta inválido ou expirado. Atualize WHATSAPP_TOKEN no Supabase (token permanente).";
  }
  if (/131047|24.?hour|re-engagement|janela de 24/i.test(texto)) {
    return "Fora da janela de 24h: a Meta só permite template aprovado. Crie um template e envie com type=template.";
  }
  if (/disconnected|not reconnectable/i.test(texto)) {
    return "WhatsApp desconectado. Verifique a conexão do número na Meta/uazapi.";
  }
  if (/REACHOUT_TIMELOCK|temporary restriction|restrição temporária|463/i.test(texto)) {
    return "WhatsApp bloqueou temporariamente o envio de novas conversas (volume/qualidade).";
  }
  return texto;
}

/**
 * Envia mensagem via edge function whatsapp-send-message (Meta Cloud API).
 * Em erro HTTP, o supabase-js deixa data=null e o body fica em error.context (Response).
 */
export async function enviarWhatsAppMensagem(
  numero: string,
  mensagem: string
): Promise<WhatsAppSendResult> {
  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
      body: { numero, mensagem },
    });

    let body = (data as WhatsAppSendBody | null) ?? null;

    if (!body && error && typeof error === "object" && "context" in error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          body = (await ctx.clone().json()) as WhatsAppSendBody;
        } catch {
          try {
            body = (await ctx.json()) as WhatsAppSendBody;
          } catch {
            body = null;
          }
        }
      }
    }

    if (error || body?.error || body?.success === false) {
      console.error("Erro ao enviar WhatsApp:", error || body);
      return {
        ok: false,
        motivo: extrairMotivo(body, error instanceof Error ? error.message : null),
      };
    }

    return { ok: true };
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
    return {
      ok: false,
      motivo: e instanceof Error ? e.message : "Erro inesperado ao enviar WhatsApp",
    };
  }
}
