// src/pages/ContasPagas.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';
import { Calendar, User, Tag, FileText, CheckCircle, Search, RotateCcw } from 'lucide-react';

// 🔹 utils de data (sem UTC)
import { ymdToBr } from '@/utils/date';

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;                 // YYYY-MM-DD
  tipo: 'DESPESA' | 'RECEITA';
  status: 'EM_ABERTO' | 'PAGO' | 'CANCELADO';
  data_pagamento?: string | null;     // YYYY-MM-DD
  valor_pago?: number | null;
  observacoes?: string | null;
  categoria?: { name: string } | null;
  beneficiario?: { name: string } | null;
}

const ContasPagas = () => {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [reabrindoId, setReabrindoId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadContasPagas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadContasPagas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          categoria:categories(name),
          beneficiario:beneficiaries(name)
        `)
        .eq('status', 'PAGO')
        .order('data_pagamento', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setLancamentos((data || []) as Lancamento[]);
    } catch (error) {
      console.error('Erro ao carregar contas pagas:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar as contas pagas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  // ✅ Exibe datas sem criar Date()
  const formatDate = (date?: string | null) => (!date ? '-' : ymdToBr(date));

  // 🔄 Reabrir (voltar para EM_ABERTO) + remover movimentos ligados ao lançamento
  const reabrirLancamento = async (l: Lancamento) => {
    const ok = window.confirm(`Reabrir o lançamento "${l.descricao}"? Ele voltará para EM_ABERTO.`);
    if (!ok) return;

    try {
      setReabrindoId(l.id);

      // 1) Atualiza lançamento
      const { error: upErr } = await supabase
        .from('lancamentos')
        .update({
          status: 'EM_ABERTO',
          data_pagamento: null,
          valor_pago: null,
        })
        .eq('id', l.id);

      if (upErr) throw upErr;

      // 2) Remove movimentos financeiros originados pelo pagamento desse lançamento
      const { error: delMovErr } = await supabase
        .from('movimentos_financeiros')
        .delete()
        .eq('origem', 'LANCAMENTO')
        .eq('ref_id', l.id);

      if (delMovErr) throw delMovErr;

      toast({
        title: 'Lançamento reaberto',
        description: 'O lançamento voltou para EM_ABERTO e os movimentos foram removidos.',
      });

      await loadContasPagas();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao reabrir',
        description: e?.message || 'Não foi possível reabrir o lançamento.',
        variant: 'destructive',
      });
    } finally {
      setReabrindoId(null);
    }
  };

  const filtradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (!termo) return lancamentos;

    return lancamentos.filter((l) => {
      const desc = (l.descricao || '').toLowerCase();
      const benef = (l.beneficiario?.name || '').toLowerCase();
      const cat = (l.categoria?.name || '').toLowerCase();
      const dataVenc = formatDate(l.vencimento).toLowerCase();
      const dataPag = formatDate(l.data_pagamento).toLowerCase();

      const valorBase = Number(l.valor || 0);
      const valorPago = Number(l.valor_pago || l.valor || 0);
      const valorFmt = formatCurrency(valorBase).toLowerCase();
      const valorPagoFmt = formatCurrency(valorPago).toLowerCase();

      return (
        desc.includes(termo) ||
        benef.includes(termo) ||
        cat.includes(termo) ||
        dataVenc.includes(termo) ||
        dataPag.includes(termo) ||
        valorFmt.includes(termo) ||
        valorPagoFmt.includes(termo)
      );
    });
  }, [lancamentos, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-6 space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Contas Pagas</h1>
            <p className="text-muted-foreground">Visualize e pesquise suas contas quitadas</p>
          </div>
          <NovoLancamentoDialog onSuccess={loadContasPagas} />
        </div>

        {/* 🔎 Barra de pesquisa com botão X */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar por descrição, beneficiário, categoria, data (dd/mm/aaaa) ou valor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-lg pl-9 pr-9 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
                title="Limpar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma conta encontrada</h3>
                <p className="mb-4">Ajuste a pesquisa ou crie um novo lançamento.</p>
                <NovoLancamentoDialog
                  onSuccess={loadContasPagas}
                  trigger={<Button>Criar lançamento</Button>}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 w-full">
            {filtradas.map((lancamento) => {
              const valorPagoOuOriginal = Number(lancamento.valor_pago || lancamento.valor || 0);
              const diferenca =
                lancamento.valor_pago != null &&
                lancamento.valor_pago !== lancamento.valor
                  ? Math.abs(Number(lancamento.valor_pago) - Number(lancamento.valor))
                  : 0;

              const isReabrindo = reabrindoId === lancamento.id;

              return (
                <Card key={lancamento.id} className="border-green-200 w-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex-1 min-w-0 space-y-2">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2 break-words leading-tight">
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                          {lancamento.descricao || '-'}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                            Vencimento: {formatDate(lancamento.vencimento)}
                          </span>
                          {lancamento.data_pagamento && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                              Pago em: {formatDate(lancamento.data_pagamento)}
                            </span>
                          )}
                          <Badge variant={lancamento.tipo === 'DESPESA' ? 'secondary' : 'default'} className="text-xs">
                            {lancamento.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                          </Badge>
                          <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                            Pago
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-xs text-muted-foreground mb-1">
                          Valor Original: {formatCurrency(Number(lancamento.valor || 0))}
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-green-600 mb-2">
                          {formatCurrency(valorPagoOuOriginal)}
                        </div>

                        {/* 🔄 Botão Reabrir */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reabrirLancamento(lancamento)}
                          disabled={isReabrindo}
                          className="text-xs px-2 py-1 h-auto whitespace-nowrap"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          {isReabrindo ? 'Reabrindo...' : 'Reabrir'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-2">
                    <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
                      {lancamento.categoria?.name && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="break-words">Categoria: {lancamento.categoria.name}</span>
                        </div>
                      )}
                      {lancamento.beneficiario?.name && (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="break-words">Beneficiário: {lancamento.beneficiario.name}</span>
                        </div>
                      )}
                      {lancamento.observacoes && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="break-words">Obs: {lancamento.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {diferenca > 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="text-sm">
                          <span className="font-medium text-yellow-800">Diferença no pagamento:</span>
                          <span className="ml-2 text-yellow-700">
                            {Number(lancamento.valor_pago) > Number(lancamento.valor)
                              ? 'Pago a mais'
                              : 'Pago a menos'}
                            : {formatCurrency(diferenca)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContasPagas;
