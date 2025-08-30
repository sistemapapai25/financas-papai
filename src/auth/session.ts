// src/auth/session.ts
import { supabase } from "@/lib/supabase";

/** Retorna o id do usuário logado (ou lança erro se não estiver logado) */
export async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Você não está logado.");
  return data.user.id;
}

/** Opcional: checa rapidamente se há usuário logado */
export async function isLoggedIn() {
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}
