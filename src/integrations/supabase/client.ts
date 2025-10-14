// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
// 👇 ajuste AQUI o caminho do tipo Database
import type { Database } from '@/integrations/supabase/types';

// Usa exclusivamente variáveis de ambiente (Vite) — sem fallback.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Erro explícito para evitar chamadas ao projeto errado.
  console.error('[Supabase] Variáveis de ambiente não configuradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local e reinicie o servidor.');
  throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
