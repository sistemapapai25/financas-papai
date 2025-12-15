import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';
import EditarLancamentoDialog from '@/components/EditarLancamentoDialog';
import { Filter, Rows, Square, ChevronLeft, ChevronRight, Pencil, CheckCircle, RotateCcw, Tag, User, Calendar, Search, FileText, FileCheck2 } from 'lucide-react';

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
  categoria_id?: string | null;
  beneficiario?: { name: string } | null;
  beneficiario_id?: string | null;
  boleto_url?: string | null;
  comprovante_url?: string | null;
}

const ContasPagas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dataRef, setDataRef] = useState(() => new Date());
  const [contas, setContas] = useState<{ id: string; nome: string; instituicao?: string | null; logo?: string | null }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [modoCard, setModoCard] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const [lancamentoParaEditar, setLancamentoParaEditar] = useState<Lancamento | null>(null);
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();
  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const inicio = toYMD(new Date(ano, mes, 1));
  const fim = toYMD(new Date(ano, mes + 1, 0));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('contas_financeiras')
      .select('id,nome,instituicao,logo')
      .order('nome')
      .then(({ data }) => {
        const arr = (data || []).map((c: { id: string; nome: string; instituicao?: string | null; logo?: string | null }) => ({ id: c.id, nome: c.nome, instituicao: c.instituicao ?? null, logo: c.logo ?? null }));
        setContas(arr);
      });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;
    setLoading(true);
    let q = supabase
      .from('lancamentos')
      .select('id, descricao, categoria:categories(name), categoria_id, beneficiario:beneficiaries(name), beneficiario_id, conta_id, tipo, valor, valor_pago, status, vencimento, data_pagamento, observacoes, boleto_url, comprovante_url')
      // .eq('user_id', user.id) // Removido para exibir lançamentos de todos os usuários
      .eq('status', 'PAGO')
      .gte('data_pagamento', inicio)
      .lte('data_pagamento', fim)
      .order('data_pagamento');
    if (contasSel.length > 0) q = q.in('conta_id', contasSel);
    q.then(({ data, error }) => {
      setLoading(false);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      setLancamentos((data as Lancamento[]) || []);
    });
  }, [user, inicio, fim, contasSel, updateTrigger]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  // ✅ Exibe datas sem criar Date()
  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    // Garante que a data seja tratada como string YYYY-MM-DD sem conversão de fuso
    const [ano, mes, dia] = date.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lancamentos;
    return lancamentos.filter((l) => {
      const desc = (l.descricao || '').toLowerCase();
      const obs = (l.observacoes || '').toLowerCase();
      const cat = (l.categoria?.name || '').toLowerCase();
      const benef = (l.beneficiario?.name || '').toLowerCase();
      const dataPag = formatDate(l.data_pagamento).toLowerCase();
      const valorBaseFmt = formatCurrency(Number(l.valor || 0)).toLowerCase();
      const valorPagoFmt = formatCurrency(Number(l.valor_pago || l.valor || 0)).toLowerCase();

      return (
        desc.includes(termo) ||
        obs.includes(termo) ||
        cat.includes(termo) ||
        benef.includes(termo) ||
        dataPag.includes(termo) ||
        valorBaseFmt.includes(termo) ||
        valorPagoFmt.includes(termo)
      );
    });
  }, [lancamentos, busca]);

  const saldoAtual = useMemo(() => {
    return lancamentos.reduce((s, r) => {
      const val = Number(r.valor_pago ?? r.valor ?? 0);
      return s + (r.tipo === 'RECEITA' ? val : -val);
    }, 0);
  }, [lancamentos]);

  const tituloMes = useMemo(() => {
    const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${nomes[mes]} de ${ano}`;
  }, [mes, ano]);

  const handleEditar = (lancamento: Lancamento) => {
    setLancamentoParaEditar(lancamento);
    setModalEdicaoOpen(true);
  };

  const handleSuccessEdicao = () => {
    setUpdateTrigger(prev => prev + 1);
    setModalEdicaoOpen(false);
    setLancamentoParaEditar(null);
  };

  const handleReabrir = async (lancamento: Lancamento) => {
    if (!confirm(`Reabrir o lançamento "${lancamento.descricao}" ? Ele voltara para Status EM_ABERTO.`)) return;

    try {
      // 1. Atualizar o lançamento para EM_ABERTO e limpar dados de pagamento
      const { error: updateError } = await supabase
        .from('lancamentos')
        .update({
          status: 'EM_ABERTO',
          data_pagamento: null,
          valor_pago: null,
          conta_id: null,
          forma_pagamento: null,
          comprovante_url: null
        })
        .eq('id', lancamento.id);

      if (updateError) throw updateError;

      // 2. Remover o movimento financeiro associado (se houver)
      // Assumindo que o movimento tem ref_id = lancamento.id e origem = 'LANCAMENTO'
      const { error: deleteMovError } = await supabase
        .from('movimentos_financeiros')
        .delete()
        .eq('ref_id', lancamento.id)
        .eq('origem', 'LANCAMENTO');

      if (deleteMovError) {
        console.error('Erro ao excluir movimento financeiro:', deleteMovError);
        // Não vamos travar o fluxo se falhar aqui, mas é bom logar
      }

      toast({ title: 'Sucesso', description: 'Lançamento reaberto com sucesso!' });
      setUpdateTrigger(prev => prev + 1);

    } catch (error: unknown) {
      console.error('Erro ao reabrir lançamento:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao reabrir lançamento',
        variant: 'destructive',
      });
    }
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Contas Pagas</h1>

        <div className="flex items-center justify-between gap-3 mb-4">
          <NovoLancamentoDialog trigger={
            <Button className="bg-emerald-600 hover:bg-emerald-700">Adicionar</Button>
          } />
          <div className="flex items-center gap-2">
            <Button variant={modoCard ? 'secondary' : 'ghost'} onClick={() => setModoCard(false)}><Rows className="w-4 h-4" /></Button>
            <Button variant={modoCard ? 'ghost' : 'secondary'} onClick={() => setModoCard(true)}><Square className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="font-semibold w-40 text-center">{tituloMes}</div>
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-64 pl-9 pr-10"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <span className="sr-only">Limpar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              )}
            </div>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {(() => {
                    const first = contasSel.length ? contas.find(c => c.id === contasSel[0]) : null;
                    return (
                      <div className="flex items-center gap-2">
                        {first?.logo ? (
                          <img src={first.logo} alt="Logo" className="h-5 w-5 object-contain" />
                        ) : null}
                        <span>{first?.nome || 'Todas Contas e Cartões'}</span>
                      </div>
                    );
                  })()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[260px]">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setContasSel([]); setMenuOpen(false); }}>
                  <div className="flex items-center gap-2">
                    <span>Todas Contas e Cartões</span>
                  </div>
                </DropdownMenuItem>
                {contas.map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={(e) => { e.preventDefault(); setContasSel([c.id]); setMenuOpen(false); }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {c.logo ? (
                        <img src={c.logo} alt="Logo" className="h-5 w-5 object-contain" />
                      ) : null}
                      <span>{c.nome}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Total de Pagamentos</div>
              <div className="text-xl font-semibold text-emerald-600">{formatCurrency(Math.abs(saldoAtual))}</div>
            </CardContent>
          </Card>
        </div>

        {!modoCard ? (
          <div className="overflow-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Pago em</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Categoria</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{formatDate(r.data_pagamento)}</td>
                    <td className="p-2">
                      {r.descricao}
                      <span className="ml-2 inline-flex items-center gap-1 align-middle">
                        {r.boleto_url && <FileText className="h-3 w-3 text-slate-400" />}
                        {r.comprovante_url && <FileCheck2 className="h-3 w-3 text-emerald-600" />}
                      </span>
                    </td>
                    <td className="p-2">{r.categoria?.name || ''}</td>
                    <td className="p-2 text-right"><span className={r.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(Number(r.valor_pago ?? r.valor ?? 0))}</span></td>
                    <td className="p-2 text-center">
                      {r.boleto_url && (
                        <Button variant="ghost" size="icon" onClick={() => window.open(r.boleto_url || '', '_blank')}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      {r.comprovante_url && (
                        <Button variant="ghost" size="icon" onClick={() => window.open(r.comprovante_url || '', '_blank')}>
                          <FileCheck2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEditar(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map(r => (
              <Card key={r.id} className="border-emerald-200 shadow-sm relative overflow-hidden">
                <CardContent className="p-5 space-y-4">

                  {/* Header: Check, Desc, Original Value, Paid Value */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
                      <div>
                        <div className="font-bold text-lg text-slate-900 leading-tight">{r.descricao}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Valor Original: {formatCurrency(r.valor)}</div>
                      <div className="text-xl font-bold text-emerald-600">{formatCurrency(Number(r.valor_pago ?? r.valor ?? 0))}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.boleto_url && <FileText className="h-4 w-4 text-slate-400" />}
                      {r.comprovante_url && <FileCheck2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-1 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Vencimento: <span className="text-slate-700">{formatDate(r.vencimento)}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Pago em: <span className="text-slate-700">{formatDate(r.data_pagamento)}</span></span>
                    </div>
                  </div>

                  {/* Badges & Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-normal">
                        {r.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-normal">
                        Pago
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-slate-700 border-slate-200 hover:bg-slate-50 gap-2"
                      onClick={() => handleReabrir(r)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reabrir
                    </Button>
                  </div>

                  <div className="space-y-1.5 text-sm text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-slate-400" />
                      <span>Categoria: <span className="text-slate-900">{r.categoria?.name || '-'}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>Beneficiário: <span className="text-slate-900">{r.beneficiario?.name || '-'}</span></span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button
                      variant="outline"
                      className="w-auto gap-2 text-slate-700 border-slate-200"
                      onClick={() => r.boleto_url && window.open(r.boleto_url || '', '_blank')}
                      disabled={!r.boleto_url}
                    >
                      <FileText className="h-4 w-4" />
                      Boleto
                    </Button>
                    <Button
                      variant="outline"
                      className="w-auto gap-2 text-slate-700 border-slate-200"
                      onClick={() => r.comprovante_url && window.open(r.comprovante_url || '', '_blank')}
                      disabled={!r.comprovante_url}
                    >
                      <FileCheck2 className="h-4 w-4" />
                      Comprovante
                    </Button>
                  </div>

                </CardContent>
              </Card>
            ))}
            {filtradas.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
      </div>

      {lancamentoParaEditar && (
        <EditarLancamentoDialog
          lancamento={{
            ...lancamentoParaEditar,
            categoria_id: lancamentoParaEditar.categoria_id || '', // Fallback se vier null
            beneficiario_id: lancamentoParaEditar.beneficiario_id || undefined,
            observacoes: lancamentoParaEditar.observacoes || undefined,
            data_pagamento: lancamentoParaEditar.data_pagamento || undefined,
            valor_pago: lancamentoParaEditar.valor_pago || undefined,
            boleto_url: lancamentoParaEditar.boleto_url || undefined,
            comprovante_url: lancamentoParaEditar.comprovante_url || undefined
          }}
          open={modalEdicaoOpen}
          onOpenChange={setModalEdicaoOpen}
          onSuccess={handleSuccessEdicao}
          restrictedEditing={true}
        />
      )}
    </div>
  );
};

export default ContasPagas;
