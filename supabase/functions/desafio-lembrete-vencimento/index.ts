
/// <reference path="../deno-shim.d.ts" />
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

function ymdFromLocalNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

function toYmd(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseDiasLembrete(value: unknown): number[] {
  const fallback = [0, 1];
  if (!Array.isArray(value)) return fallback;
  const list = value
    .map((n) => (typeof n === "number" ? n : Number(n)))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 365) as number[];
  const unique = Array.from(new Set(list)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : fallback;
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

    // Calcular datas
    const agora = new Date();
    const dataHoje = toYmd(agora);
    const hojeNoon = ymdFromLocalNoon(dataHoje);

    let supportsLembreteDias = true;
    let desafiosCfg: any[] = [];

    const cfgWith = await supabase.from("desafios").select("id,lembrete_dias_antes").eq("ativo", true);
    if (!cfgWith.error) {
      desafiosCfg = (cfgWith.data as any[]) ?? [];
    } else if (String(cfgWith.error.message || "").includes("lembrete_dias_antes") && String(cfgWith.error.message || "").includes("does not exist")) {
      supportsLembreteDias = false;
      const cfgWithout = await supabase.from("desafios").select("id").eq("ativo", true);
      if (cfgWithout.error) {
        console.error("Erro ao buscar desafios:", cfgWithout.error);
        return new Response(JSON.stringify({ error: cfgWithout.error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      desafiosCfg = (cfgWithout.data as any[]) ?? [];
    } else {
      console.error("Erro ao buscar configuração de desafios:", cfgWith.error);
      return new Response(JSON.stringify({ error: cfgWith.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offsetsAll = supportsLembreteDias
      ? (desafiosCfg || []).flatMap((d: any) => parseDiasLembrete(d?.lembrete_dias_antes))
      : [0, 1];
    const maxOffset = Math.min(Math.max(0, ...offsetsAll), 365);
    const datas = Array.from({ length: maxOffset + 1 }, (_, i) => toYmd(new Date(hojeNoon.getTime() + i * 86400000)));

    console.log(`Data base: ${dataHoje}`);
    console.log(`Offsets máximos: ${maxOffset} dia(s)`);
    console.log(`Datas avaliadas: ${datas.length}`);

    // Buscar parcelas que vencem nas datas configuradas
    const selectWith = `
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
          titulo,
          lembrete_dias_antes
        )
      )
    `;

    const selectWithout = `
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
    `;

    const { data: parcelas, error: parcelasError } = await supabase
      .from("desafio_parcelas")
      .select(supportsLembreteDias ? selectWith : selectWithout)
      .in("vencimento", datas)
      .eq("status", "ABERTO")
      .is("pago_em", null);

    if (parcelasError) {
      console.error("Erro ao buscar parcelas:", parcelasError);
      return new Response(
        JSON.stringify({ error: parcelasError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encontradas ${parcelas?.length || 0} parcelas (faixa configurada)`);

    let enviados = 0;
    let falhas = 0;
    let pulados = 0;

    // Buscar configurações de mensagens
    const { data: configsMsg } = await supabase
      .from("configuracao_mensagens")
      .select("*")
      .eq("ativo", true);

    const getTemplate = (diffDays: number) => {
      if (!configsMsg) return null;
      if (diffDays === 0) return configsMsg.find((c: any) => c.tipo === "LEMBRETE_VENCIMENTO_HOJE");
      if (diffDays === 1) return configsMsg.find((c: any) => c.tipo === "LEMBRETE_VENCIMENTO_AMANHA");
      return null;
    };

    for (const parcela of parcelas || []) {
      const participante = parcela.desafio_participantes as any;
      const pessoa = participante?.pessoas;
      const desafio = participante?.desafios;

      if (!pessoa?.telefone) {
        console.log(`Pessoa ${pessoa?.nome || "?"} sem telefone, pulando...`);
        pulados++;
        continue;
      }

      const diasLembrete = supportsLembreteDias ? parseDiasLembrete(desafio?.lembrete_dias_antes) : [0, 1];
      const vencNoon = ymdFromLocalNoon(parcela.vencimento);
      const diffDays = Math.round((vencNoon.getTime() - hojeNoon.getTime()) / 86400000);

      if (!diasLembrete.includes(diffDays)) {
        pulados++;
        continue;
      }

      const template = getTemplate(diffDays);
      if (!template) {
        console.log(`Template não encontrado para D-${diffDays}, pulando...`);
        pulados++;
        continue;
      }

      const vencBr = vencNoon.toLocaleDateString("pt-BR");
      
      let mensagem = template.template_mensagem;
      
      // Substituições
      mensagem = mensagem.replace(/{nome}/g, pessoa.nome.split(" ")[0]);
      mensagem = mensagem.replace(/{nome_completo}/g, pessoa.nome);
      mensagem = mensagem.replace(/{desafio}/g, desafio?.titulo || "");
      mensagem = mensagem.replace(/{valor}/g, formatCurrency(parcela.valor));
      mensagem = mensagem.replace(/{vencimento}/g, vencBr);
      mensagem = mensagem.replace(/{dias_restantes}/g, String(diffDays));

      const enviado = await enviarWhatsApp(pessoa.telefone, mensagem);
      if (enviado) {
        enviados++;
        console.log(`Lembrete enviado para ${pessoa.nome} (D-${diffDays})`);
      } else {
        falhas++;
        console.log(`Falha ao enviar para ${pessoa.nome}`);
      }

      // Pequeno delay entre mensagens para não sobrecarregar a API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const resultado = {
      data_hoje: dataHoje,
      total_parcelas: parcelas?.length || 0,
      enviados,
      falhas,
      pulados,
      max_offset: maxOffset,
    };

    console.log("Resultado:", resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na edge function:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
