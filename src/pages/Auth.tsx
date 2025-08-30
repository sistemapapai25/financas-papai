// src/pages/Auth.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ensureDefaultCategories } from "@/services/categories";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import logoUrl from "@/assets/logo-aguas.png";

const brand = "#1B2546";

export default function Auth() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        toast.error(error.message || "Erro ao entrar");
        return;
      }
      try {
        await ensureDefaultCategories();
      } catch (err: any) {
        console.error("ensureDefaultCategories:", err?.message || err);
      }
      toast.success("Login realizado!");
      nav("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-card shadow-lg p-6 sm:p-7 space-y-6"
      >
        {/* Logo + títulos */}
        <div className="text-center">
          {/* ✅ logo sem círculo/borda */}
          <img
            src={logoUrl}
            alt="Igreja Apostólica e Profética Águas Purificadoras"
            className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 object-contain"
          />

          {/* ✅ título menor em 2 linhas */}
          <h1 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight">
            <span className="block">Igreja Apostólica e Profética</span>
            <span className="block">Águas Purificadoras</span>
          </h1>

          {/* ✅ “Finanças Papai” maior e destacado */}
          <p className="mt-1 text-base sm:text-lg font-semibold" style={{ color: brand }}>
            Finanças Papai
          </p>
          <p className="text-sm text-muted-foreground">Faça login para acessar o sistema</p>
        </div>

        {/* Campos */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2" style={{ color: brand }}>
              <Mail className="w-4 h-4" />
              E-mail
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--brand)]"
              style={{ borderColor: "rgba(0,0,0,.12)", ["--brand" as any]: brand }}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2" style={{ color: brand }}>
              <Lock className="w-4 h-4" />
              Senha
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--brand)]"
              style={{ borderColor: "rgba(0,0,0,.12)", ["--brand" as any]: brand }}
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full text-white font-semibold rounded-lg px-4 py-2 flex items-center justify-center shadow-sm hover:opacity-95 disabled:opacity-60"
          style={{ background: `linear-gradient(90deg, ${brand} 0%, #4f46e5 100%)` }}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <div className="text-xs text-muted-foreground text-center">
          Problemas para entrar? Verifique seu e-mail e senha.
        </div>
      </form>
    </div>
  );
}
