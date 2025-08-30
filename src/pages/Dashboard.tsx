import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar, TrendingUp, AlertTriangle, Plus, Receipt, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardData, Lancamento } from '@/types/database';
import { format, isBefore, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const hoje = new Date();
      const inicioMes = startOfMonth(hoje);
      const fimMes = endOfMonth(hoje);
      const proximaSemana = addDays(hoje, 7);

      // Total em aberto do mês
      const { data: emAberto } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('status', 'EM_ABERTO')
        .gte('vencimento', format(inicioMes, 'yyyy-MM-dd'))
        .lte('vencimento', format(fimMes, 'yyyy-MM-dd'));

      const totalEmAberto = emAberto?.reduce((sum, item) => sum + parseFloat(String(item.valor) || '0'), 0) || 0;

      // Total pago do mês
      const { data: pagos } = await supabase
        .from('lancamentos')
        .select('valor_pago')
        .eq('status', 'PAGO')
        .gte('data_pagamento', format(inicioMes, 'yyyy-MM-dd'))
        .lte('data_pagamento', format(fimMes, 'yyyy-MM-dd'));

      const totalPagoMes = pagos?.reduce((sum, item) => sum + parseFloat(String(item.valor_pago) || '0'), 0) || 0;

      // Próximos vencimentos (7 dias)
      const { data: proximos } = await supabase
        .from('lancamentos')
        .select(`
          *,
          beneficiario:beneficiaries(name),
          categoria:categories(name)
        `)
        .eq('status', 'EM_ABERTO')
        .gte('vencimento', format(hoje, 'yyyy-MM-dd'))
        .lte('vencimento', format(proximaSemana, 'yyyy-MM-dd'))
        .order('vencimento', { ascending: true })
        .limit(5);

      // Receitas do mês
      const { data: receitas } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'RECEITA')
        .gte('vencimento', format(inicioMes, 'yyyy-MM-dd'))
        .lte('vencimento', format(fimMes, 'yyyy-MM-dd'));

      const receitasMes = receitas?.reduce((sum, item) => sum + parseFloat(String(item.valor) || '0'), 0) || 0;

      setDashboardData({
        totalEmAberto,
        totalPagoMes,
        proximosVencimentos: proximos as Lancamento[] || [],
        receitasMes
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const isVencido = (vencimento: string) => {
    return isBefore(new Date(vencimento), new Date());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6">
        {/* Menu de Movimentações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link to="/contas-a-pagar">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <h3 className="text-lg font-semibold mb-2">Contas a Pagar</h3>
                <p className="text-muted-foreground">Gerencie suas contas em aberto</p>
                <Badge variant="destructive" className="mt-2">
                  {dashboardData?.proximosVencimentos.length || 0} pendentes
                </Badge>
              </CardContent>
            </Card>
          </Link>
          <Link to="/contas-pagas">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <FileCheck2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                <h3 className="text-lg font-semibold mb-2">Contas Pagas</h3>
                <p className="text-muted-foreground">Visualize suas contas quitadas</p>
                <Badge variant="outline" className="mt-2 text-green-600 border-green-600">
                  Histórico
                </Badge>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total em Aberto (Mês)
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(dashboardData?.totalEmAberto || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pago (Mês)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardData?.totalPagoMes || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Receitas (Mês)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(dashboardData?.receitasMes || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Próximos Vencimentos
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.proximosVencimentos.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                próximos 7 dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Próximos a Vencer */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos a Vencer</CardTitle>
            <NovoLancamentoDialog onSuccess={loadDashboardData} />
          </CardHeader>
          <CardContent>
            {dashboardData?.proximosVencimentos && dashboardData.proximosVencimentos.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.proximosVencimentos.map((lancamento) => (
                  <div
                    key={lancamento.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isVencido(lancamento.vencimento) 
                        ? 'border-destructive bg-destructive/10' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={lancamento.tipo === 'DESPESA' ? 'destructive' : 'default'}>
                          {lancamento.tipo}
                        </Badge>
                        {isVencido(lancamento.vencimento) && (
                          <Badge variant="destructive">Vencido</Badge>
                        )}
                      </div>
                      <p className="font-medium">{lancamento.descricao}</p>
                      <p className="text-sm text-muted-foreground">
                        {lancamento.beneficiario?.name || lancamento.categoria?.name}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(lancamento.valor)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(lancamento.vencimento)}
                      </p>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t flex gap-2">
                  <Link to="/contas-a-pagar" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Ver Contas a Pagar
                    </Button>
                  </Link>
                  <Link to="/contas-pagas" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Ver Contas Pagas
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum lançamento próximo do vencimento
                </p>
                <NovoLancamentoDialog 
                  onSuccess={loadDashboardData}
                  trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Lançamento
                    </Button>
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
