import { supabase } from "@/integrations/supabase/client";

type WhatsAppSendBody = {
  success?: boolean;
  error?: string;
  details?: {
    message?: string;
    message_ptbr?: string;
    provider_message?: string;
    provider_message_ptbr?: string;
    error?: boolean | string;
    error_key?: string;
  };
};

export type WhatsAppSendResult = { ok: boolean; motivo?: string };

function extrairMotivo(body: WhatsAppSendBody | null, fallback?: string | null): string {
  if (!body) return fallback || "Falha ao enviar WhatsApp";

  const d = body.details;
  const preferido =
    d?.provider_message_ptbr ||
    d?.message_ptbr ||
    d?.provider_message ||
    d?.message ||
    (typeof d?.error === "string" ? d.error : null) ||
    body.error ||
    fallback;

  // Traduções curtas de erros comuns da uazapi/WhatsApp
  const texto = String(preferido || "Falha ao enviar WhatsApp");
  if (/disconnected|not reconnectable/i.test(texto)) {
    return "WhatsApp desconectado na uazapi. Reconecte o QR Code da instância.";
  }
  if (/REACHOUT_TIMELOCK|temporary restriction|restrição temporária|463/i.test(texto)) {
    return "WhatsApp bloqueou temporariamente o envio de novas conversas (restrição de volume/qualidade). Tente de novo depois do fim do bloqueio ou use outro número conectado.";
  }
  return texto;
}

/**
 * Envia mensagem via edge function whatsapp-send-message.
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

    // Non-2xx: body real está no Response em error.context
    if (!body && error && typeof error === "object" && "context" in error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          // Clonar se já consumido falhar
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
