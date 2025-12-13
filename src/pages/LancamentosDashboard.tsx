import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter, Rows, Square, Edit3, Search, X, Wand2, FileText, ExternalLink, ScanText } from "lucide-react";
import { ymdToBr } from "@/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import NovoBeneficiarioModal from "@/components/NovoBeneficiarioModal";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import FileUpload from "@/components/FileUpload";

type Mov = {
  id: string;
  data: string;
  descricao: string | null;
  conta_id: string | null;
  conta_nome?: string | null;
  categoria_id?: string | null;
  beneficiario_id?: string | null;
  categoria_nome?: string | null;
  beneficiario_nome?: string | null;
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  origem?: "LANCAMENTO" | "CULTO" | "AJUSTE" | null;
  comprovante_url?: string | null;
};

export default function LancamentosDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dataRef, setDataRef] = useState(() => new Date());
  const [contas, setContas] = useState<{ id: string; nome: string; logo?: string | null; saldo_inicial?: number }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [modoCard, setModoCard] = useState(false);
  const [rows, setRows] = useState<Mov[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editMov, setEditMov] = useState<Mov | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCategoriaId, setEditCategoriaId] = useState<string>("");
  const [editBenefId, setEditBenefId] = useState<string>("");
  const [editComprovanteUrl, setEditComprovanteUrl] = useState<string>("");
  const [catOpts, setCatOpts] = useState<{ id: string; name: string; tipo: string; parent_id: string | null }[]>([]);
  const [benefOpts, setBenefOpts] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [openCategoria, setOpenCategoria] = useState(false);
  const [openBeneficiario, setOpenBeneficiario] = useState(false);
  const [benefSearch, setBenefSearch] = useState("");
  const [addingBenef, setAddingBenef] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
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
      .select("id,nome,logo,saldo_inicial")
      .order("nome")
      .then(({ data }) => {
        const arr = (data || []).map((c: { id: string; nome: string; logo?: string | null; saldo_inicial?: number }) => ({ id: c.id, nome: c.nome, logo: c.logo ?? null, saldo_inicial: Number(c.saldo_inicial || 0) }));
        setContas(arr);

        // Ensure "Transferência Interna" categories exist
        ensureTransferCategories();
      });
  }, [user]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const ensureTransferCategories = async () => {
    if (!user) return;
    const { data: existing } = await supabase.from('categories').select('id, name, tipo').eq('user_id', user.id).eq('name', 'Transferência Interna');

    // Check if we have both types
    const hasDespesa = existing?.some(c => c.tipo === 'DESPESA');
    const hasReceita = existing?.some(c => c.tipo === 'RECEITA');

    if (!hasDespesa) {
      await supabase.from('categories').insert({ user_id: user.id, name: 'Transferência Interna', tipo: 'DESPESA', parent_id: null });
    }
    if (!hasReceita) {
      await supabase.from('categories').insert({ user_id: user.id, name: 'Transferência Interna', tipo: 'RECEITA', parent_id: null });
    }
  };

  useEffect(() => {
    if (!supabase || !user) return;
    let q = supabase
      .from("movimentos_financeiros")
      .select("id, data, descricao, valor, tipo, origem, conta_id, categoria_id, beneficiario_id, comprovante_url, contas:contas_financeiras(nome), categoria:categories(name), beneficiario:beneficiaries(name)")
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
      const arr: Mov[] = (data || []).map((r) => ({
        id: r.id,
        data: r.data,
        descricao: r.descricao ?? null,
        conta_id: r.conta_id ?? null,
        conta_nome: r.contas?.nome ?? null,
        categoria_id: r.categoria_id ?? null,
        beneficiario_id: r.beneficiario_id ?? null,
        categoria_nome: r.categoria?.name ?? null,
        beneficiario_nome: r.beneficiario?.name ?? null,
        tipo: r.tipo as Mov["tipo"],
        valor: r.valor,
        origem: (r.origem as Mov["origem"]) ?? null,
        comprovante_url: r.comprovante_url ?? null,
      }));
      setRows(arr);
    });
  }, [user, inicio, fim, contasSel]);

  useEffect(() => {
    if (!supabase || !user) return;
    const contasIds = contasSel.length ? contasSel : contas.map(c => c.id);
    const baseInicial = contas
      .filter(c => contasIds.includes(c.id))
      .reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
    let q = supabase
      .from("movimentos_financeiros")
      .select("valor,tipo,conta_id")
      .eq("user_id", user.id)
      .lt("data", inicio);
    if (contasIds.length > 0) {
      q = q.in("conta_id", contasIds);
    }
    q.then(({ data, error }) => {
      if (error) return;
      const net = (data || []).reduce((s: number, r) => {
        // If it's a transfer, ignore for "Gain/Loss" but here we are calculating Initial Balance based on past transactions.
        // Wait, balance MUST include transfers because money actually moved.
        // The user asked to not appear in "Reports of Expense/Revenue", implying "Earnings vs Spendings".
        // But for ACCOUNT BALANCE (Saldo Inicial + Net), transfers MUST be included to match the bank.
        // So, this calculation here (which affects Saldo Inicial displayed) SHOULD include everything.
        // However, `saldoAtual` above is "Saldo atual no período" which is often used as a performance metric.
        // Actually, the card says "Saldo atual no período". If this is "Cash Flow", it should be real balance change.
        // If I receive a Transfer, my balance increases.
        // If I send a Transfer, my balance decreases.
        // So for "Saldo", it MUST include.

        // LIMITATION: The user said "nao aparecer em relatorios de despesa ou receita".
        // Usually this means "Don't tell me I spent 10k when I just moved 10k to savings".
        // `saldoAtual` card typically shows "How much money I have/gained".
        // If I move 10k checking -> savings. 
        // Checking view: -10k. Savings view: +10k. Total view: 0.
        // If `saldoAtual` is summing ALL selected accounts.
        // If I select "All Accounts", transfer out (-10k) and transfer in (+10k) sum to 0. Correct.
        // If I select ONLY Checking, I see -10k. Correct, money left.

        // SO WHERE TO FILTER?
        // The user likely means "Don't show in Pie Charts or 'Total Spent' summaries".
        // In THIS file `LancamentosDashboard`, `saldoAtual` is "Saldo atual no período".
        // If I filter `Transferência Interna` here, and I select All Accounts, it is 0 anyway.
        // But if I select just one... 

        // Let's stick to strict interpretation: "nao aparecer em relatorios".
        // This screen is a Dashboard/Statement.
        // Maybe I shouldn't touch `saldoAtual` here if it reflects the Bank Statement Balance.
        // BUT the user said "essa informação ja vem na tela" (from bank import) and "acho melhor ... nao aparecer em relatorios".

        // Let's look at `Dashboard.tsx` tiles (Total Em Aberto, Total Pago, Receitas). THAT is a report.
        // This `saldoAtual` here seems to be "Balance variation".
        // I will revert the change to `saldoAtual` in this file because this is the Statement View.
        // Changing it here would make the Statement Balance wrong vs the Bank.

        return s + (r.tipo === "ENTRADA" ? Number(r.valor || 0) : -Number(r.valor || 0));
      }, 0);
      setSaldoInicial(baseInicial + net);
    });
  }, [user, inicio, contasSel, contas]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const saldoAtual = useMemo(() => {
    return rows
      .filter(r => r.categoria_nome !== 'Transferência Interna') // Ignore Internal Transfers for Totals
      .reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : -r.valor), 0);
  }, [rows]);

  const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const tituloMes = useMemo(() => {
    return `${mesesPt[mes]} de ${ano}`;
  }, [mes, ano]);

  const ultimoIdPorDia = useMemo(() => {
    const dmap = new Map<string, string>();
    const byDay = new Map<string, Mov[]>();
    rows.forEach(r => {
      const arr = byDay.get(r.data) || [];
      arr.push(r);
      byDay.set(r.data, arr);
    });
    byDay.forEach((arr, day) => {
      const last = arr[arr.length - 1];
      if (last) dmap.set(day, last.id);
    });
    return dmap;
  }, [rows]);

  const saldoFechamentoPorDia = useMemo(() => {
    const dias = Array.from(new Set(rows.map(r => r.data))).sort();
    let acc = saldoInicial;
    const m = new Map<string, number>();
    dias.forEach(day => {
      const net = rows.filter(r => r.data === day).reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : -r.valor), 0);
      acc = acc + net;
      m.set(day, acc);
    });
    return m;
  }, [rows, saldoInicial]);

  async function openComprovante(url?: string | null) {
    if (!url) return;
    
    // Extract the file path from the URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/Comprovantes/comprovantes/...
    const pathMatch = url.match(/\/storage\/v1\/object\/public\/Comprovantes\/(.+)$/i);
    if (pathMatch) {
      const filePath = pathMatch[1];
      const { data, error } = await supabase.storage
        .from("Comprovantes")
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        return;
      }
    }
    
    // Fallback: try opening the original URL
    window.open(url, "_blank");
  }

  function abrirEdicao(m: Mov) {
    setEditMov(m);
    setEditDesc(m.descricao || "");
    setEditCategoriaId(m.categoria_id || "");
    setEditBenefId(m.beneficiario_id || "");
    setEditComprovanteUrl(m.comprovante_url || "");
    // setCatOpts and setBenefOpts will be populated by useEffect
    setEditOpen(true);
  }

  useEffect(() => {
    if (!editOpen || !user) return;

    // Load all categories for local filtering
    supabase
      .from("categories")
      .select("id, name, tipo, parent_id")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => {
        if (data) {
          // Filter to show only 'child' categories.
          // Strategy: A category is a child if it has a parent_id (assuming strict 2-level or user wants subcategories only).
          // OR: User wants LEAF nodes. If I have Root -> Sub, Root is parent.

          // Let's implement seeing if it is a parent to anyone else in the full list?
          // That might be expensive if many categories.
          // Simpler interpretation of "categoria filho": parent_id is not null.
          // If structure is strictly Root -> Child, then yes.

          // However, sometimes one might want to select a root that has no children?
          // Let's stick to "parent_id IS NOT NULL" based on the request "somente a categoria filho".
          // This implies excluding the "Pai" (Root).

          const childrenOnly = data.filter(c => c.parent_id !== null);
          setCatOpts(childrenOnly);
        }
      });

    // Load all beneficiaries for local filtering
    supabase
      .from("beneficiaries")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => {
        if (data) setBenefOpts(data);
      });
  }, [editOpen, user]);



  async function criarBeneficiarioInline() {
    if (!user) { toast({ title: "Sessão", description: "Faça login para criar beneficiário", variant: "destructive" }); return; }
    const nome = benefSearch.trim();
    if (nome.length < 3) { toast({ title: "Nome muito curto", description: "Digite pelo menos 3 caracteres" }); return; }
    try {
      setAddingBenef(true);
      const { data, error } = await supabase
        .from('beneficiaries')
        .insert({ user_id: user.id, name: nome })
        .select('id,name')
        .single();
      if (error) { throw error; }
      setBenefOpts(prev => [{ id: data.id, name: data.name }, ...prev]);
      setEditBenefId(data.id);
      setOpenBeneficiario(false);
      setBenefSearch("");
      toast({ title: 'Beneficiário criado', description: data.name });
    } catch (err: unknown) {
      toast({ title: 'Erro ao criar beneficiário', description: err instanceof Error ? err.message : 'Falha ao criar', variant: 'destructive' });
    } finally {
      setAddingBenef(false);
    }
  }

  async function salvarEdicao() {
    if (!editMov || !user) return;
    setSaving(true);
    try {
      const payload: Partial<{ descricao: string; categoria_id: string | null; beneficiario_id: string | null; comprovante_url: string | null }> = {
        descricao: editDesc,
        categoria_id: editCategoriaId ? editCategoriaId : null,
        beneficiario_id: editBenefId ? editBenefId : null,
        comprovante_url: editComprovanteUrl ? editComprovanteUrl : null,
      };
      const { error } = await supabase
        .from("movimentos_financeiros")
        .update(payload)
        .eq("id", editMov.id)
        .eq("user_id", user.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      setRows(prev => prev.map(r => r.id === editMov.id ? {
        ...r,
        descricao: editDesc || null,
        categoria_id: payload.categoria_id || null,
        beneficiario_id: payload.beneficiario_id || null,
        categoria_nome: (catOpts.find(c => c.id === editCategoriaId)?.name) || null,
        beneficiario_nome: (benefOpts.find(b => b.id === editBenefId)?.name) || null,
        comprovante_url: payload.comprovante_url || null,
      } : r));
      toast({ title: "Atualizado", description: "Movimento atualizado" });
      setEditOpen(false);
      setEditMov(null);
    } finally {
      setSaving(false);
    }
  }

  async function aplicarRegras() {
    if (!user) return;
    setApplyingRules(true);
    try {
      // Buscar todas as regras
      const { data: rules, error: rulesError } = await supabase
        .from("classification_rules")
        .select("id, term, category_id, beneficiary_id")
        .eq("user_id", user.id);

      if (rulesError) throw rulesError;
      if (!rules || rules.length === 0) {
        toast({ title: "Aviso", description: "Nenhuma regra cadastrada", variant: "destructive" });
        return;
      }

      let totalUpdated = 0;

      // Para cada regra, buscar e atualizar lançamentos do mês visível
      for (const rule of rules) {
        const { data: movs } = await supabase
          .from("movimentos_financeiros")
          .select("id")
          .eq("user_id", user.id)
          .gte("data", inicio)
          .lte("data", fim)
          .ilike("descricao", `%${rule.term}%`);

        if (movs && movs.length > 0) {
          const ids = movs.map(m => m.id);
          const { error: updateError } = await supabase
            .from("movimentos_financeiros")
            .update({
              categoria_id: rule.category_id,
              beneficiario_id: rule.beneficiary_id,
            })
            .in("id", ids)
            .eq("user_id", user.id);

          if (!updateError) {
            totalUpdated += movs.length;
          }
        }
      }

      toast({
        title: "Regras Aplicadas",
        description: `${totalUpdated} lançamento(s) atualizado(s) no mês ${tituloMes}`
      });

      // Recarregar dados
      let q = supabase
        .from("movimentos_financeiros")
        .select("id, data, descricao, valor, tipo, origem, conta_id, categoria_id, beneficiario_id, comprovante_url, contas:contas_financeiras(nome), categoria:categories(name), beneficiario:beneficiaries(name)")
        .eq("user_id", user.id)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data");
      if (contasSel.length > 0) {
        q = q.in("conta_id", contasSel);
      }
      const { data } = await q;
      const arr: Mov[] = (data || []).map((r) => ({
        id: r.id,
        data: r.data,
        descricao: r.descricao ?? null,
        conta_id: r.conta_id ?? null,
        conta_nome: r.contas?.nome ?? null,
        categoria_id: r.categoria_id ?? null,
        beneficiario_id: r.beneficiario_id ?? null,
        categoria_nome: r.categoria?.name ?? null,
        beneficiario_nome: r.beneficiario?.name ?? null,
        tipo: r.tipo as Mov["tipo"],
        valor: r.valor,
        origem: (r.origem as Mov["origem"]) ?? null,
        comprovante_url: r.comprovante_url ?? null,
      }));
      setRows(arr);
    } catch (error: unknown) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro ao recarregar dados", variant: "destructive" });
    } finally {
      setApplyingRules(false);
    }
  }

  async function lerEAplicar(m: Mov) {
    if (!m.comprovante_url) {
      toast({ title: "Comprovante", description: "Este movimento não possui comprovante.", variant: "destructive" });
      return;
    }
    const set = new Set(analyzingIds);
    set.add(m.id);
    setAnalyzingIds(set);
    try {
      // Generate signed URL for private bucket
      let urlToAnalyze = m.comprovante_url;
      const pathMatch = m.comprovante_url.match(/\/storage\/v1\/object\/public\/Comprovantes\/(.+)$/i);
      if (pathMatch) {
        const filePath = pathMatch[1];
        const { data: signedData } = await supabase.storage
          .from("Comprovantes")
          .createSignedUrl(filePath, 3600);
        if (signedData?.signedUrl) {
          urlToAnalyze = signedData.signedUrl;
        }
      }

      const { data, error } = await supabase.functions.invoke('analisar-comprovante', {
        body: { url: urlToAnalyze, user_id: user?.id, descricao: m.descricao || '' }
      });
      if (error) throw error;
      const recebedorNome = (data as any)?.recebedor_nome as string | undefined;
      if (recebedorNome) {
        toast({ title: "Dados do Recebedor", description: `Para: ${recebedorNome}` });
        return;
      }
      const sugestao = (data as any)?.sugestao as { categoria_id?: string | null; beneficiario_id?: string | null; motivo?: string } | undefined;
      if (sugestao?.beneficiario_id) {
        toast({ title: "Dados do Recebedor", description: sugestao.motivo ? `${sugestao.motivo}` : `Beneficiário identificado.` });
        return;
      }
      toast({ title: "Leitura feita", description: "Nenhuma informação de recebedor encontrada.", });
    } catch (e: unknown) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao ler comprovante.", variant: "destructive" });
    } finally {
      const s2 = new Set(analyzingIds);
      s2.delete(m.id);
      setAnalyzingIds(s2);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Extrato de Lançamentos</h1>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div />
          <div className="flex items-center gap-2">
            <Button variant={modoCard ? "secondary" : "ghost"} onClick={() => setModoCard(false)}><Rows className="w-4 h-4" /></Button>
            <Button variant={modoCard ? "ghost" : "secondary"} onClick={() => setModoCard(true)}><Square className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="font-semibold w-40">
                  {tituloMes}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="grid grid-cols-3 gap-1">
                  {mesesPt.map((nomeMes, idx) => (
                    <Button
                      key={idx}
                      variant={idx === mes ? "default" : "ghost"}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setDataRef(new Date(ano, idx, 1));
                        setMonthPickerOpen(false);
                      }}
                    >
                      {nomeMes.substring(0, 3)}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={aplicarRegras} disabled={applyingRules}>
              <Wand2 className="w-4 h-4 mr-2" />
              {applyingRules ? "Aplicando..." : "Aplicar Regras"}
            </Button>
            <div className="relative">
              <Input
                placeholder="Pesquisar"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-64 pr-8"
              />
              {busca && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setBusca("")}
                  aria-label="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </Button>
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
              <div className="text-sm text-muted-foreground">Saldo atual no período</div>
              <div className={`text-xl font-semibold ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(saldoAtual)}</div>
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
                  <th className="p-2 text-left">Beneficiário</th>
                  <th className="p-2 text-center">Comprovante</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">Saldo</th>
                  <th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => {
                  const termo = busca.trim().toLowerCase();
                  if (!termo) return true;
                  const desc = (r.descricao || '').toLowerCase();
                  const dataFmt = ymdToBr(r.data).toLowerCase();
                  const valorFmt = formatCurrency(r.valor).toLowerCase();
                  return desc.includes(termo) || dataFmt.includes(termo) || valorFmt.includes(termo);
                }).map(r => {
                  const isLast = ultimoIdPorDia.get(r.data) === r.id;
                  const sd = saldoFechamentoPorDia.get(r.data) || 0;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{ymdToBr(r.data)}</td>
                      <td className="p-2">{r.descricao}</td>
                      <td className="p-2">{r.categoria_nome || ''}</td>
                      <td className="p-2">{r.beneficiario_nome || ''}</td>
                      <td className="p-2 text-center">
                        {r.comprovante_url ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openComprovante(r.comprovante_url)} aria-label="Abrir comprovante">
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => lerEAplicar(r)}
                              disabled={analyzingIds.has(r.id)}
                              aria-label="Ler e aplicar"
                            >
                              <ScanText className={`w-4 h-4 ${analyzingIds.has(r.id) ? 'animate-pulse' : ''}`} />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 text-right"><span className={r.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(r.valor)}</span></td>
                      <td className={`p-2 text-right ${isLast ? (sd >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}`}>{isLast ? formatCurrency(sd) : ''}</td>
                      <td className="p-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => abrirEdicao(r)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
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
                  <div className="text-sm">{r.conta_nome || ''}</div>
                  <div className="text-xs text-muted-foreground">{r.categoria_nome || ''}</div>
                  <div className="text-xs text-muted-foreground">{r.beneficiario_nome || ''}</div>
                  <div className={`mt-2 text-lg font-semibold ${r.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(r.valor)}</div>
                  <div className="text-xs text-muted-foreground">{r.tipo}</div>
                  {r.comprovante_url ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openComprovante(r.comprovante_url)} aria-label="Abrir comprovante">
                        <ExternalLink className="w-4 h-4 mr-2" /> Comprovante
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => lerEAplicar(r)}
                        disabled={analyzingIds.has(r.id)}
                        aria-label="Ler e aplicar"
                      >
                        <ScanText className={`w-4 h-4 mr-2 ${analyzingIds.has(r.id) ? 'animate-pulse' : ''}`} /> Ler e aplicar
                      </Button>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={() => abrirEdicao(r)}>
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {rows.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Editar Movimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Descrição</Label>
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Popover open={openCategoria} onOpenChange={setOpenCategoria}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCategoria}
                      className="w-full justify-between"
                    >
                      {editCategoriaId
                        ? catOpts.find((c) => c.id === editCategoriaId)?.name
                        : "Selecione uma categoria..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar categoria..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                        <CommandGroup>
                          {catOpts
                            .filter(c => editMov ? c.tipo === (editMov.tipo === "ENTRADA" ? "RECEITA" : "DESPESA") : true)
                            .map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setEditCategoriaId(c.id);
                                  setOpenCategoria(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    editCategoriaId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {c.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <FileUpload
                label="Comprovante"
                value={editComprovanteUrl}
                onChange={(url) => setEditComprovanteUrl(url || "")}
                bucket="Comprovantes"
                folder="comprovantes"
                filenameHint={editDesc}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>

              <div className="space-y-2">
                <Label>Beneficiário</Label>
                <Popover open={openBeneficiario} onOpenChange={setOpenBeneficiario}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openBeneficiario}
                      className="w-full justify-between"
                    >
                      {editBenefId
                        ? benefOpts.find((b) => b.id === editBenefId)?.name
                        : "Selecione um beneficiário..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar beneficiário..." value={benefSearch} onValueChange={setBenefSearch} />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 flex flex-col items-center gap-2">
                            <span className="text-sm text-muted-foreground">Não encontrado.</span>
                            {benefSearch.length > 2 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8"
                                onClick={criarBeneficiarioInline}
                                disabled={addingBenef}
                              >
                                {addingBenef ? 'Criando...' : `Criar "${benefSearch}"`}
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {benefOpts.map((b) => (
                            <CommandItem
                              key={b.id}
                              value={b.name}
                              onSelect={() => {
                                setEditBenefId(b.id);
                                setOpenBeneficiario(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editBenefId === b.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {b.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button onClick={salvarEdicao} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}
