import "../deno-shim.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarTextoMeta, formatarNumeroBr } from "../_shared/whatsapp-meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Fallback legado (grupos): uazapiGO ainda é usado se configurado, pois Cloud API não envia para @g.us.
const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
// JID do grupo de destino (ex.: 120363012345678901@g.us). Descubra com o modo { listar_grupos: true }.
const CONTAS_PAGAR_GRUPO_ID = (Deno.env.get("CONTAS_PAGAR_GRUPO_ID") ?? "").trim();
const ENABLE_CONTAS_PAGAR_GRUPO =
  (Deno.env.get("ENABLE_CONTAS_PAGAR_GRUPO") ?? "true").toLowerCase() === "true";

const TIPO_TEMPLATE = "CONTAS_PAGAR_GRUPO_DIARIO";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function toYmd(date: Date): string {
  return date.toISOString().split("T")[0];
}

// "YYYY-MM-DD" -> "DD/MM/YYYY" sem criar Date (evita problema de fuso)
function ymdToBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd;
}

function diasEntre(ymdA: string, ymdB: string): number {
  const a = new Date(`${ymdA}T12:00:00`).getTime();
  const b = new Date(`${ymdB}T12:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}

// Envia texto: número individual → Meta Cloud API; grupo (@g.us) → uazapiGO (se configurado).
async function enviarTexto(destino: string, mensagem: string): Promise<{ ok: boolean; result: unknown }> {
  const isGrupo = /@g\.us/i.test(destino) || destino.includes("@g.us");

  if (!isGrupo) {
    const envio = await enviarTextoMeta(formatarNumeroBr(destino), mensagem);
    return { ok: envio.ok, result: envio.ok ? envio.result : { error: envio.error, details: envio.result } };
  }

  if (!UAZAPI_BASE_URL || !UAZAPI_TOKEN) {
    const err =
      "Envio para grupo WhatsApp não é suportado pela Cloud API da Meta. Configure UAZAPI_* ou use um número individual.";
    console.error(err);
    return { ok: false, result: { error: err } };
  }
  try {
    const response = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "token": UAZAPI_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ number: destino, text: mensagem }),
    });
    const result = await response.json().catch(() => ({}));
    console.log("Resposta UazAPI (grupo):", JSON.stringify(result));
    return { ok: response.ok, result };
  } catch (error) {
    console.error("Erro ao enviar WhatsApp (grupo):", error);
    return { ok: false, result: { error: String(error) } };
  }
}

// Tenta descobrir os grupos conectados na uazapiGO. Como o caminho exato pode variar entre
// versoes, tenta varios candidatos e devolve o primeiro que responder com uma lista.
function normalizarGrupos(data: unknown): Array<{ id: string; nome: string }> {
  const arr: any[] = Array.isArray(data)
    ? (data as any[])
    : Array.isArray((data as any)?.groups)
      ? (data as any).groups
      : Array.isArray((data as any)?.data)
        ? (data as any).data
        : [];
  return arr
    .map((g: any) => {
      const id = g?.JID ?? g?.jid ?? g?.id ?? g?.wa_chatid ?? g?.chatid ?? g?.gid ?? "";
      const nome = g?.subject ?? g?.name ?? g?.Name ?? g?.title ?? g?.subjectName ?? "";
      return { id: String(id || "").trim(), nome: String(nome || "").trim() };
    })
    .filter((g) => g.id.endsWith("@g.us") || g.id.includes("@g.us") || /\d{15,}/.test(g.id));
}

async function listarGrupos(): Promise<{ ok: boolean; endpoint?: string; grupos: Array<{ id: string; nome: string }>; raw?: unknown }> {
  if (!UAZAPI_BASE_URL || !UAZAPI_TOKEN) {
    return { ok: false, grupos: [], raw: { error: "Credenciais UazAPI nao configuradas" } };
  }
  const headers = { "token": UAZAPI_TOKEN, "Content-Type": "application/json" };
  const candidatos: Array<{ method: string; path: string; body?: unknown }> = [
    { method: "GET", path: "/group/list" },
    { method: "GET", path: "/group/list?force=true" },
    { method: "POST", path: "/group/list", body: {} },
    { method: "POST", path: "/group/list", body: { force: true } },
    { method: "GET", path: "/group/getAllGroups" },
    { method: "GET", path: "/groups" },
  ];
  let ultimoRaw: unknown = null;
  for (const c of candidatos) {
    try {
      const res = await fetch(`${UAZAPI_BASE_URL}${c.path}`, {
        method: c.method,
        headers,
        body: c.body ? JSON.stringify(c.body) : undefined,
      });
      const data = await res.json().catch(() => null);
      ultimoRaw = data;
      if (!res.ok || !data) continue;
      const grupos = normalizarGrupos(data);
      if (grupos.length > 0) {
        return { ok: true, endpoint: `${c.method} ${c.path}`, grupos, raw: data };
      }
    } catch (_) {
      // tenta o proximo candidato
    }
  }
  return { ok: false, grupos: [], raw: ultimoRaw };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    // Modo 1: descobrir o JID do grupo
    if (body?.listar_grupos === true) {
      const resultado = await listarGrupos();
      return new Response(JSON.stringify(resultado), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dryRun = body?.dry_run === true;
    const grupoId = (typeof body?.grupo_id === "string" && body.grupo_id.trim())
      ? body.grupo_id.trim()
      : CONTAS_PAGAR_GRUPO_ID;
    // Por padrao nao manda nada quando nao ha contas; pode forcar com enviar_vazio.
    const enviarVazio = body?.enviar_vazio === true;

    // Trava geral (cron). Modo manual (dry_run ou grupo_id no body) ignora a trava.
    const modoManual = dryRun || (typeof body?.grupo_id === "string" && !!body.grupo_id.trim());
    if (!ENABLE_CONTAS_PAGAR_GRUPO && !modoManual) {
      return new Response(JSON.stringify({ disabled: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const hoje = toYmd(new Date());

    // Contas a pagar (DESPESA, em aberto) vencendo hoje OU atrasadas (vencimento <= hoje)
    const { data: contas, error: contasError } = await supabase
      .from("lancamentos")
      .select("id, descricao, valor, vencimento, categoria:categories(name), beneficiario:beneficiaries(name)")
      .eq("status", "EM_ABERTO")
      .eq("tipo", "DESPESA")
      .lte("vencimento", hoje)
      .is("deleted_at", null)
      .order("vencimento", { ascending: true });

    if (contasError) {
      console.error("Erro ao buscar contas:", contasError);
      return new Response(JSON.stringify({ error: contasError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lista = contas ?? [];
    const qtd = lista.length;
    const total = lista.reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
    const qtdHoje = lista.filter((c: any) => c.vencimento === hoje).length;
    const qtdAtrasadas = qtd - qtdHoje;

    // Monta o bloco {lista}: uma linha por conta, marcando as atrasadas.
    const linhas = lista.map((c: any) => {
      const desc = c.descricao || c.beneficiario?.name || c.categoria?.name || "Conta";
      const valor = formatCurrency(c.valor);
      if (c.vencimento === hoje) {
        return `• ${desc} — ${valor} (vence hoje)`;
      }
      const dias = diasEntre(hoje, c.vencimento);
      return `• ${desc} — ${valor} (venceu em ${ymdToBr(c.vencimento)}, atrasada ${dias}d)`;
    });
    const blocoLista = linhas.join("\n");

    // Template editavel (tela Configuracao de Mensagens)
    const { data: configsMsg } = await supabase
      .from("configuracao_mensagens")
      .select("*")
      .eq("tipo", TIPO_TEMPLATE)
      .eq("ativo", true)
      .maybeSingle();

    const templatePadrao =
      "📋 *Contas a pagar de hoje ({data})*\n\n{lista}\n\n💰 Total: {total} ({qtd} conta(s))";
    const template = (configsMsg?.template_mensagem as string) || templatePadrao;

    let mensagem = template;
    mensagem = mensagem.replace(/{data}/g, ymdToBr(hoje));
    mensagem = mensagem.replace(/{lista}/g, blocoLista);
    mensagem = mensagem.replace(/{total}/g, formatCurrency(total));
    mensagem = mensagem.replace(/{qtd}/g, String(qtd));
    mensagem = mensagem.replace(/{qtd_hoje}/g, String(qtdHoje));
    mensagem = mensagem.replace(/{qtd_atrasadas}/g, String(qtdAtrasadas));

    const baseResultado = {
      data_hoje: hoje,
      qtd,
      qtd_hoje: qtdHoje,
      qtd_atrasadas: qtdAtrasadas,
      total,
      total_formatado: formatCurrency(total),
      grupo_id: grupoId || null,
      mensagem,
    };

    // Modo 2: pre-visualizar (nao envia)
    if (dryRun) {
      return new Response(JSON.stringify({ ...baseResultado, dry_run: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sem contas: por padrao nao envia (evita poluir o grupo)
    if (qtd === 0 && !enviarVazio) {
      return new Response(JSON.stringify({ ...baseResultado, enviado: false, motivo: "sem_contas" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!grupoId) {
      return new Response(
        JSON.stringify({ ...baseResultado, enviado: false, error: "Grupo nao configurado (defina o secret CONTAS_PAGAR_GRUPO_ID ou envie grupo_id no body)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Modo 3: enviar de fato ao grupo
    const envio = await enviarTexto(grupoId, mensagem);

    return new Response(
      JSON.stringify({ ...baseResultado, enviado: envio.ok, resposta_uazapi: envio.result }),
      { status: envio.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro na edge function:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
