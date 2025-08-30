// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
// 👇 ajuste AQUI o caminho do tipo Database
import type { Database } from '@/integrations/supabase/types';

// Usa variáveis de ambiente (Vite) e cai no valor fixo se não houver.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://ghzwyigouhvljubitowt.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoend5aWdvdWh2bGp1Yml0b3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTAyMDEsImV4cCI6MjA3MDYyNjIwMX0.N18DkGrlF-0X8Gcg-7kePK0ZJ86-1wyiZu9SeUCjWvY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
