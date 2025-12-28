import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

function formatarNumero(numero: string): string {
  const numeroLimpo = numero.replace(/\D/g, "");
  return numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function enviarWhatsApp(numero: string, mensagem: string): Promise<boolean> {
  if (!UAZAPI_BASE_URL || !UAZAPI_TOKEN) {
    console.error("Credenciais UazAPI não configuradas");
    return false;
  }

  try {
    const numeroFormatado = formatarNumero(numero);
    console.log(`Enviando lembrete para: ${numeroFormatado}`);

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

    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calcular a data de amanhã (vencimento em 1 dia)
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().split("T")[0];
    
    console.log(`Data de hoje: ${hoje.toISOString().split("T")[0]}`);
    console.log(`Buscando parcelas com vencimento em: ${dataAmanha} (amanhã)`);

    const { data: parcelas, error: parcelasError } = await supabase
      .from("desafio_parcelas")
      .select(`
        id,
        vencimento,
        valor,
        competencia,
        participante_id,
        desafio_participantes!inner (
          id,
          token_link,
          desafio_id,
          pessoa_id,
          pessoas!inner (
            id,
            nome,
            telefone
          ),
          desafios!inner (
            id,
            titulo
          )
        )
      `)
      .eq("vencimento", dataAmanha)
      .eq("status", "ABERTO");

    if (parcelasError) {
      console.error("Erro ao buscar parcelas:", parcelasError);
      return new Response(
        JSON.stringify({ error: parcelasError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encontradas ${parcelas?.length || 0} parcelas vencendo amanhã`);

    let enviados = 0;
    let falhas = 0;

    for (const parcela of parcelas || []) {
      const participante = parcela.desafio_participantes as any;
      const pessoa = participante?.pessoas;
      const desafio = participante?.desafios;

      if (!pessoa?.telefone) {
        console.log(`Pessoa ${pessoa?.nome || "?"} sem telefone, pulando...`);
        continue;
      }

      const baseUrl = Deno.env.get("PUBLIC_URL") || "https://ghzwyigouhvljubitowt.lovable.app";
      const link = `${baseUrl}/carne/${participante.token_link}`;

      const mensagem = `Olá ${pessoa.nome}! 📅\n\nLembrete: *amanhã* vence sua parcela do desafio *${desafio?.titulo}*!\n\n💰 Valor: ${formatCurrency(parcela.valor)}\n📆 Vencimento: ${new Date(parcela.vencimento).toLocaleDateString("pt-BR")}\n\nAcesse seu carnê:\n${link}\n\nDeus abençoe! 🙏`;

      const enviado = await enviarWhatsApp(pessoa.telefone, mensagem);
      if (enviado) {
        enviados++;
        console.log(`Lembrete enviado para ${pessoa.nome}`);
      } else {
        falhas++;
        console.log(`Falha ao enviar para ${pessoa.nome}`);
      }

      // Pequeno delay entre mensagens para não sobrecarregar a API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const resultado = {
      data: hoje,
      total_parcelas: parcelas?.length || 0,
      enviados,
      falhas,
    };

    console.log("Resultado:", resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
