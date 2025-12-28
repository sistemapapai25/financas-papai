import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureAdminIfNeeded = (u: User) => {
    const email = (u.email || '').toLowerCase();
    if (email !== 'andrielle.alvess@gmail.com') return Promise.resolve();
    return supabase.functions.invoke('ensure-admin').then(
      () => undefined,
      () => undefined
    );
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Create profile when user signs up
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            createUserProfile(session.user);
            ensureAdminIfNeeded(session.user);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // If the stored session was invalidated server-side (e.g. global logout), clear it locally.
      if (session?.access_token) {
        const { error } = await supabase.auth.getUser(session.access_token);
        const msg = String((error as any)?.message ?? "").toLowerCase();
        const code = String((error as any)?.code ?? "").toLowerCase();
        const status = Number((error as any)?.status ?? 0);

        if (error && (code === "session_not_found" || status === 403 || msg.includes("auth session missing") || msg.includes("session from session_id"))) {
          await supabase.auth.signOut({ scope: 'local' } as any);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      if (session?.user) ensureAdminIfNeeded(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const createUserProfile = async (user: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          auth_user_id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || user.email?.split('@')[0]
        }, { onConflict: 'email' });
      
      if (error) {
        console.error('Erro ao criar perfil:', error);
      }
    } catch (err) {
      console.error('Erro ao criar perfil:', err);
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta."
        });
      }

      return { error };
    } catch (err: any) {
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao sistema."
        });
      }

      return { error };
    } catch (err: any) {
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      const msg = String((error as any)?.message ?? "");
      const isSessionMissing =
        !error ||
        String((error as any)?.code ?? "") === "session_not_found" ||
        msg.toLowerCase().includes("auth session missing") ||
        msg.toLowerCase().includes("session_not_found") ||
        msg.toLowerCase().includes("session from session_id");

      if (error && !isSessionMissing) {
        toast({
          title: "Erro ao sair",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // Treat missing/invalid sessions as already logged out and force local cleanup
      if (error && isSessionMissing) {
        await supabase.auth.signOut({ scope: 'local' } as any);
      }

      setSession(null);
      setUser(null);

      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });

      return { error: null };
    } catch (err: any) {
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
