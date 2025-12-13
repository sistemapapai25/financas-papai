// src/pages/ContasAPagar.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, Rows, Square, ChevronLeft, ChevronRight, Pencil, Calendar, Tag, User, FileText, FileCheck2, MoreVertical, Search } from 'lucide-react';

import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';
import EditarLancamentoDialog from '@/components/EditarLancamentoDialog';
import PagarLancamentoDialog, { LancamentoMin } from '@/components/PagarLancamentoDialog';

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

  const [lancamentoParaPagar, setLancamentoParaPagar] = useState<LancamentoMin | null>(null);
  const [modalPagamentoOpen, setModalPagamentoOpen] = useState(false);

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
      .select('id, descricao, categoria_id, beneficiario_id, observacoes, categoria:categories(name), beneficiario:beneficiaries(name), conta_id, tipo, valor, status, vencimento, boleto_url, comprovante_url')
      // .eq('user_id', user.id)
      .eq('status', 'EM_ABERTO')
      .gte('vencimento', inicio)
      .lte('vencimento', fim)
      .order('vencimento');
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

  const loadContasAPagar = async () => {
    // Função mantida para compatibilidade, mas o useEffect principal já carrega os dados
    setUpdateTrigger(prev => prev + 1);
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

  const saldoAtual = useMemo(() => {
    return lancamentos.reduce((s, r) => s + (r.tipo === 'RECEITA' ? r.valor : -r.valor), 0);
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

  const handlePagar = (lancamento: Lancamento) => {
    setLancamentoParaPagar({
      id: lancamento.id,
      descricao: lancamento.descricao,
      valor: lancamento.valor,
      vencimento: lancamento.vencimento,
      tipo: lancamento.tipo,
      conta_id: null,
      data_pagamento: null,
      valor_pago: null,
      comprovante_url: null
    });
    setModalPagamentoOpen(true);
  };

  const handleSuccessPagamento = () => {
    setUpdateTrigger(prev => prev + 1);
    setModalPagamentoOpen(false);
    setLancamentoParaPagar(null);
    toast({ title: 'Sucesso', description: 'Pagamento realizado com sucesso!' });
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Contas a Pagar</h1>

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
              <div className="text-sm text-muted-foreground">Total de Contas a Pagar</div>
              <div className={`text-xl font-semibold ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(saldoAtual))}</div>
            </CardContent>
          </Card>
        </div>

        {!modoCard ? (
          <div className="overflow-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Categoria</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{formatDate(r.vencimento)}</td>
                    <td className="p-2">
                      {r.descricao}
                      <span className="ml-2 inline-flex items-center gap-1 align-middle">
                        {r.boleto_url && <FileText className="h-3 w-3 text-slate-400" />}
                        {r.comprovante_url && <FileCheck2 className="h-3 w-3 text-emerald-600" />}
                      </span>
                    </td>
                    <td className="p-2">{r.categoria?.name || ''}</td>
                    <td className="p-2 text-right"><span className={r.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-red-600'}>R$ {r.valor.toFixed(2)}</span></td>
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
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map(r => {
              const vencido = isVencido(r.vencimento) && r.status === 'EM_ABERTO';
              return (
                <Card key={r.id} className="relative border-red-200 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    {/* Header: Title, Menu, Value */}
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-lg text-slate-900">{r.descricao}</div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditar(r)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => excluirLancamento(r.id)} className="text-red-600">
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className={`text-xl font-bold ${r.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {formatCurrency(r.valor)}
                        </div>
                        <div className="flex items-center gap-1">
                          {r.boleto_url && <FileText className="h-4 w-4 text-slate-400" />}
                          {r.comprovante_url && <FileCheck2 className="h-4 w-4 text-emerald-600" />}
                        </div>
                      </div>
                    </div>

                    {/* Date Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">{formatDate(r.vencimento)}</span>
                        {vencido && (
                          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white font-normal px-2 py-0.5 rounded-full text-xs">
                            Vencido
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-4 text-slate-700 border-slate-200 hover:bg-slate-50"
                        onClick={() => handlePagar(r)}
                      >
                        Pagar
                      </Button>
                    </div>

                    {/* Type Badge */}
                    <div>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-normal">
                        {r.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-slate-400" />
                        <span>Categoria: <span className="text-slate-900">{r.categoria?.name || '-'}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>Beneficiário: <span className="text-slate-900">{r.beneficiario?.name || '-'}</span></span>
                      </div>
                    </div>

                    {/* Footer: Boleto Button */}
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
              );
            })}
            {filtrados.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
      </div>

      {lancamentoParaEditar && (
        <EditarLancamentoDialog
          lancamento={{
            ...lancamentoParaEditar,
            categoria_id: lancamentoParaEditar.categoria_id || '',
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
        />
      )}

      {lancamentoParaPagar && (
        <PagarLancamentoDialog
          lancamento={lancamentoParaPagar}
          open={modalPagamentoOpen}
          onOpenChange={setModalPagamentoOpen}
          onSuccess={handleSuccessPagamento}
        />
      )}
    </div>
  );
}
