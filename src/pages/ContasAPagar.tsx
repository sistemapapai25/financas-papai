// src/pages/ContasAPagar.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, Rows, Square, ChevronLeft, ChevronRight } from 'lucide-react';

import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';

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
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [modoCard, setModoCard] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();
  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const inicio = toYMD(new Date(ano, mes, 1));
  const fim = toYMD(new Date(ano, mes + 1, 0));

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('contas_financeiras')
      .select('id,nome')
      .order('nome')
      .then(({ data }) => {
        const arr = (data || []).map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome }));
        setContas(arr);
      });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;
    setLoading(true);
    let q = supabase
      .from('lancamentos')
      .select('id, descricao, categoria_id, beneficiario_id, observacoes, categoria:categories(name), beneficiario:beneficiaries(name), conta_id, tipo, valor, status, vencimento')
      .eq('user_id', user.id)
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
  }, [user, inicio, fim, contasSel]);

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
    if (!supabase || !user) return;
    setLoading(true);
    let q = supabase
      .from('lancamentos')
      .select('id, descricao, categoria_id, beneficiario_id, observacoes, categoria:categories(name), beneficiario:beneficiaries(name), conta_id, tipo, valor, status, vencimento')
      .eq('user_id', user.id)
      .eq('status', 'EM_ABERTO')
      .gte('vencimento', inicio)
      .lte('vencimento', fim)
      .order('vencimento');
    if (contasSel.length > 0) q = q.in('conta_id', contasSel);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setLancamentos((data as Lancamento[]) || []);
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
    const nomes = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    return `${nomes[mes]} de ${ano}`;
  }, [mes, ano]);

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
        <div className="flex items-center justify-between gap-3 mb-4">
          <NovoLancamentoDialog trigger={
            <Button className="bg-emerald-600 hover:bg-emerald-700">Adicionar</Button>
          } />
          <div className="flex items-center gap-2">
            <Button variant={modoCard ? 'secondary' : 'ghost'} onClick={() => setModoCard(false)}><Rows className="w-4 h-4"/></Button>
            <Button variant={modoCard ? 'ghost' : 'secondary'} onClick={() => setModoCard(true)}><Square className="w-4 h-4"/></Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes-1, 1))}><ChevronLeft className="w-4 h-4"/></Button>
            <div className="font-semibold w-40 text-center">{tituloMes}</div>
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes+1, 1))}><ChevronRight className="w-4 h-4"/></Button>
          </div>
          <div className="flex-1"/>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input placeholder="Pesquisar" value={busca} onChange={e=>setBusca(e.target.value)} className="w-64"/>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Filter className="w-4 h-4 mr-2"/>Contas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[220px]">
                {contas.map(c => (
                  <DropdownMenuItem key={c.id} onSelect={(e)=>{e.preventDefault(); const s = new Set(contasSel); if (s.has(c.id)) { s.delete(c.id); } else { s.add(c.id); } setContasSel(Array.from(s));}}>
                    <Checkbox checked={contasSel.includes(c.id)} onCheckedChange={(v)=>{const s=new Set(contasSel); if (v === true) s.add(c.id); else s.delete(c.id); setContasSel(Array.from(s));}}/>
                    <span className="ml-2">{c.nome}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Saldo atual no período</div>
              <div className={`text-xl font-semibold ${saldoAtual>=0? 'text-emerald-600':'text-red-600'}`}>{formatCurrency(saldoAtual)}</div>
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
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{formatDate(r.vencimento)}</td>
                    <td className="p-2">{r.descricao}</td>
                    <td className="p-2">{r.categoria?.name||''}</td>
                    <td className="p-2 text-right"><span className={r.tipo==='RECEITA'?'text-emerald-600':'text-red-600'}>R$ {r.valor.toFixed(2)}</span></td>
                    <td className="p-2">{r.status||'EM_ABERTO'}</td>
                  </tr>
                ))}
                {filtrados.length===0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{formatDate(r.vencimento)}</div>
                  <div className="font-medium">{r.descricao}</div>
                  <div className="text-sm">{r.categoria?.name||''}</div>
                  <div className={`mt-2 text-lg font-semibold ${r.tipo==='RECEITA'?'text-emerald-600':'text-red-600'}`}>R$ {r.valor.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{r.status||'EM_ABERTO'}</div>
                </CardContent>
              </Card>
            ))}
            {filtrados.length===0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
