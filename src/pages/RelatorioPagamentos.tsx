import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Search, FileText, AlertCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioItem {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  beneficiario?: { name: string };
  categoria?: { name: string };
}

const RelatorioPagamentos = () => {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [dados, setDados] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValor, setTotalValor] = useState(0);
  const [webhookUrl] = useState('https://n8n-aguaspurificadoras.up.railway.app/webhook/187671e9-efc6-4c07-aee5-d71105bf796a');
  const [enviandoZap, setEnviandoZap] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setDataInicial(format(primeiroDia, 'yyyy-MM-dd'));
    setDataFinal(format(ultimoDia, 'yyyy-MM-dd'));
  }, []);

  const buscarDados = async () => {
    if (!dataInicial || !dataFinal) {
      toast({
        title: "Erro",
        description: "Por favor, selecione as datas inicial e final",
        variant: "destructive",
      });
      return;
    }

    if (new Date(dataInicial) > new Date(dataFinal)) {
      toast({
        title: "Erro",
        description: "Data inicial deve ser menor que a data final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          id,
          descricao,
          valor,
          vencimento,
          status,
          beneficiario:beneficiaries(name),
          categoria:categories(name)
        `)
        .eq('status', 'EM_ABERTO')
        .gte('vencimento', dataInicial)
        .lte('vencimento', dataFinal)
        .order('vencimento', { ascending: true });

      if (error) throw error;

      setDados(data || []);
      const total = (data || []).reduce((sum, item) => sum + Number(item.valor), 0);
      setTotalValor(total);

      toast({
        title: "Sucesso",
        description: `Encontrados ${data?.length || 0} lançamentos`,
      });
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar dados do relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data: string) => {
    const [ano, mes, dia] = data.split('-');
    const dataLocal = new Date(Number(ano), Number(mes) - 1, Number(dia));
    return format(dataLocal, 'dd/MM/yyyy', { locale: ptBR });
  };

  const enviarParaZap = async () => {
    if (dados.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para enviar. Busque os lançamentos primeiro.",
        variant: "destructive",
      });
      return;
    }

    setEnviandoZap(true);
    
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          empresa: "Igreja Apostólica e Profética Águas Purificadoras",
          data_inicio: formatarData(dataInicial),
          data_fim: formatarData(dataFinal),
          totalLancamentos: dados.length,
          valorTotal: Number(totalValor),
          pendentes: dados.map(item => ({
            id: item.id,
            descricao: item.descricao ?? '',
            valor: Number(item.valor ?? 0),
            vencimento: formatarData(item.vencimento),
            beneficiario: item.beneficiario?.name ?? '',
            categoria: item.categoria?.name ?? ''
          }))
        }),
      });

      toast({
        title: "Dados Enviados",
        description: `Lista de ${dados.length} lançamentos enviada para o N8N com sucesso!`,
      });
    } catch (error) {
      console.error("Erro ao enviar para N8N:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar dados para o N8N. Verifique a URL e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviandoZap(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Relatório de Pagamentos</h1>
          </div>
          <p className="text-muted-foreground">Consulte os pagamentos em aberto por período</p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dataInicial">Data Inicial</Label>
                <Input
                  id="dataInicial"
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="dataFinal">Data Final</Label>
                <Input
                  id="dataFinal"
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={buscarDados} 
                  disabled={loading}
                  className="w-full"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {dados.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhum lançamento encontrado</h3>
              <p className="text-muted-foreground">
                {dataInicial && dataFinal 
                  ? `Não foram encontrados lançamentos em aberto no período de ${formatarData(dataInicial)} a ${formatarData(dataFinal)}.`
                  : 'Selecione um período para visualizar os lançamentos em aberto.'
                }
              </p>
            </CardContent>
          </Card>
        )}

        {dados.length > 0 && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Lançamentos em Aberto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dados.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium min-w-[60px]">
                          {formatarData(item.vencimento.split('T')[0])}
                        </span>
                        <span className="flex-1">
                          {item.descricao || 'Sem descrição'}
                        </span>
                      </div>
                      <span className="font-semibold text-destructive">
                        {formatarValor(item.valor)}
                      </span>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between pt-4 border-t-2 border-primary">
                    <span className="font-bold text-lg">Total:</span>
                    <span className="font-bold text-lg text-destructive">
                      {formatarValor(totalValor)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4">
              <Button 
                onClick={enviarParaZap}
                disabled={enviandoZap}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {enviandoZap ? 'Enviando...' : 'Enviar para Zap'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RelatorioPagamentos;
