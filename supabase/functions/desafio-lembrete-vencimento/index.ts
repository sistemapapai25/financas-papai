import "../deno-shim.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarTextoMeta } from "../_shared/whatsapp-meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// URL base publica do app (ex.: https://meusistema.com). Usada para montar o link do carne {link}.
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "").trim().replace(/\/+$/, "");
const ENABLE_DESAFIO_LEMBRETES =
  (Deno.env.get("ENABLE_DESAFIO_LEMBRETES") ?? "true").toLowerCase() === "true";

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
  const list = (value as unknown[])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  const unique = Array.from(new Set(list)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : fallback;
}

async function enviarWhatsApp(numero: string, mensagem: string): Promise<boolean> {
  const envio = await enviarTextoMeta(numero, mensagem);
  if (!envio.ok) {
    console.error("Erro WhatsApp Cloud API:", envio.error, envio.result);
  }
  return envio.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Corpo opcional: { participante_id } => envia SOMENTE para essa pessoa (modo teste/individual)
    const body = await req.json().catch(() => ({} as any));
    const participanteFiltro = typeof body?.participante_id === "string" ? body.participante_id : null;
    const modoIndividual = !!participanteFiltro;

    // No modo geral (cron/emergencia), respeita a trava. No modo individual (teste) sempre roda.
    if (!ENABLE_DESAFIO_LEMBRETES && !modoIndividual) {
      return new Response(JSON.stringify({ disabled: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const dataHoje = toYmd(new Date());
    const hojeNoon = ymdFromLocalNoon(dataHoje);

    const { data: desafiosCfg } = await supabase
      .from("desafios")
      .select("id,lembrete_dias_antes")
      .eq("ativo", true);

    const offsetsAll = (desafiosCfg ?? []).flatMap((d: any) => parseDiasLembrete(d?.lembrete_dias_antes));
    const maxOffset = Math.min(Math.max(0, ...offsetsAll, 1), 365);
    const datas = Array.from({ length: maxOffset + 1 }, (_, i) =>
      toYmd(new Date(hojeNoon.getTime() + i * 86400000))
    );

    const selectExpr = `
      id, vencimento, valor, competencia, participante_id,
      desafio_participantes!inner (
        id, token_link, desafio_id, pessoa_id,
        pessoas!inner ( id, nome, telefone ),
        desafios!inner ( id, titulo, lembrete_dias_antes )
      )
    `;

    let parcelaQuery = supabase
      .from("desafio_parcelas")
      .select(selectExpr)
      .eq("status", "ABERTO")
      .is("pago_em", null);

    if (modoIndividual) {
      // Teste: pega a parcela em aberto mais proxima dessa pessoa, sem filtro de data
      parcelaQuery = parcelaQuery
        .eq("participante_id", participanteFiltro)
        .order("vencimento", { ascending: true })
        .limit(1);
    } else {
      // Geral: somente as que vencem na janela configurada
      parcelaQuery = parcelaQuery.in("vencimento", datas);
    }

    const { data: parcelas, error: parcelasError } = await parcelaQuery;

    if (parcelasError) {
      console.error("Erro ao buscar parcelas:", parcelasError);
      return new Response(JSON.stringify({ error: parcelasError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Modo: ${modoIndividual ? "individual" : "geral"} | parcelas: ${parcelas?.length || 0}`);

    const { data: configsMsg } = await supabase
      .from("configuracao_mensagens")
      .select("*")
      .eq("ativo", true);

    const templateHoje = configsMsg?.find((c: any) => c.tipo === "LEMBRETE_VENCIMENTO_HOJE") ?? null;
    const templateAmanha = configsMsg?.find((c: any) => c.tipo === "LEMBRETE_VENCIMENTO_AMANHA") ?? null;

    const getTemplate = (diffDays: number) => {
      if (diffDays === 0) return templateHoje;
      if (diffDays === 1) return templateAmanha;
      // No modo individual, se nao bater 0/1, usa o de "hoje" como padrao para o teste
      return modoIndividual ? (templateHoje ?? templateAmanha) : null;
    };

    let enviados = 0;
    let falhas = 0;
    let pulados = 0;

    for (const parcela of parcelas ?? []) {
      const participante = parcela.desafio_participantes as any;
      const pessoa = participante?.pessoas;
      const desafio = participante?.desafios;

      if (!pessoa?.telefone) {
        pulados++;
        continue;
      }

      const vencNoon = ymdFromLocalNoon(parcela.vencimento);
      const diffDays = Math.round((vencNoon.getTime() - hojeNoon.getTime()) / 86400000);

      if (!modoIndividual) {
        const diasLembrete = parseDiasLembrete(desafio?.lembrete_dias_antes);
        if (!diasLembrete.includes(diffDays)) {
          pulados++;
          continue;
        }
      }

      const template = getTemplate(diffDays);
      if (!template) {
        pulados++;
        continue;
      }

      const vencBr = vencNoon.toLocaleDateString("pt-BR");
      const carneUrl = PUBLIC_APP_URL && participante?.token_link
        ? `${PUBLIC_APP_URL}/carne/${participante.token_link}`
        : "";

      let mensagem = template.template_mensagem;
      mensagem = mensagem.replace(/{nome}/g, String(pessoa.nome).split(" ")[0]);
      mensagem = mensagem.replace(/{nome_completo}/g, pessoa.nome);
      mensagem = mensagem.replace(/{desafio}/g, desafio?.titulo || "");
      mensagem = mensagem.replace(/{valor}/g, formatCurrency(parcela.valor));
      mensagem = mensagem.replace(/{vencimento}/g, vencBr);
      mensagem = mensagem.replace(/{dias_restantes}/g, String(diffDays));
      mensagem = mensagem.replace(/{link}/g, carneUrl);
      mensagem = mensagem.replace(/{carne}/g, carneUrl);

      const enviado = await enviarWhatsApp(pessoa.telefone, mensagem);
      if (enviado) {
        enviados++;
        console.log(`Lembrete enviado para ${pessoa.nome} (D-${diffDays})`);
      } else {
        falhas++;
        console.log(`Falha ao enviar para ${pessoa.nome}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const resultado = {
      modo: modoIndividual ? "individual" : "geral",
      data_hoje: dataHoje,
      total_parcelas: parcelas?.length || 0,
      enviados,
      falhas,
      pulados,
      max_offset: maxOffset,
    };

    console.log("Resultado:", resultado);

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na edge function:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
