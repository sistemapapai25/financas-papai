import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!url || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }

    let token: string | null = null
    if (req.method === "GET") {
      const reqUrl = new URL(req.url)
      token = reqUrl.searchParams.get("token")
    } else {
      const body = await req.json().catch(() => ({}))
      token = typeof body?.token === "string" ? body.token : null
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(url, serviceKey)

    const { data: participante, error: partErr } = await supabaseAdmin
      .from("desafio_participantes")
      .select(
        "id,status,token_link,token_expires_at,desafio:desafios(id,titulo,descricao,valor_mensal,qtd_parcelas,data_inicio,dia_vencimento),pessoa:pessoas(id,nome,telefone,email,ativo)"
      )
      .eq("token_link", token)
      .maybeSingle()

    if (partErr) throw partErr
    if (!participante) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    if (participante.status !== "ATIVO") {
      return new Response(JSON.stringify({ error: "Link inativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if (participante.token_expires_at) {
      const exp = new Date(participante.token_expires_at)
      if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Link expirado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        })
      }
    }

    const { data: parcelas, error: parcErr } = await supabaseAdmin
      .from("desafio_parcelas")
      .select("id,competencia,vencimento,valor,status,pago_em,pago_valor,pago_obs")
      .eq("participante_id", participante.id)
      .order("competencia", { ascending: true })

    if (parcErr) throw parcErr

    return new Response(
      JSON.stringify({
        participante,
        parcelas: parcelas ?? [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed"
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

