// src/pages/ContasAPagar.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  DollarSign,
  User,
  Tag,
  FileText,
  Edit,
  Trash2,
  MoreVertical,
  Paperclip,
  Receipt,
  Search,
  CreditCard,
} from 'lucide-react';

import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';
import EditarLancamentoDialog from '@/components/EditarLancamentoDialog';
import PagarLancamentoDialog from '@/components/PagarLancamentoDialog';

// 🔹 utils de data (sem UTC)
import { ymdToBr } from '@/utils/date';

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;            // YYYY-MM-DD
  tipo: 'DESPESA' | 'RECEITA';
  status: 'EM_ABERTO' | 'PAGO' | 'CANCELADO';
  observacoes?: string | null;
  categoria_id: string;
  beneficiario_id?: string | null;
  data_pagamento?: string | null; // YYYY-MM-DD
  valor_pago?: number | null;
  boleto_url?: string | null;
  comprovante_url?: string | null;
  categoria?: { name: string } | null;
  beneficiario?: { name: string } | null;
}

export default function ContasAPagar() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  const [editandoLancamento, setEditandoLancamento] = useState<Lancamento | null>(null);
  const [pagando, setPagando] = useState<Lancamento | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  // 🔎 única barra de pesquisa
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (user) loadContasAPagar();
  }, [user]);

  async function loadContasAPagar() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lancamentos')
        .select(
          `
          *,
          categoria:categories(name),
          beneficiario:beneficiaries(name)
        `
        )
        .eq('status', 'EM_ABERTO')
        .order('vencimento', { ascending: true });

      if (error) throw error;
      setLancamentos((data as Lancamento[]) || []);
    } catch (error) {
      console.error('Erro ao carregar contas a pagar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar as contas a pagar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  // ✅ Exibe "YYYY-MM-DD" como "DD/MM/YYYY" sem criar Date()
  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    return ymdToBr(date);
  };

  // ✅ Compara datas localmente: parse manual de "YYYY-MM-DD" -> Date(local)
  const parseYMDToLocalDate = (ymd: string) => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(ymd);
    if (!ok) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d); // local
  };

  const isVencido = (vencimento: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataV = parseYMDToLocalDate(vencimento);
    if (!dataV) return false;
    dataV.setHours(0, 0, 0, 0);
    return dataV < hoje;
  };

  async function excluirLancamento(id: string) {
    try {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Lançamento excluído com sucesso!' });
      loadContasAPagar();
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir lançamento',
        variant: 'destructive',
      });
    }
  }

  // 🔎 Filtro simples em memória (descrição, observações, categoria, beneficiário, data e valor)
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lancamentos;

    return lancamentos.filter((l) => {
      const desc = (l.descricao || '').toLowerCase();
      const obs = (l.observacoes || '').toLowerCase();
      const cat = (l.categoria?.name || '').toLowerCase();
      const benef = (l.beneficiario?.name || '').toLowerCase();
      const dataVenc = formatDate(l.vencimento).toLowerCase(); // usa ymdToBr
      const valorFmt = formatCurrency(l.valor).toLowerCase();

      return (
        desc.includes(termo) ||
        obs.includes(termo) ||
        cat.includes(termo) ||
        benef.includes(termo) ||
        dataVenc.includes(termo) ||
        valorFmt.includes(termo)
      );
    });
  }, [lancamentos, busca]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 space-y-6 w-full">
      {/* Título + Novo Lançamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Contas a Pagar</h1>
          <p className="text-muted-foreground">Gerencie e pesquise suas contas em aberto</p>
        </div>
        <NovoLancamentoDialog onSuccess={loadContasAPagar} />
      </div>

      {/* 🔎 Barra de pesquisa única (clean) com botão X para limpar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full border rounded-lg pl-9 pr-9 py-2 outline-none focus:ring-2 focus:ring-primary"
            placeholder="Pesquisar por descrição, beneficiário, categoria, data ou valor"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
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
      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma conta a pagar</h3>
              <p className="mb-1">
                {lancamentos.length > 0
                  ? 'A pesquisa atual não retornou resultados.'
                  : 'Você não possui contas em aberto no momento.'}
              </p>
              {busca ? (
                <p className="text-xs text-muted-foreground">Dica: limpe a busca para ver todos os registros.</p>
              ) : null}
              <div className="mt-4">
                <NovoLancamentoDialog onSuccess={loadContasAPagar} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 w-full">
          {filtrados.map((lancamento) => (
            <Card
              key={lancamento.id}
              className={`w-full ${isVencido(lancamento.vencimento) ? 'border-destructive' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg break-words leading-tight pr-2">
                        {lancamento.descricao}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPagando(lancamento)}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pagar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditandoLancamento(lancamento)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => excluirLancamento(lancamento.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        {formatDate(lancamento.vencimento)}
                      </span>
                      {isVencido(lancamento.vencimento) && (
                        <Badge variant="destructive" className="text-xs">
                          Vencido
                        </Badge>
                      )}
                      <Badge
                        variant={lancamento.tipo === 'DESPESA' ? 'secondary' : 'default'}
                        className="text-xs"
                      >
                        {lancamento.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-lg sm:text-xl font-bold text-primary mb-2">
                      {formatCurrency(lancamento.valor)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPagando(lancamento)}
                      className="text-xs px-2 py-1 h-auto whitespace-nowrap"
                    >
                      Pagar
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

                  {/* Arquivos */}
                  <div className="flex flex-wrap gap-2">
                    {lancamento.boleto_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => window.open(lancamento.boleto_url!, '_blank')}
                      >
                        <Receipt className="w-3 h-3 mr-1" />
                        Boleto
                      </Button>
                    )}
                    {lancamento.comprovante_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => window.open(lancamento.comprovante_url!, '_blank')}
                      >
                        <Paperclip className="w-3 h-3 mr-1" />
                        Comprovante
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      {editandoLancamento && (
        <EditarLancamentoDialog
          lancamento={editandoLancamento}
          open={!!editandoLancamento}
          onOpenChange={(open) => !open && setEditandoLancamento(null)}
          onSuccess={loadContasAPagar}
        />
      )}

      {/* Diálogo de Pagamento */}
      {pagando && (
        <PagarLancamentoDialog
          lancamento={{
            id: pagando.id,
            descricao: pagando.descricao,
            valor: pagando.valor,
            vencimento: pagando.vencimento, // YYYY-MM-DD
            tipo: pagando.tipo,
          }}
          open={!!pagando}
          onOpenChange={(open) => !open && setPagando(null)}
          onSuccess={loadContasAPagar}
        />
      )}
    </div>
  );
}
