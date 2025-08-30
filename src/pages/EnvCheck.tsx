export default function EnvCheck() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h1>Verificação do .env</h1>
        <p><b>VITE_SUPABASE_URL:</b> {String(url)}</p>
        <p><b>VITE_SUPABASE_ANON_KEY:</b> {key ? key.slice(0,12)+"..." : String(key)}</p>
        <p>{url && key ? "✅ Variáveis carregadas" : "❌ Variáveis NÃO carregadas"}</p>
      </div>
    );
  }
  