// src/pages/EnvDebug.tsx
export default function EnvDebug() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h1>Env Debug</h1>
        <p><b>VITE_SUPABASE_URL:</b> {String(url)}</p>
        <p><b>VITE_SUPABASE_ANON_KEY:</b> {key ? `${key.slice(0,12)}...` : String(key)}</p>
        <p style={{ marginTop: 12 }}>
          {url && key ? "✅ Variáveis carregadas" : "❌ Variáveis NÃO carregadas"}
        </p>
        <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Dica: O arquivo <code>.env</code> precisa estar na RAIZ do projeto (mesmo nível do package.json),
          com os nomes começando por VITE_. Depois de editar, reinicie o dev server.
        </p>
      </div>
    );
  }
  