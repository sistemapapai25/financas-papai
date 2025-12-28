import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ADMIN_EMAIL = "andrielle.alvess@gmail.com"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const url = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceKey =
      Deno.env.get("SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      ""

    if (!url || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / keys" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    const supabase = createClient(url, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const email = (userData.user.email || "").toLowerCase()
    if (email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    const supabaseAdmin = createClient(url, serviceKey)

    const tryUpsert = async (role: string) => {
      return await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userData.user.id, role },
          { onConflict: "user_id,role" }
        )
    }

    let { error: roleErr } = await tryUpsert("ADMIN")
    if (roleErr) {
      const msg = String((roleErr as any)?.message ?? "")
      if (msg.toLowerCase().includes("invalid input value for enum")) {
        ;({ error: roleErr } = await tryUpsert("admin"))
      }
    }

    if (roleErr) {
      return new Response(JSON.stringify({ error: (roleErr as any)?.message ?? "Failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed"
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
