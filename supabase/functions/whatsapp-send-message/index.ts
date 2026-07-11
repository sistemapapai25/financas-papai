import "../deno-shim.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  enviarTemplateMeta,
  enviarTextoMeta,
  formatarNumeroBr,
} from "../_shared/whatsapp-meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  /** Número do destinatário (BR com ou sem 55) */
  numero: string;
  /** Texto livre (janela de 24h). Obrigatório se não enviar template. */
  mensagem?: string;
  /** Nome do template aprovado na Meta (fora da janela de 24h). */
  template?: string;
  /** Código do idioma do template (default pt_BR). */
  language?: string;
  /** Components do template (Graph API). */
  components?: unknown[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { numero, mensagem, template, language, components } = body;

    if (!numero) {
      return new Response(JSON.stringify({ error: "Número é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = formatarNumeroBr(numero);
    console.log(`WhatsApp Cloud API → ${to}${template ? ` template=${template}` : " texto"}`);

    let envio;
    if (template) {
      envio = await enviarTemplateMeta({
        numero: to,
        templateName: template,
        languageCode: language || "pt_BR",
        components,
      });
    } else if (mensagem) {
      envio = await enviarTextoMeta(to, mensagem);
    } else {
      return new Response(
        JSON.stringify({ error: "Informe mensagem (texto) ou template" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!envio.ok) {
      console.error("Falha Meta:", envio.error, envio.result);
      return new Response(
        JSON.stringify({
          error: envio.error,
          details: envio.result,
          provider: envio.provider,
        }),
        {
          status: envio.httpStatus >= 400 && envio.httpStatus < 600 ? envio.httpStatus : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, provider: envio.provider, result: envio.result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
