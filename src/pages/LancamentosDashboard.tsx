import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter, Rows, Square } from "lucide-react";
import { ymdToBr } from "@/utils/date";

type Mov = {
  id: string;
  data: string;
  descricao: string | null;
  conta_id: string | null;
  conta_nome?: string | null;
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  origem?: "LANCAMENTO" | "CULTO" | "AJUSTE" | null;
};

export default function LancamentosDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dataRef, setDataRef] = useState(() => new Date());
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [modoCard, setModoCard] = useState(false);
  const [rows, setRows] = useState<Mov[]>([]);
  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const inicio = toYmd(new Date(ano, mes, 1));
  const fim = toYmd(new Date(ano, mes + 1, 0));

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("contas_financeiras")
      .select("id,nome")
      .order("nome")
      .then(({ data }) => {
        const arr = (data || []).map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome }));
        setContas(arr);
      });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;
    let q = supabase
      .from("movimentos_financeiros")
      .select("id, data, descricao, valor, tipo, origem, conta_id, contas:contas_financeiras(nome)")
      .eq("user_id", user.id)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data");
    if (contasSel.length > 0) {
      q = q.in("conta_id", contasSel);
    }
    q.then(({ data, error }) => {
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      const arr: Mov[] = (data || []).map((r: { id: string; data: string; descricao: string | null; valor: number; tipo: "ENTRADA"|"SAIDA"; origem?: string|null; conta_id?: string|null; contas?: { nome?: string|null } | null }) => ({
        id: r.id,
        data: r.data,
        descricao: r.descricao ?? null,
        conta_id: r.conta_id ?? null,
        conta_nome: r.contas?.nome ?? null,
        tipo: r.tipo,
        valor: r.valor,
        origem: (r.origem as Mov["origem"]) ?? null,
      }));
      setRows(arr);
    });
  }, [user, inicio, fim, contasSel]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const saldoAtual = useMemo(() => {
    return rows.reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : -r.valor), 0);
  }, [rows]);

  const tituloMes = useMemo(() => {
    const nomes = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    return `${nomes[mes]} de ${ano}`;
  }, [mes, ano]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div />
          <div className="flex items-center gap-2">
            <Button variant={modoCard ? "secondary" : "ghost"} onClick={() => setModoCard(false)}><Rows className="w-4 h-4"/></Button>
            <Button variant={modoCard ? "ghost" : "secondary"} onClick={() => setModoCard(true)}><Square className="w-4 h-4"/></Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes - 1, 1))}><ChevronLeft className="w-4 h-4"/></Button>
            <div className="font-semibold w-40 text-center">{tituloMes}</div>
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes + 1, 1))}><ChevronRight className="w-4 h-4"/></Button>
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
                  <DropdownMenuItem key={c.id} onSelect={(e)=>{e.preventDefault(); const s = new Set(contasSel); s.has(c.id)? s.delete(c.id): s.add(c.id); setContasSel(Array.from(s));}}>
                    <Checkbox checked={contasSel.includes(c.id)} onCheckedChange={(v)=>{const s=new Set(contasSel); if(Boolean(v)) s.add(c.id); else s.delete(c.id); setContasSel(Array.from(s));}}/>
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
                  <th className="p-2 text-left">Conta</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-left">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r=>{
                  const termo = busca.trim().toLowerCase();
                  if (!termo) return true;
                  const desc = (r.descricao||'').toLowerCase();
                  const dataFmt = ymdToBr(r.data).toLowerCase();
                  const valorFmt = formatCurrency(r.valor).toLowerCase();
                  return desc.includes(termo) || dataFmt.includes(termo) || valorFmt.includes(termo);
                }).map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{ymdToBr(r.data)}</td>
                    <td className="p-2">{r.descricao}</td>
                    <td className="p-2">{r.conta_nome||''}</td>
                    <td className="p-2 text-right"><span className={r.tipo==='ENTRADA'?'text-emerald-600':'text-red-600'}>{formatCurrency(r.valor)}</span></td>
                    <td className="p-2">{r.tipo}</td>
                  </tr>
                ))}
                {rows.length===0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{ymdToBr(r.data)}</div>
                  <div className="font-medium">{r.descricao}</div>
                  <div className="text-sm">{r.conta_nome||''}</div>
                  <div className={`mt-2 text-lg font-semibold ${r.tipo==='ENTRADA'?'text-emerald-600':'text-red-600'}`}>{formatCurrency(r.valor)}</div>
                  <div className="text-xs text-muted-foreground">{r.tipo}</div>
                </CardContent>
              </Card>
            ))}
            {rows.length===0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
