// src/pages/ContasPagas.tsx
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
import NovoLancamentoDialog from '@/components/NovoLancamentoDialog';
import { Filter, Rows, Square, ChevronLeft, ChevronRight } from 'lucide-react';

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
      .select('id, descricao, categoria:categories(name), beneficiario:beneficiaries(name), conta_id, tipo, valor, valor_pago, status, vencimento, data_pagamento')
      .eq('user_id', user.id)
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
  }, [user, inicio, fim, contasSel]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  // ✅ Exibe datas sem criar Date()
  const formatDate = (date?: string | null) => (!date ? '-' : ymdToBr(date));

  // Sem ações extras para manter a mesma aparência/funcionalidade da tela de Contas a Pagar

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
                  <th className="p-2 text-left">Pago em</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Categoria</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{formatDate(r.data_pagamento)}</td>
                    <td className="p-2">{r.descricao}</td>
                    <td className="p-2">{r.categoria?.name||''}</td>
                    <td className="p-2 text-right"><span className={r.tipo==='RECEITA'?'text-emerald-600':'text-red-600'}>{formatCurrency(Number(r.valor_pago ?? r.valor ?? 0))}</span></td>
                    <td className="p-2">{r.status||'PAGO'}</td>
                  </tr>
                ))}
                {filtradas.length===0 && (
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
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{formatDate(r.data_pagamento)}</div>
                  <div className="font-medium">{r.descricao}</div>
                  <div className="text-sm">{r.categoria?.name||''}</div>
                  <div className={`mt-2 text-lg font-semibold ${r.tipo==='RECEITA'?'text-emerald-600':'text-red-600'}`}>{formatCurrency(Number(r.valor_pago ?? r.valor ?? 0))}</div>
                  <div className="text-xs text-muted-foreground">{r.status||'PAGO'}</div>
                </CardContent>
              </Card>
            ))}
            {filtradas.length===0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContasPagas;
