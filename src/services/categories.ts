// src/services/categories.ts
import { supabase } from "@/lib/supabase";

/** Cria Dízimos/Ofertas para o usuário logado, se ainda não existirem */
export async function ensureDefaultCategories() {
  const { error } = await supabase.rpc("ensure_default_categories");
  if (error) throw error;
}
