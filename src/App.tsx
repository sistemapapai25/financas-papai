// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Páginas
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ContasAPagar from "./pages/ContasAPagar";
import ContasPagas from "./pages/ContasPagas";
import CadastroBeneficiarios from "./pages/CadastroBeneficiarios";
import CadastroCategorias from "./pages/CadastroCategorias";
import CadastroUsuarios from "./pages/CadastroUsuarios";
import RelatorioPagamentos from "./pages/RelatorioPagamentos";
import EntradasCulto from "./pages/EntradasCulto";
import ListaCultos from "./pages/ListaCultos";
import CadastroTiposCulto from "./pages/CadastroTiposCulto";
import CadastroContasFinanceiras from "./pages/CadastroContasFinanceiras";
import ImportarExtrato from "./pages/ImportarExtrato";
import ImportarCaixa from "./pages/ImportarCaixa";
import LancamentosDashboard from "./pages/LancamentosDashboard";
import Agenda from "@/pages/Agenda";
import RegrasClassificacao from "./pages/RegrasClassificacao";
import ConfiguracaoIgreja from "./pages/ConfiguracaoIgreja";
import ResumoAnual from "./pages/ResumoAnual";
import Pessoas from "./pages/Pessoas";
import Desafios from "./pages/Desafios";
import Carne from "./pages/Carne";
import GestaoFinanceiraDesafios from "./pages/GestaoFinanceiraDesafios";
import CarnePublico from "./pages/CarnePublico";

// (opcionais p/ diagnóstico)
import TesteSupabase from "./pages/TesteSupabase";
import EnvCheck from "./pages/EnvCheck";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Layout privado com Navigation fixo no topo
function PrivateLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Públicas */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/env" element={<EnvCheck />} />
                <Route path="/teste-supabase" element={<TesteSupabase />} />
                <Route path="/carne/:token" element={<CarnePublico />} />
                
                {/* Redirect de rotas antigas */}
                <Route path="/meu-carne" element={<Navigate to="/meus-desafios/gestao-carnes" replace />} />
                <Route path="/meus-desafios/meu-carne" element={<Navigate to="/meus-desafios/gestao-carnes" replace />} />

                {/* Privadas (com menu fixo via PrivateLayout) */}
                <Route
                  element={
                    <ProtectedRoute>
                      <PrivateLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Home */}
                  <Route path="/" element={<Dashboard />} />

                  {/* Movimentações */}
                  <Route path="/movimentacoes/entradas-culto" element={<EntradasCulto />} />
                  <Route path="/lista-cultos" element={<ListaCultos />} />
                  <Route path="/contas-a-pagar" element={<ContasAPagar />} />
                  <Route path="/contas-pagas" element={<ContasPagas />} />
                  <Route path="/relatorio-pagamentos" element={<RelatorioPagamentos />} />
                  <Route path="/movimentacoes/importar-extrato" element={<ImportarExtrato />} />
                  <Route path="/movimentacoes/importar-caixa" element={<ImportarCaixa />} />

                  {/* Financeiro */}
                  <Route path="/financeiro/lancamentos" element={<LancamentosDashboard />} />
                  <Route path="/financeiro/agenda" element={<Agenda />} />
                  <Route path="/financeiro/resumo-anual" element={<ResumoAnual />} />

                  {/* Cadastros */}
                  <Route path="/cadastros/beneficiarios" element={<CadastroBeneficiarios />} />
                  <Route path="/cadastros/categorias" element={<CadastroCategorias />} />
                  <Route path="/cadastros/usuarios" element={<CadastroUsuarios />} />
                  <Route path="/cadastros/tipos-culto" element={<CadastroTiposCulto />} />
                  <Route path="/cadastros/contas-financeiras" element={<CadastroContasFinanceiras />} />
                  <Route path="/cadastros/pessoas" element={<Pessoas />} />

                  {/* Meus Desafios */}
                  <Route path="/meus-desafios" element={<Desafios />} />
                  <Route path="/meus-desafios/gestao-carnes" element={<Carne />} />
                  <Route path="/meus-desafios/gestao-financeira" element={<GestaoFinanceiraDesafios />} />

                  {/* Configurações */}
                  <Route path="/configuracoes/regras-classificacao" element={<RegrasClassificacao />} />
                  <Route path="/configuracoes/igreja" element={<ConfiguracaoIgreja />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
