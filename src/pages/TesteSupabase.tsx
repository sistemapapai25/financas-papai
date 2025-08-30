// src/pages/TesteSupabase.tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TesteSupabase() {
  const [msg, setMsg] = useState("Clique no botão para testar conexão");

  async function testar() {
    setMsg("Testando...");
    const { data, error } = await supabase.from("categories").select("id").limit(1);
    if (error) setMsg("❌ Erro: " + error.message);
    else setMsg("✅ Conectado! Achei " + (data?.length ?? 0) + " categorias.");
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Teste Supabase</h1>
      <button
        onClick={testar}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
      >
        Testar conexão
      </button>
      <p className="mt-4">{msg}</p>
    </div>
  );
}
