
/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Create regular Supabase client to verify user permissions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify the requesting user is an admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid authentication')
    }

    // Check if user has admin role
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .limit(10)

    if (roleError) {
      throw roleError
    }

    const isAdmin =
      (roleRows || []).some((r: { role: string }) => r.role === 'ADMIN') ||
      (user.email || '').toLowerCase() === 'andrielle.alvess@gmail.com'
    if (!isAdmin) {
      throw new Error('Access denied: Admin role required')
    }

    // Parse request body
    const { email, password, name, role } = await req.json()

    if (!email || !password || !name || !role) {
      throw new Error('Missing required fields')
    }

    // Create user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      throw authError
    }

    if (!authData.user) {
      throw new Error('Failed to create user')
    }

    // Create profile (without role field)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        auth_user_id: authData.user.id,
        email,
        name,
      })

    if (profileError) {
      // If profile creation fails, delete the user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    // Create or update role (using upsert to avoid duplicate key errors)
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authData.user.id,
        role,
      }, {
        onConflict: 'user_id,role'
      })

    if (roleInsertError) {
      // If role creation fails, cleanup
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('profiles').delete().eq('auth_user_id', authData.user.id)
      throw roleInsertError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: authData.user.id, 
          email, 
          name,
          role 
        } 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
    console.error('Error creating user:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
