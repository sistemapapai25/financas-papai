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

    // supabase-js auth.getUser() in Edge does not automatically read global Authorization headers.
    // We must pass the JWT explicitly.
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid authentication", details: "Missing bearer token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const url = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceKeyCandidates = [
      { name: "SUPABASE_SERVICE_ROLE_KEY", value: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
      { name: "SERVICE_ROLE_KEY", value: Deno.env.get("SERVICE_ROLE_KEY") ?? "" },
    ].filter((k) => Boolean(k.value))

    if (!url || !anonKey || serviceKeyCandidates.length === 0) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / keys" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    // In Edge Functions, supabase-js does NOT automatically read the request Authorization header.
    // We must pass it via `global.headers` (and we keep a fallback of passing the JWT directly).
    const supabaseAuth = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Prefer header-based validation (works across versions)
    let { data: userData, error: userErr } = await supabaseAuth.auth.getUser()

    // Fallback for versions that accept a token param
    if (userErr || !userData?.user) {
      ;({ data: userData, error: userErr } = await supabaseAuth.auth.getUser(token))
    }

    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication", details: (userErr as any)?.message ?? null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      )
    }

    const email = (userData.user.email || "").toLowerCase()
    if (email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    const tryUpsert = async (client: any, role: string) => {
      return await client
        .from("user_roles")
        .upsert({ user_id: userData.user.id, role }, { onConflict: "user_id,role" })
    }

    const ensureRoleWithClient = async (client: any) => {
      let { error: roleErr } = await tryUpsert(client, "ADMIN")
      if (roleErr) {
        const msg = String((roleErr as any)?.message ?? "")
        if (msg.toLowerCase().includes("invalid input value for enum")) {
          ;({ error: roleErr } = await tryUpsert(client, "admin"))
        }
      }
      return roleErr as any
    }

    let lastInvalidKeyErr: any = null

    for (const k of serviceKeyCandidates) {
      console.log(`ensure-admin: trying service key from ${k.name}`)
      const supabaseAdmin = createClient(url, k.value)
      const roleErr = await ensureRoleWithClient(supabaseAdmin)
      if (!roleErr) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      const msg = String((roleErr as any)?.message ?? "")
      if (msg.toLowerCase().includes("invalid api key")) {
        lastInvalidKeyErr = roleErr
        continue
      }

      return new Response(JSON.stringify({ error: msg || "Failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    return new Response(
      JSON.stringify({ error: "Invalid API key", details: (lastInvalidKeyErr as any)?.message ?? null }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
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
