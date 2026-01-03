import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  numero: string;
  mensagem: string;
}

function formatarNumero(numero: string): string {
  // Remove todos os caracteres não numéricos
  const numeroLimpo = numero.replace(/\D/g, "");
  // Adiciona 55 se não começar com ele
  return numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_BASE_URL || !UAZAPI_TOKEN) {
      console.error("Missing UAZAPI credentials");
      return new Response(
        JSON.stringify({ error: "Configuração de WhatsApp não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { numero, mensagem } = body;

    if (!numero || !mensagem) {
      return new Response(
        JSON.stringify({ error: "Número e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numeroFormatado = formatarNumero(numero);
    console.log(`Enviando mensagem para: ${numeroFormatado}`);

    const response = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: {
        "token": UAZAPI_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: numeroFormatado,
        text: mensagem,
      }),
    });

    const result = await response.json();
    console.log("Resposta UazAPI:", JSON.stringify(result));

    if (!response.ok) {
      console.error("Erro UazAPI:", result);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
