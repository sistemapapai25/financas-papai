import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, ChevronLeft, ChevronRight, Filter, Rows, Square, Edit3, Search, X, Wand2, FileText, ExternalLink, ScanText, Receipt, MoreVertical, Plus, CircleHelp } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
  user_id: string | null;
  data: string;
  descricao: string | null;
  conta_id: string | null;
  conta_nome?: string | null;
  conta_logo?: string | null;
  categoria_id?: string | null;
  beneficiario_id?: string | null;
  categoria_nome?: string | null;
  beneficiario_nome?: string | null;
  beneficiario_documento?: string | null;
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  origem?: "LANCAMENTO" | "CULTO" | "AJUSTE" | null;
  comprovante_url?: string | null;
  regras_aplicadas_em?: string | null;
  descricao_ajustada_em?: string | null;
};

const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function LancamentosDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [dataRef, setDataRef] = useState(() => new Date());
  const [contas, setContas] = useState<{ id: string; user_id?: string | null; nome: string; logo?: string | null; saldo_inicial?: number; saldo_inicial_em?: string | null }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [modoCard, setModoCard] = useState(false);
  const [rows, setRows] = useState<Mov[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editMov, setEditMov] = useState<Mov | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editValor, setEditValor] = useState<string>("");
  const [editContaId, setEditContaId] = useState<string>("");
  const [editData, setEditData] = useState("");
  const [editCategoriaId, setEditCategoriaId] = useState<string>("");
  const [editBenefId, setEditBenefId] = useState<string>("");
  const [editComprovanteUrl, setEditComprovanteUrl] = useState<string>("");
  const [editComprovanteUploading, setEditComprovanteUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [tipoMenuOpen, setTipoMenuOpen] = useState(false);
  const [tipoVisao, setTipoVisao] = useState<'TODOS' | 'DESPESAS' | 'RECEITAS' | 'TRANSFERENCIAS'>('TODOS');
  const [church, setChurch] = useState<{ igreja_nome: string; igreja_cnpj: string; responsavel_nome: string; responsavel_cpf: string; assinatura_path: string | null } | null>(null);
  const [bulkAdjusting, setBulkAdjusting] = useState(false);
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboUrl, setReciboUrl] = useState<string | null>(null);
  const [reciboBlob, setReciboBlob] = useState<Blob | null>(null);
  const [reciboMovId, setReciboMovId] = useState<string | null>(null);
  const [reciboLoading, setReciboLoading] = useState(false);
  const [addingComprovante, setAddingComprovante] = useState(false);
  const [docType, setDocType] = useState<'RECIBO' | 'REEMBOLSO'>('RECIBO');
  const [reciboSeqByMov, setReciboSeqByMov] = useState<Map<string, { numero: number; ano: number }>>(new Map());
  const [reembBenefIdMov, setReembBenefIdMov] = useState<string | null>(null);
  const [reembBenefNameMov, setReembBenefNameMov] = useState<string | null>(null);
  const [reembBenefDocMov, setReembBenefDocMov] = useState<string | null>(null);
  const [reembBenefAssUrlMov, setReembBenefAssUrlMov] = useState<string | null>(null);
  const [openBenefReembMov, setOpenBenefReembMov] = useState(false);
  const [rbSearchMov, setRbSearchMov] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcStored, setCalcStored] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<"+" | "-" | "*" | "/" | null>(null);
  const [calcOverwrite, setCalcOverwrite] = useState(true);
  const [extratoPdfOpen, setExtratoPdfOpen] = useState(false);
  const [extratoPdfBusy, setExtratoPdfBusy] = useState(false);
  const [extratoPdfExists, setExtratoPdfExists] = useState(false);
  const [extratoPdfUrl, setExtratoPdfUrl] = useState<string | null>(null);
  const [extratoPdfFoundPath, setExtratoPdfFoundPath] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoData, setNovoData] = useState<string>("");
  const [novoContaId, setNovoContaId] = useState<string>("");
  const [novoTipo, setNovoTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [novoValor, setNovoValor] = useState<string>("");
  const [novoDescricao, setNovoDescricao] = useState<string>("");
  const [novoCategoriaId, setNovoCategoriaId] = useState<string>("");
  const [novoBenefId, setNovoBenefId] = useState<string>("");
  const [novoSalvando, setNovoSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (showReciboModal && (docType === 'REEMBOLSO' || docType === 'RECIBO') && benefOpts.length === 0) {
      let q = supabase
        .from('beneficiaries')
        .select('id,name')
        .order('name');
      if (!isAdmin) {
        q = q.eq('user_id', user.id);
      }
      q.then(({ data }) => {
        if (data) setBenefOpts(data);
      });
    }
  }, [showReciboModal, docType, user, isAdmin, benefOpts.length]);
  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const toYmdNoPad = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const inicioDate = new Date(ano, mes, 1);
  const fimDate = new Date(ano, mes + 1, 0);
  const fimExclusivoDate = new Date(ano, mes + 1, 1);
  const inicio = toYmd(inicioDate);
  const fim = toYmd(fimDate);
  const fimExclusivo = toYmd(fimExclusivoDate);
  const inicioNoPad = toYmdNoPad(inicioDate);
  const fimExclusivoNoPad = toYmdNoPad(fimExclusivoDate);
  const filtroPeriodoMovimentos = `and(data.gte.${inicio},data.lt.${fimExclusivo}),and(data.gte.${inicioNoPad},data.lt.${fimExclusivoNoPad})`;

  const contaExtrato = useMemo(() => {
    if (contasSel.length !== 1) return null;
    return contas.find(c => c.id === contasSel[0]) || null;
  }, [contas, contasSel]);

  const extratoPdfName = useMemo(() => `${ano}-${String(mes + 1).padStart(2, "0")}.pdf`, [ano, mes]);
  const extratoPdfFolder = useMemo(() => {
    if (!user || !contaExtrato) return null;
    const ownerUserId = contaExtrato.user_id || user.id;
    return `extratos_bancarios/${ownerUserId}/${contaExtrato.id}`;
  }, [user, contaExtrato]);
  const extratoPdfPath = useMemo(() => {
    if (!extratoPdfFolder) return null;
    return `${extratoPdfFolder}/${extratoPdfName}`;
  }, [extratoPdfFolder, extratoPdfName]);
  const extratoPdfFolders = useMemo(() => {
    if (!user || !contaExtrato) return [];
    return Array.from(new Set([
      contaExtrato.user_id ? `extratos_bancarios/${contaExtrato.user_id}/${contaExtrato.id}` : null,
      `extratos_bancarios/${user.id}/${contaExtrato.id}`,
    ].filter(Boolean) as string[]));
  }, [user, contaExtrato]);

  async function refreshExtratoPdfExists() {
    if (!user) return;
    if (extratoPdfFolders.length === 0) { setExtratoPdfExists(false); setExtratoPdfFoundPath(null); return; }
    setExtratoPdfBusy(true);
    try {
      for (const folder of extratoPdfFolders) {
        const { data, error } = await supabase.storage.from("Comprovantes").list(folder, { limit: 200 });
        if (error) throw error;
        const ok = (data || []).some(f => f.name === extratoPdfName);
        if (ok) {
          setExtratoPdfExists(true);
          setExtratoPdfFoundPath(`${folder}/${extratoPdfName}`);
          return;
        }
      }
      setExtratoPdfExists(false);
      setExtratoPdfFoundPath(null);
    } catch {
      setExtratoPdfExists(false);
      setExtratoPdfFoundPath(null);
    } finally {
      setExtratoPdfBusy(false);
    }
  }

  async function abrirExtratoPdf() {
    if (!user) return;
    if (!contaExtrato || !extratoPdfPath) {
      toast({ title: "Extrato PDF", description: "Selecione uma conta (não 'Todas') para abrir o PDF.", variant: "destructive" });
      return;
    }
    setExtratoPdfBusy(true);
    try {
      const { data, error } = await supabase.storage.from("Comprovantes").createSignedUrl(extratoPdfFoundPath || extratoPdfPath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      else throw new Error("Não foi possível gerar link do PDF");
    } catch (e: unknown) {
      toast({ title: "Extrato PDF", description: e instanceof Error ? e.message : "Falha ao abrir PDF", variant: "destructive" });
    } finally {
      setExtratoPdfBusy(false);
    }
  }

  async function uploadExtratoPdf(file: File) {
    if (!user) return;
    if (!contaExtrato || !extratoPdfPath) {
      toast({ title: "Extrato PDF", description: "Selecione uma conta (não 'Todas') para enviar o PDF.", variant: "destructive" });
      return;
    }
    if (!file || (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf")) {
      toast({ title: "Extrato PDF", description: "Selecione um arquivo PDF.", variant: "destructive" });
      return;
    }
    setExtratoPdfBusy(true);
    try {
      const { error } = await supabase.storage.from("Comprovantes").upload(extratoPdfPath, file, { upsert: true, cacheControl: "3600", contentType: "application/pdf" });
      if (error) throw error;
      setExtratoPdfExists(true);
      setExtratoPdfFoundPath(extratoPdfPath);
      toast({ title: "Extrato PDF", description: "PDF enviado com sucesso." });
    } catch (e: unknown) {
      toast({ title: "Extrato PDF", description: e instanceof Error ? e.message : "Falha ao enviar PDF", variant: "destructive" });
    } finally {
      setExtratoPdfBusy(false);
    }
  }

  async function removerExtratoPdf() {
    if (!user) return;
    if (!contaExtrato || !extratoPdfPath) return;
    const pathToRemove = extratoPdfFoundPath || extratoPdfPath;
    setExtratoPdfBusy(true);
    try {
      const { error } = await supabase.storage.from("Comprovantes").remove([pathToRemove]);
      if (error) throw error;
      setExtratoPdfExists(false);
      setExtratoPdfFoundPath(null);
      setExtratoPdfUrl(null);
      toast({ title: "Extrato PDF", description: "PDF removido." });
    } catch (e: unknown) {
      toast({ title: "Extrato PDF", description: e instanceof Error ? e.message : "Falha ao remover PDF", variant: "destructive" });
    } finally {
      setExtratoPdfBusy(false);
    }
  }

  async function carregarExtratoPdfUrl() {
    if (!user) return;
    if (!contaExtrato || !extratoPdfPath) { setExtratoPdfUrl(null); return; }
    setExtratoPdfBusy(true);
    try {
      const { data, error } = await supabase.storage.from("Comprovantes").createSignedUrl(extratoPdfFoundPath || extratoPdfPath, 3600);
      if (error) throw error;
      setExtratoPdfUrl(data?.signedUrl ?? null);
    } catch {
      setExtratoPdfUrl(null);
    } finally {
      setExtratoPdfBusy(false);
    }
  }

  useEffect(() => {
    refreshExtratoPdfExists();
    setExtratoPdfUrl(null);
  }, [user, extratoPdfFolder, extratoPdfName]);

  useEffect(() => {
    if (!extratoPdfOpen) return;
    refreshExtratoPdfExists().then(() => carregarExtratoPdfUrl());
  }, [extratoPdfOpen, extratoPdfPath]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("contas_financeiras")
      .select("id,user_id,nome,logo,saldo_inicial,saldo_inicial_em")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        const arr = (data || []).map((c: { id: string; user_id?: string | null; nome: string; logo?: string | null; saldo_inicial?: number; saldo_inicial_em?: string | null }) => ({ id: c.id, user_id: c.user_id ?? null, nome: c.nome, logo: c.logo ?? null, saldo_inicial: Number(c.saldo_inicial || 0), saldo_inicial_em: c.saldo_inicial_em ?? null }));
        setContas(arr);

        // Ensure "Transferência Interna" categories exist
        ensureTransferCategories();
      });
    supabase
      .from('church_settings')
      .select('igreja_nome, igreja_cnpj, responsavel_nome, responsavel_cpf, assinatura_path')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setChurch({ igreja_nome: data.igreja_nome, igreja_cnpj: data.igreja_cnpj, responsavel_nome: data.responsavel_nome, responsavel_cpf: data.responsavel_cpf, assinatura_path: data.assinatura_path ?? null });
      });
  }, [user]);

  async function ajustarDescricoesLote() {
    try {
      if (!user) { toast({ title: 'Sessão', description: 'Faça login para ajustar descrições', variant: 'destructive' }); return; }
      const rowsDoPeriodoConta = rows.filter((r) => (
        contasSel.length === 0 || (r.conta_id ? contasSel.includes(r.conta_id) : false)
      ));
      const rowsComRegrasAplicadas = rowsDoPeriodoConta.filter((r) => r.regras_aplicadas_em);
      if (rowsComRegrasAplicadas.length === 0) {
        toast({
          title: 'Atenção',
          description: 'Nenhum lançamento do mês/conta selecionado recebeu aplicação de regras. Clique em Aplicar Regras primeiro.',
          variant: 'destructive',
        });
        return;
      }
      setBulkAdjusting(true);
      let ok = 0, skip = 0, fail = 0;
      const semRegras = rowsDoPeriodoConta.length - rowsComRegrasAplicadas.length;
      const jaAjustados = rowsComRegrasAplicadas.filter((r) => r.descricao_ajustada_em).length;
      const rowsParaAjustar = rowsComRegrasAplicadas.filter((r) => !r.descricao_ajustada_em);
      if (rowsParaAjustar.length === 0) {
        toast({
          title: 'Ajuste de descrições',
          description: 'Todos os lançamentos visíveis com regras aplicadas já tiveram a descrição ajustada.',
        });
        return;
      }
      const descricaoAjustadaEm = new Date().toISOString();
      const updates: { id: string; desc: string }[] = [];
      for (const r of rowsParaAjustar) {
        const categoria = (r.categoria_nome || '').trim();
        if (!categoria) { skip++; continue; }
        const nova = `Valor referente a ${categoria}`;
        const payload = (r.descricao || '').trim() === nova
          ? { descricao_ajustada_em: descricaoAjustadaEm }
          : { descricao: nova, descricao_ajustada_em: descricaoAjustadaEm };
        let updateQuery = supabase
          .from('movimentos_financeiros')
          .update(payload)
          .eq('id', r.id)
          .is('descricao_ajustada_em', null);
        updateQuery = updateQuery.eq('user_id', isAdmin ? (r.user_id || user.id) : user.id);
        const { data: updatedRows, error } = await updateQuery.select('id');
        if (error) { fail++; continue; }
        if (!updatedRows || updatedRows.length === 0) { skip++; continue; }
        ok++;
        updates.push({ id: r.id, desc: nova });
      }
      if (updates.length > 0) {
        setRows(prev => prev.map(p => {
          const u = updates.find(u => u.id === p.id);
          return u ? { ...p, descricao: u.desc, descricao_ajustada_em: descricaoAjustadaEm } : p;
        }));
      }
      toast({ title: 'Ajuste de descrições', description: `Atualizados: ${ok}. Ignorados: ${skip}. Já ajustados: ${jaAjustados}. Sem regras aplicadas: ${semRegras}. Falhas: ${fail}.` });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao ajustar descrições', variant: 'destructive' });
    } finally {
      setBulkAdjusting(false);
    }
  }

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const calcReset = () => {
    setCalcDisplay("0");
    setCalcStored(null);
    setCalcOp(null);
    setCalcOverwrite(true);
  };

  const calcParseDisplay = () => {
    const n = Number(calcDisplay);
    return Number.isFinite(n) ? n : 0;
  };

  const calcSetDisplayFromNumber = (n: number) => {
    if (!Number.isFinite(n)) {
      setCalcDisplay("Erro");
      setCalcStored(null);
      setCalcOp(null);
      setCalcOverwrite(true);
      return;
    }
    if (Object.is(n, -0)) n = 0;
    setCalcDisplay(String(n));
    setCalcOverwrite(true);
  };

  const calcCompute = (a: number, b: number, op: "+" | "-" | "*" | "/") => {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b === 0 ? Number.NaN : a / b;
    return Number.NaN;
  };

  const calcPressDigit = (d: string) => {
    if (calcDisplay === "Erro") calcReset();
    setCalcDisplay((prev) => {
      if (calcOverwrite) {
        setCalcOverwrite(false);
        return d;
      }
      if (prev === "0") return d;
      return prev + d;
    });
  };

  const calcPressDecimal = () => {
    if (calcDisplay === "Erro") calcReset();
    setCalcDisplay((prev) => {
      if (calcOverwrite) {
        setCalcOverwrite(false);
        return "0.";
      }
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  };

  const calcBackspace = () => {
    if (calcDisplay === "Erro") {
      calcReset();
      return;
    }
    setCalcDisplay((prev) => {
      if (calcOverwrite) return prev;
      if (prev.length <= 1) {
        setCalcOverwrite(true);
        return "0";
      }
      const next = prev.slice(0, -1);
      if (next === "-" || next === "") {
        setCalcOverwrite(true);
        return "0";
      }
      return next;
    });
  };

  const calcToggleSign = () => {
    if (calcDisplay === "Erro") {
      calcReset();
      return;
    }
    setCalcDisplay((prev) => {
      if (prev === "0") return prev;
      if (prev.startsWith("-")) return prev.slice(1);
      return "-" + prev;
    });
  };

  const calcPressOp = (op: "+" | "-" | "*" | "/") => {
    if (calcDisplay === "Erro") return;
    const current = calcParseDisplay();
    if (calcStored === null || calcOp === null) {
      setCalcStored(current);
      setCalcOp(op);
      setCalcOverwrite(true);
      return;
    }
    if (calcOverwrite) {
      setCalcOp(op);
      return;
    }
    const next = calcCompute(calcStored, current, calcOp);
    setCalcStored(next);
    setCalcOp(op);
    calcSetDisplayFromNumber(next);
  };

  const calcPressEquals = () => {
    if (calcDisplay === "Erro") return;
    if (calcStored === null || calcOp === null) return;
    if (calcOverwrite) return;
    const current = calcParseDisplay();
    const next = calcCompute(calcStored, current, calcOp);
    setCalcStored(null);
    setCalcOp(null);
    calcSetDisplayFromNumber(next);
  };

  const onCalcKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k >= "0" && k <= "9") {
      e.preventDefault();
      calcPressDigit(k);
      return;
    }
    if (k === "." || k === ",") {
      e.preventDefault();
      calcPressDecimal();
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      calcBackspace();
      return;
    }
    if (k === "Escape") {
      setCalcOpen(false);
      return;
    }
    if (k === "Enter" || k === "=") {
      e.preventDefault();
      calcPressEquals();
      return;
    }
    if (k === "+") {
      e.preventDefault();
      calcPressOp("+");
      return;
    }
    if (k === "-") {
      e.preventDefault();
      calcPressOp("-");
      return;
    }
    if (k === "*" || k === "x" || k === "X") {
      e.preventDefault();
      calcPressOp("*");
      return;
    }
    if (k === "/") {
      e.preventDefault();
      calcPressOp("/");
      return;
    }
  };

  const ensureTransferCategories = async () => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name, tipo')
      .eq('user_id', user.id)
      .eq('name', 'Transferência Interna');
    if (!existing || existing.length === 0) {
      await supabase.from('categories').insert({ user_id: user.id, name: 'Transferência Interna', tipo: 'TRANSFERENCIA', parent_id: null });
    } else {
      const cat = existing[0];
      if (cat.tipo !== 'TRANSFERENCIA') {
        await supabase.from('categories').update({ tipo: 'TRANSFERENCIA', parent_id: null }).eq('id', cat.id);
      }
    }
  };

  useEffect(() => {
    if (!supabase || !user || roleLoading) return;
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("movimentos_financeiros")
        .select("id, user_id, data, descricao, valor, tipo, origem, conta_id, categoria_id, beneficiario_id, comprovante_url, regras_aplicadas_em, descricao_ajustada_em, contas:contas_financeiras(nome,logo), categoria:categories(name), beneficiario:beneficiaries(name,documento)")
        .or(filtroPeriodoMovimentos)
        .order("data");
      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      }
      if (contasSel.length > 0) {
        q = q.in("conta_id", contasSel);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      const arr: Mov[] = (data || []).map((r) => ({
        id: r.id,
        user_id: r.user_id ?? null,
        data: r.data,
        descricao: r.descricao ?? null,
        conta_id: r.conta_id ?? null,
        conta_nome: r.contas?.nome ?? null,
        conta_logo: r.contas?.logo ?? null,
        categoria_id: r.categoria_id ?? null,
        beneficiario_id: r.beneficiario_id ?? null,
        categoria_nome: r.categoria?.name ?? null,
        beneficiario_nome: r.beneficiario?.name ?? null,
        beneficiario_documento: r.beneficiario?.documento ?? null,
        tipo: r.tipo as Mov["tipo"],
        valor: r.valor,
        origem: (r.origem as Mov["origem"]) ?? null,
        comprovante_url: r.comprovante_url ?? null,
        regras_aplicadas_em: r.regras_aplicadas_em ?? null,
        descricao_ajustada_em: r.descricao_ajustada_em ?? null,
      }));
      setRows(arr);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, inicio, fimExclusivo, contasSel, toast, isAdmin, roleLoading, reloadKey]);

  useEffect(() => {
    if (!supabase || !user || roleLoading) return;
    let cancelled = false;
    (async () => {
      const contasConsideradas = contasSel.length ? contas.filter(c => contasSel.includes(c.id)) : contas;
      // Base = saldo_inicial das contas cuja âncora não é posterior ao período.
      const baseInicial = contasConsideradas.reduce((s, c) => {
        const anchor = c.saldo_inicial_em ?? null;
        if (anchor && anchor > inicio) return s;
        return s + Number(c.saldo_inicial || 0);
      }, 0);
      // Delta de movimentos anteriores: 1 RPC por conta (sem limite de 1000 linhas).
      const promises = contasConsideradas.map((c) =>
        supabase.rpc("saldo_conta_ate", { p_conta_id: c.id, p_data: inicio }),
      );
      const results = await Promise.all(promises);
      if (cancelled) return;
      let net = 0;
      for (const r of results) {
        if (r.error) {
          toast({ title: "Erro", description: r.error.message, variant: "destructive" });
          return;
        }
        net += Number(r.data ?? 0);
      }
      setSaldoInicial(baseInicial + net);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, inicio, contasSel, contas, toast, isAdmin, roleLoading]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  function onlyDigits(s: string | null | undefined) { return String(s ?? '').replace(/\D+/g, ''); }
  function normalizeSearchText(s: string | null | undefined) {
    return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function formatCPF(s: string | null | undefined) {
    const d = onlyDigits(s).slice(0, 11);
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '-' + p4;
    return out;
  }
  function formatCNPJ(s: string | null | undefined) {
    const d = onlyDigits(s).slice(0, 14);
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 5);
    const p3 = d.slice(5, 8);
    const p4 = d.slice(8, 12);
    const p5 = d.slice(12, 14);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '/' + p4;
    if (p5) out += '-' + p5;
    return out;
  }

  async function gerarReciboMov(m: Mov, beneficiarioIdOverride?: string, beneficiarioDocOverride?: string | null, beneficiarioNameOverride?: string | null) {
    try {
      if (!user) { toast({ title: 'Sessão', description: 'Faça login para emitir recibo', variant: 'destructive' }); return; }
      if (m.tipo !== 'SAIDA') { toast({ title: 'Recibo', description: 'Recibo é emitido para saídas (despesas).' }); return; }
      if (!church) { toast({ title: 'Configuração da Igreja', description: 'Preencha os dados em Configurações > Igreja', variant: 'destructive' }); return; }
      setDocType('RECIBO');
      setReciboUrl(null);
      setShowReciboModal(true);
      setReciboMovId(m.id);
      const reciboBenefId = beneficiarioIdOverride || m.beneficiario_id || null;
      if (!reciboBenefId) {
        setReembBenefIdMov(null);
        setReembBenefNameMov(null);
        setReembBenefDocMov(null);
        setReembBenefAssUrlMov(null);
        setReciboBlob(null);
        setReciboLoading(false);
        return;
      }
      setReembBenefIdMov(reciboBenefId);
      setReciboLoading(true);
      const ano = new Date().getFullYear();
      const { data: nextNumRes, error: nextErr } = await supabase.rpc('next_recibo_num', { _user_id: user.id, _ano: ano });
      if (nextErr) throw nextErr;
      const numero = Number(nextNumRes);
      const numeroFmt = String(numero).padStart(6, '0');
      setReciboSeqByMov(prev => {
        const n = new Map(prev);
        n.set(m.id, { numero, ano });
        return n;
      });
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 420.94]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const drawText = (text: string, x: number, y: number, size = 12, bold = false) => {
        page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      };
      const center = (text: string, y: number, size = 12, bold = false) => {
        const w = (bold ? fontBold : font).widthOfTextAtSize(text, size);
        const x = (width - w) / 2;
        drawText(text, x, y, size, bold);
      };
      const MARGIN_L = 60;
      const MARGIN_R = 60;
      const CONTENT_W = width - MARGIN_L - MARGIN_R;
      function wrapByWidth(s: string, size = 12) {
        const words = s.split(/\s+/);
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? cur + " " + w : w;
          const wpx = font.widthOfTextAtSize(test, size);
          if (wpx <= CONTENT_W) {
            cur = test;
          } else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      }
      let yHeader = height - 40;
      center(church.igreja_nome, yHeader, 16, true);
      yHeader -= 22;
      center(`CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, yHeader, 12);
      yHeader -= 26;
      center(`RECIBO Nº ${numeroFmt}/${ano}`, yHeader, 14, true);
      const valor = Number(m.valor || 0);
      const dataStr = ymdToBr(m.data);
      const desc = String(m.descricao || '').trim() || 'Movimento Financeiro';
      const corpo = `Recebi da Igreja ${church.igreja_nome} a quantia de ${formatCurrency(valor)}, "${desc}" na data ${dataStr}.`;
      let y = yHeader - 40;
      for (const line of wrapByWidth(corpo, 12)) { drawText(line, MARGIN_L, y, 12, false); y -= 18; }
      if (reciboBenefId) {
        const { data: ben } = await supabase
          .from('beneficiaries')
          .select('name,documento,assinatura_path,user_id')
          .eq('id', reciboBenefId)
          .maybeSingle();
        const signerName = ben?.name || beneficiarioNameOverride || reembBenefNameMov || benefOpts.find(b => b.id === reciboBenefId)?.name || null;
        const signerDoc = ben?.documento || beneficiarioDocOverride || reembBenefDocMov || m.beneficiario_documento || null;
        setReembBenefIdMov(reciboBenefId);
        setReembBenefNameMov(signerName);
        setReembBenefDocMov(signerDoc);
        let assinaturaImgBytes: ArrayBuffer | null = null;
        const signerPaths: string[] = [];
        if (ben?.assinatura_path) signerPaths.push(ben.assinatura_path);
        if (user) {
          const folders = Array.from(new Set([
            `assinaturas/${user.id}/beneficiarios`,
            ben?.user_id ? `assinaturas/${ben.user_id}/beneficiarios` : null,
          ].filter(Boolean) as string[]));
          for (const folder of folders) {
            const { data: files } = await supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
            const match = (files || []).find(f => f.name.startsWith(`${reciboBenefId}-`));
            if (match) {
              signerPaths.push(`${folder}/${match.name}`);
            }
          }
        }
        for (const signerPath of Array.from(new Set(signerPaths))) {
          try {
            const { data: signedAss } = await supabase.storage.from('Assinaturas').createSignedUrl(signerPath, 300);
            if (!signedAss?.signedUrl) continue;
            const resp = await fetch(signedAss.signedUrl);
            if (!resp.ok) continue;
            assinaturaImgBytes = await resp.arrayBuffer();
            break;
          } catch {
            continue;
          }
        }
        if (assinaturaImgBytes) {
          let img;
          try { img = await pdfDoc.embedPng(assinaturaImgBytes); }
          catch { img = await pdfDoc.embedJpg(assinaturaImgBytes); }
          const maxSigW = Math.min(180, width - MARGIN_L - MARGIN_R);
          const maxSigH = 70;
          const scale = Math.min(maxSigW / img.width, maxSigH / img.height);
          const sigW = img.width * scale;
          const sigH = img.height * scale;
          const sigX = (width - sigW) / 2;
          const sigY = Math.max(110, y - sigH - 8);
          page.drawImage(img, { x: sigX, y: sigY, width: sigW, height: sigH });
          y = sigY;
        }
        if (signerName) {
          center(signerName, y - 24, 12, true);
          y -= 24;
        }
        if (signerDoc) {
          const d = onlyDigits(signerDoc);
          const docFmt = d.length >= 14 ? formatCNPJ(signerDoc) : formatCPF(signerDoc);
          center(`CPF/CNPJ: ${docFmt}`, y - 18, 12, false);
          y -= 18;
        }
      }
      const pdfBytes = await pdfDoc.save();
      const ab = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(ab).set(pdfBytes);
      const pdfBlob = new Blob([ab], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setReciboBlob(pdfBlob);
      setReciboUrl(url);
    } catch (e: unknown) {
      toast({ title: 'Erro ao gerar recibo', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setReciboLoading(false);
    }
  }

  async function gerarReembolsoMov(m: Mov) {
    try {
      if (!user) { toast({ title: 'Sessão', description: 'Faça login para emitir reembolso', variant: 'destructive' }); return; }
      if (m.tipo !== 'SAIDA') { toast({ title: 'Reembolso', description: 'Reembolso é emitido para saídas (despesas).' }); return; }
      if (!church) { toast({ title: 'Configuração da Igreja', description: 'Preencha os dados em Configurações > Igreja', variant: 'destructive' }); return; }
      setShowReciboModal(true);
      setDocType('REEMBOLSO');
      setReciboUrl(null);
      setReciboMovId(m.id);
      setReembBenefIdMov(null);
    } catch (e: unknown) {
      toast({ title: 'Erro ao preparar reembolso', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    }
  }

  async function gerarReembolsoMovPdf(m: Mov) {
    try {
      if (!user || !church) return;
      setReciboLoading(true);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 420.94]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const drawText = (text: string, x: number, y: number, size = 12, bold = false) => { page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) }); };
      const center = (text: string, y: number, size = 12, bold = false) => { const w = (bold ? fontBold : font).widthOfTextAtSize(text, size); const x = (width - w) / 2; drawText(text, x, y, size, bold); };
      const MARGIN_L = 60; const MARGIN_R = 60; const CONTENT_W = width - MARGIN_L - MARGIN_R;
      function wrapByWidth(s: string, size = 12) { const words = s.split(/\s+/); const lines: string[] = []; let cur = ""; for (const w of words) { const test = cur ? cur + " " + w : w; const wpx = font.widthOfTextAtSize(test, size); if (wpx <= CONTENT_W) { cur = test; } else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur); return lines; }
      let yHeader = height - 40;
      center(church.igreja_nome, yHeader, 16, true);
      yHeader -= 22;
      center(`CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, yHeader, 12);
      yHeader -= 26;
      let numero: number | null = null; let ano = new Date().getFullYear();
      const seq = reciboSeqByMov.get(m.id) || null;
      if (seq) { numero = seq.numero; ano = seq.ano; }
      else {
        const { data: nextNumRes, error: nextErr } = await supabase.rpc('next_recibo_num', { _user_id: user.id, _ano: ano });
        if (nextErr) throw nextErr;
        numero = Number(nextNumRes);
        setReciboSeqByMov(prev => { const n = new Map(prev); n.set(m.id, { numero: numero!, ano }); return n; });
      }
      const numeroFmt = String(numero!).padStart(6, '0');
      center(`REEMBOLSO Nº ${numeroFmt}/${ano}`, yHeader, 14, true);
      const valor = Number(m.valor || 0);
      const dataStr = ymdToBr(m.data);
      const desc = String(m.descricao || '').trim() || 'Movimento Financeiro';
      const corpo = `Recebi da Igreja ${church.igreja_nome} a reembolso no valor de ${formatCurrency(valor)}, ${desc} na data ${dataStr}.`;
      let y = yHeader - 40; for (const line of wrapByWidth(corpo, 12)) { drawText(line, MARGIN_L, y, 12, false); y -= 18; }
      let assinaturaImgBytes: Uint8Array | null = null;
      let signerName: string | null = null;
      let signerDoc: string | null = null;
      const benefId = reembBenefIdMov || m.beneficiario_id || null;
      if (benefId) {
        // Preferir dados já carregados via seleção no modal
        signerName = reembBenefNameMov || null;
        signerDoc = reembBenefDocMov || null;
        if (!signerName || !signerDoc) {
          const { data: ben } = await supabase
            .from('beneficiaries')
            .select('name,documento')
            .eq('id', benefId)
            .maybeSingle();
          signerName = signerName || ben?.name || null;
          signerDoc = signerDoc || ben?.documento || null;
        }
        // Assinatura: usa URL já obtida no modal se houver; senão busca no bucket
        if (reembBenefAssUrlMov) {
          const resp = await fetch(reembBenefAssUrlMov);
          if (resp.ok) assinaturaImgBytes = new Uint8Array(await resp.arrayBuffer());
        } else if (user) {
          const folder = `assinaturas/${user.id}/beneficiarios`;
          const { data: files } = await supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
          const match = (files || []).find(f => f.name.startsWith(`${benefId}-`));
          if (match) {
            const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(`${folder}/${match.name}`, 300);
            if (signed?.signedUrl) {
              const resp = await fetch(signed.signedUrl);
              if (resp.ok) assinaturaImgBytes = new Uint8Array(await resp.arrayBuffer());
            }
          }
        }
      }
      if (!assinaturaImgBytes && church.assinatura_path) {
        const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(church.assinatura_path, 300);
        if (signed?.signedUrl) { const resp = await fetch(signed.signedUrl); if (resp.ok) assinaturaImgBytes = new Uint8Array(await resp.arrayBuffer()); }
      }
      if (assinaturaImgBytes) { try { const img = await pdfDoc.embedPng(assinaturaImgBytes).catch(async () => pdfDoc.embedJpg(assinaturaImgBytes!)); const imgW = 200; const scale = imgW / img.width; const imgH = img.height * scale; page.drawImage(img, { x: (width - imgW) / 2, y: y - 20 - imgH, width: imgW, height: imgH }); y = y - 20 - imgH; } catch { void 0; } }
      if (signerName) { center(signerName, y - 24, 12, true); y -= 24; }
      if (signerDoc) {
        const d = String(signerDoc || '').replace(/\D+/g, '');
        const docFmt = d.length >= 14 ? formatCNPJ(signerDoc) : formatCPF(signerDoc);
        center(`CPF/CNPJ: ${docFmt}`, y - 18, 12, false); y -= 18;
      }
      if (!signerName) { center(church.responsavel_nome, y - 24, 12, true); y -= 24; center(`CPF: ${formatCPF(church.responsavel_cpf)}`, y - 18, 12, false); y -= 18; }
      const pdfBytes = await pdfDoc.save();
      const ab = new ArrayBuffer(pdfBytes.byteLength); new Uint8Array(ab).set(pdfBytes);
      const pdfBlob = new Blob([ab], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setReciboBlob(pdfBlob);
      setReciboUrl(url);
    } catch (e: unknown) {
      toast({ title: 'Erro ao gerar reembolso', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally { setReciboLoading(false); }
  }

  async function selecionarBeneficiarioReembolsoMov(id: string, m?: Mov) {
    try {
      setReembBenefIdMov(id);
      const name = benefOpts.find(b => b.id === id)?.name || null;
      setReembBenefNameMov(name);
      let doc: string | null = null;
      const { data: ben } = await supabase.from('beneficiaries').select('documento').eq('id', id).maybeSingle();
      if (ben?.documento) doc = ben.documento;
      setReembBenefDocMov(doc);
      let assUrl: string | null = null;
      if (user) {
        const folder = `assinaturas/${user.id}/beneficiarios`;
        const { data: files } = await supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
        const match = (files || []).find(f => f.name.startsWith(`${id}-`));
        if (match) {
          const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(`${folder}/${match.name}`, 300);
          if (signed?.signedUrl) assUrl = signed.signedUrl;
        }
      }
      setReembBenefAssUrlMov(assUrl);
      if (m) {
        if (docType === 'RECIBO') await gerarReciboMov(m, id, doc, name);
        else await gerarReembolsoMovPdf(m);
      } else if (reciboMovId) {
        const mov = rows.find(r => r.id === reciboMovId);
        if (mov) {
          if (docType === 'RECIBO') await gerarReciboMov(mov, id, doc, name);
          else await gerarReembolsoMovPdf(mov);
        }
      }
    } catch {
      if (m) {
        if (docType === 'RECIBO') await gerarReciboMov(m, id, doc, name);
        else await gerarReembolsoMovPdf(m);
      }
    }
  }
  const rowsView = useMemo(() => {
    if (tipoVisao === 'DESPESAS') return rows.filter(r => r.categoria_nome !== 'Transferência Interna' && r.tipo === 'SAIDA');
    if (tipoVisao === 'RECEITAS') return rows.filter(r => r.categoria_nome !== 'Transferência Interna' && r.tipo === 'ENTRADA');
    if (tipoVisao === 'TRANSFERENCIAS') return rows.filter(r => r.categoria_nome === 'Transferência Interna');
    return rows;
  }, [rows, tipoVisao]);

  const rowsResumo = useMemo(() => {
    const incluirTransferenciasNoResumo = tipoVisao === 'TODOS' && contasSel.length === 1;
    if (tipoVisao === 'TRANSFERENCIAS') return rowsView;
    if (incluirTransferenciasNoResumo) return rowsView;
    return rowsView.filter(r => r.categoria_nome !== 'Transferência Interna');
  }, [rowsView, tipoVisao, contasSel.length]);

  const saldoAtual = useMemo(() => {
    return rows.reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : -r.valor), 0);
  }, [rows]);

  const totalEntradas = useMemo(() => {
    return rowsResumo.reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : 0), 0);
  }, [rowsResumo]);

  const totalSaidas = useMemo(() => {
    return rowsResumo.reduce((s, r) => s + (r.tipo === "SAIDA" ? r.valor : 0), 0);
  }, [rowsResumo]);

  const saldoFinal = useMemo(() => {
    return saldoInicial + saldoAtual;
  }, [saldoInicial, saldoAtual]);

  const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase('pt-BR') + s.slice(1) : s);

  const tituloMes = useMemo(() => {
    return `${capitalize(mesesPt[mes])} de ${ano}`;
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
    try {
      const u = new URL(url);
      const marker = "/storage/v1/object/public/Comprovantes/";
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const rel = u.pathname.slice(idx + marker.length);
        const { data } = await supabase.storage
          .from("Comprovantes")
          .createSignedUrl(rel, 3600);
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
          return;
        }
      }
    } catch { void 0; }
    window.open(url, "_blank");
  }

  async function adicionarReciboComoComprovanteMov() {
    if (!user || !reciboBlob || !reciboMovId) return;
    try {
      setAddingComprovante(true);
      const destPath = `comprovantes/${user.id}/${reciboMovId}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('Comprovantes')
        .upload(destPath, reciboBlob, { cacheControl: '3600', contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('Comprovantes').getPublicUrl(destPath);
      const publicUrl = pub?.publicUrl ?? null;
      if (publicUrl) {
        let updateQuery = supabase
          .from('movimentos_financeiros')
          .update({ comprovante_url: publicUrl })
          .eq('id', reciboMovId);
        if (!isAdmin) {
          updateQuery = updateQuery.eq('user_id', user.id);
        }
        const { data: updatedRows, error: upMovErr } = await updateQuery.select('id');
        if (upMovErr) throw upMovErr;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('Não foi possível atualizar este lançamento. Verifique a permissão do registro.');
        }
        setRows(prev => prev.map(r => r.id === reciboMovId ? { ...r, comprovante_url: publicUrl } : r));
        toast({ title: 'Comprovante', description: `${docType === 'REEMBOLSO' ? 'Reembolso' : 'Recibo'} adicionado como comprovante.` });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao adicionar comprovante', variant: 'destructive' });
    } finally {
      setAddingComprovante(false);
    }
  }

  function abrirEdicao(m: Mov) {
    setEditMov(m);
    setEditDesc(m.descricao || "");
    setEditData(m.data || "");
    setEditValor(String(m.valor ?? ""));
    setEditContaId(m.conta_id || "");
    setEditCategoriaId(m.categoria_id || "");
    setEditBenefId(m.beneficiario_id || "");
    setEditComprovanteUrl(m.comprovante_url || "");
    setEditComprovanteUploading(false);
    // setCatOpts and setBenefOpts will be populated by useEffect
    setEditOpen(true);
  }

  async function excluirMovimento(m: Mov) {
    if (!user) return;
    if (!confirm(`Excluir o lançamento "${m.descricao || 'sem descrição'}" de ${formatCurrency(m.valor)}?`)) return;
    setDeleting(true);
    try {
      let q = supabase
        .from("movimentos_financeiros")
        .delete()
        .eq("id", m.id);
      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      }
      const { data, error } = await q.select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: "Nada excluído",
          description: "Sem permissão para excluir este lançamento ou o registro já foi removido.",
          variant: "destructive",
        });
        return;
      }
      setRows(prev => prev.filter(r => r.id !== m.id));
      toast({ title: "Excluído", description: "Lançamento removido" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao excluir", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
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
    if (editComprovanteUploading) {
      toast({ title: "Aguarde", description: "O comprovante ainda está sendo enviado." });
      return;
    }
    const valorNum = Number(String(editValor).replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido (maior que zero).", variant: "destructive" });
      return;
    }
    if (!editContaId) {
      toast({ title: "Atenção", description: "Selecione a conta.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<{ data: string; descricao: string; valor: number; conta_id: string; categoria_id: string | null; beneficiario_id: string | null; comprovante_url: string | null }> = {
        data: editData,
        descricao: editDesc,
        valor: valorNum,
        conta_id: editContaId,
        categoria_id: editCategoriaId ? editCategoriaId : null,
        beneficiario_id: editBenefId ? editBenefId : null,
        comprovante_url: editComprovanteUrl ? editComprovanteUrl : null,
      };
      let updateQuery = supabase
        .from("movimentos_financeiros")
        .update(payload)
        .eq("id", editMov.id);
      if (!isAdmin) {
        updateQuery = updateQuery.eq("user_id", user.id);
      }
      const { data: updatedRows, error } = await updateQuery.select("id");
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        toast({
          title: "Nada salvo",
          description: "Não foi possível atualizar este lançamento. Verifique a permissão do registro.",
          variant: "destructive",
        });
        return;
      }
      const contaSel = contas.find(c => c.id === editContaId);
      setRows(prev => prev.map(r => r.id === editMov.id ? {
        ...r,
        data: editData || r.data,
        descricao: editDesc || null,
        valor: valorNum,
        conta_id: editContaId,
        conta_nome: contaSel?.nome ?? r.conta_nome ?? null,
        conta_logo: contaSel?.logo ?? r.conta_logo ?? null,
        categoria_id: payload.categoria_id || null,
        beneficiario_id: payload.beneficiario_id || null,
        categoria_nome: (catOpts.find(c => c.id === editCategoriaId)?.name) || null,
        beneficiario_nome: (benefOpts.find(b => b.id === editBenefId)?.name) || null,
        comprovante_url: payload.comprovante_url || null,
      } : r));

      if (editMov.conta_id && editCategoriaId && editBenefId) {
        const { data: contasAll } = await supabase
          .from('contas_financeiras')
          .select('id,nome,tipo')
          .eq('user_id', user.id)
          .eq('ativo', true);
        const appKey = `app:applicationAccountId:${user.id}`;
        const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const preferredId = localStorage.getItem(appKey);
        let appConta: { id: string; nome: string; tipo: string } | null = null;
        if (preferredId) {
          appConta = (contasAll || []).find(c => c.id === preferredId) || null;
        }
        if (!appConta) {
          for (const c of contasAll || []) {
            const n = norm(c.nome);
            if (n.includes('aplic') || n.includes('contamax') || n.includes('invest') || n.includes('poupanc')) { appConta = c; break; }
          }
        }
        if (appConta && appConta.id !== editMov.conta_id) {
          const descBase = norm(editDesc || editMov.descricao || '');
          const isResgate = descBase.includes('resgat');
          const isAplic = descBase.includes('aplic');
          const catSelected = catOpts.find(c => c.id === editCategoriaId) || null;
          const isTransferCat = !!catSelected && (catSelected.name === 'Transferência Interna' || catSelected.tipo === 'TRANSFERENCIA');

          if (isTransferCat || isAplic || isResgate) {
            const tipoOpp = isResgate ? 'SAIDA' : isAplic ? 'ENTRADA' : (editMov.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA');
            const { data: catsTransf } = await supabase
              .from('categories')
              .select('id,name,tipo')
              .eq('user_id', user.id)
              .eq('name', 'Transferência Interna');
            const catOpp = (catsTransf || [])[0]?.id || null;
            const { data: existingOpp } = await supabase
              .from('movimentos_financeiros')
              .select('id')
              .eq('user_id', user.id)
              .eq('ref_id', editMov.id)
              .eq('conta_id', appConta.id)
              .eq('origem', 'AJUSTE')
              .limit(1);
            if (existingOpp && existingOpp.length > 0) {
              await supabase
                .from('movimentos_financeiros')
                .update({
                  data: editMov.data,
                  tipo: tipoOpp,
                  valor: editMov.valor,
                  descricao: `Transferência: ${editDesc || editMov.descricao || ''}`,
                  origem: 'AJUSTE',
                  categoria_id: catOpp,
                  beneficiario_id: editBenefId || null,
                })
                .eq('id', existingOpp[0].id)
                .eq('user_id', user.id);
            } else {
              const { data: insOpp } = await supabase
                .from('movimentos_financeiros')
                .insert({
                  user_id: user.id,
                  conta_id: appConta.id,
                  data: editMov.data,
                  tipo: tipoOpp,
                  valor: editMov.valor,
                  descricao: `Transferência: ${editDesc || editMov.descricao || ''}`,
                  origem: 'AJUSTE',
                  ref_id: editMov.id,
                  categoria_id: catOpp,
                  beneficiario_id: editBenefId || null,
                })
                .select('id')
                .single();
              if (insOpp?.id) {
                const benefName = benefOpts.find(b => b.id === editBenefId)?.name || null;
                setRows(prev => [
                  ...prev,
                  {
                    id: insOpp.id,
                    user_id: user.id,
                    data: editMov.data,
                    descricao: `Transferência: ${editDesc || editMov.descricao || ''}`,
                    conta_id: appConta.id,
                    conta_nome: appConta.nome,
                    categoria_id: catOpp,
                    beneficiario_id: editBenefId || null,
                    categoria_nome: 'Transferência Interna',
                    beneficiario_nome: benefName,
                    tipo: tipoOpp as 'ENTRADA' | 'SAIDA',
                    valor: editMov.valor,
                    origem: 'AJUSTE',
                    comprovante_url: null,
                  },
                ]);
              }
            }
          }
        }
      }
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
      type ClassificationRule = {
        id: string;
        user_id: string;
        aplica_todos: boolean;
        term: string;
        category_id: string | null;
        beneficiary_id: string | null;
        category_name: string | null;
        beneficiary_name: string | null;
      };

      const visibleRowsForSelection = rowsView.filter((mov) => (
        contasSel.length === 0 || (mov.conta_id ? contasSel.includes(mov.conta_id) : false)
      ));
      const alreadyAppliedCount = visibleRowsForSelection.filter((mov) => mov.regras_aplicadas_em).length;
      const visibleRows = visibleRowsForSelection.filter((mov) => !mov.regras_aplicadas_em);

      if (visibleRowsForSelection.length === 0) {
        toast({ title: "Aviso", description: `Nenhum lançamento encontrado no mês ${tituloMes}.`, variant: "destructive" });
        return;
      }

      if (visibleRows.length === 0) {
        toast({
          title: "Regras Aplicadas",
          description: "Todos os lançamentos visíveis já receberam aplicação de regras.",
        });
        return;
      }

      const ownerByConta = new Map(contas.map((conta) => [conta.id, conta.user_id ?? null]));
      const ownerForMov = (mov: Mov) => mov.user_id || (mov.conta_id ? ownerByConta.get(mov.conta_id) : null) || user.id;
      const ruleOwnerIds = isAdmin
        ? Array.from(new Set(visibleRows.map(ownerForMov))).filter(Boolean)
        : [user.id];

      let rulesQuery = supabase
        .from("classification_rules")
        .select("id, user_id, aplica_todos, term, category_id, beneficiary_id, category_name, beneficiary_name")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        rulesQuery = rulesQuery.or(`user_id.eq.${user.id},aplica_todos.eq.true`);
      }

      const { data: rules, error: rulesError } = await rulesQuery;
      if (rulesError) throw rulesError;
      const fetchedRules = ((rules || []) as ClassificationRule[])
        .filter((rule) => rule.aplica_todos || ruleOwnerIds.includes(rule.user_id));
      if (fetchedRules.length === 0) {
        toast({ title: "Aviso", description: "Nenhuma regra cadastrada", variant: "destructive" });
        return;
      }

      const globalRules = fetchedRules.filter((rule) => rule.aplica_todos);
      const categoryByOwnerAndName = new Map<string, string>();
      const beneficiaryByOwnerAndName = new Map<string, string>();
      const lookupKey = (ownerId: string, name: string) => `${ownerId}|${normalizeSearchText(name)}`;

      if (globalRules.length > 0) {
        const [categoriesResult, beneficiariesResult] = await Promise.all([
          supabase
            .from("categories")
            .select("id, user_id, name")
            .in("user_id", ruleOwnerIds),
          supabase
            .from("beneficiaries")
            .select("id, user_id, name")
            .in("user_id", ruleOwnerIds),
        ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (beneficiariesResult.error) throw beneficiariesResult.error;

        for (const category of categoriesResult.data || []) {
          if (category.user_id && category.name) {
            categoryByOwnerAndName.set(lookupKey(category.user_id, category.name), category.id);
          }
        }
        for (const beneficiary of beneficiariesResult.data || []) {
          if (beneficiary.user_id && beneficiary.name) {
            beneficiaryByOwnerAndName.set(lookupKey(beneficiary.user_id, beneficiary.name), beneficiary.id);
          }
        }
      }

      const rulesByOwner = new Map<string, ClassificationRule[]>();
      for (const rule of fetchedRules.filter((item) => !item.aplica_todos)) {
        const ownerRules = rulesByOwner.get(rule.user_id) || [];
        ownerRules.push(rule);
        rulesByOwner.set(rule.user_id, ownerRules);
      }

      const updates = new Map<string, { ownerId: string; categoryId: string | null; beneficiaryId: string | null; ids: string[] }>();
      let skippedUnresolved = 0;

      for (const mov of visibleRows) {
        const description = normalizeSearchText(mov.descricao);
        if (!description) continue;

        const ownerId = ownerForMov(mov);
        const ownerRules = [...(rulesByOwner.get(ownerId) || []), ...globalRules];
        const matchedRule = ownerRules.find((rule) => {
          const term = normalizeSearchText(rule.term);
          return !!term && description.includes(term);
        });

        if (!matchedRule) continue;

        let categoryId = matchedRule.category_id;
        let beneficiaryId = matchedRule.beneficiary_id;

        if (matchedRule.aplica_todos) {
          categoryId = null;
          beneficiaryId = null;

          if (matchedRule.category_name) {
            categoryId = categoryByOwnerAndName.get(lookupKey(ownerId, matchedRule.category_name)) ?? matchedRule.category_id ?? null;
            if (!categoryId) {
              skippedUnresolved++;
              continue;
            }
          }

          if (matchedRule.beneficiary_name) {
            beneficiaryId = beneficiaryByOwnerAndName.get(lookupKey(ownerId, matchedRule.beneficiary_name)) ?? matchedRule.beneficiary_id ?? null;
            if (!beneficiaryId) {
              skippedUnresolved++;
              continue;
            }
          }
        }

        const key = `${ownerId}|${categoryId ?? ""}|${beneficiaryId ?? ""}`;
        const group = updates.get(key) || {
          ownerId,
          categoryId,
          beneficiaryId,
          ids: [],
        };
        group.ids.push(mov.id);
        updates.set(key, group);
      }

      if (updates.size === 0) {
        toast({
          title: "Regras Aplicadas",
          description: "Nenhum lançamento do mês visível corresponde aos termos cadastrados.",
        });
        return;
      }

      let totalUpdated = 0;
      const regrasAplicadasEm = new Date().toISOString();
      for (const group of updates.values()) {
        let updateQuery = supabase
          .from("movimentos_financeiros")
          .update({
            categoria_id: group.categoryId,
            beneficiario_id: group.beneficiaryId,
            regras_aplicadas_em: regrasAplicadasEm,
          })
          .in("id", group.ids)
          .is("regras_aplicadas_em", null);

        if (!isAdmin) {
          updateQuery = updateQuery.eq("user_id", user.id);
        } else {
          updateQuery = updateQuery.eq("user_id", group.ownerId);
        }

        const { data: updatedRows, error: updateError } = await updateQuery.select("id");
        if (updateError) throw updateError;
        totalUpdated += updatedRows?.length ?? 0;
      }

      toast({
        title: "Regras Aplicadas",
        description: `${totalUpdated} lançamento(s) novo(s) atualizado(s) no mês ${tituloMes}.${alreadyAppliedCount ? ` ${alreadyAppliedCount} já tinha(m) regras aplicadas e foi/foram ignorado(s).` : ""}${skippedUnresolved ? ` ${skippedUnresolved} ignorado(s) por categoria/beneficiário inexistente no usuário.` : ""}`
      });

      setReloadKey((key) => key + 1);
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
      let urlToAnalyze = m.comprovante_url;
      try {
        const u = new URL(m.comprovante_url);
        const marker = "/storage/v1/object/public/Comprovantes/";
        const idx = u.pathname.indexOf(marker);
        if (idx >= 0) {
          const rel = u.pathname.slice(idx + marker.length);
          const { data: signedData } = await supabase.storage
            .from("Comprovantes")
            .createSignedUrl(rel, 3600);
          if (signedData?.signedUrl) {
            urlToAnalyze = signedData.signedUrl;
          }
        }
      } catch { void 0; }

      const { data, error } = await supabase.functions.invoke('analisar-comprovante', {
        body: { url: urlToAnalyze, user_id: user?.id, descricao: m.descricao || '' }
      });
      if (error) throw error;
      
      type AnalisarComprovanteResponse = {
        recebedor_nome?: string | null;
        valor?: string | null;
        data?: string | null;
        sugestao?: { categoria_id?: string | null; beneficiario_id?: string | null; motivo?: string | null } | null;
      };
      const result = data as AnalisarComprovanteResponse;
      const recebedorNome = result?.recebedor_nome ?? undefined;
      const valor = result?.valor ?? undefined;
      const dataComprovante = result?.data ?? undefined;
      
      if (recebedorNome || valor) {
        const parts: string[] = [];
        if (recebedorNome) parts.push(`Para: ${recebedorNome}`);
        if (valor) parts.push(`Valor: ${valor}`);
        if (dataComprovante) parts.push(`Data: ${dataComprovante}`);
        toast({ title: "Dados do Comprovante", description: parts.join(" | ") });

        if (recebedorNome && user) {
          const { data: bens } = await supabase
            .from('beneficiaries')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name');
          const norm = (s: string) => s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const rn = norm(recebedorNome);
          let chosen: { id: string; name: string } | null = null;
          for (const b of bens || []) {
            const bn = norm(b.name);
            if (!bn) continue;
            if (rn.includes(bn) || bn.includes(rn)) { chosen = b; break; }
            const rnTokens = rn.split(' ').filter(Boolean);
            const bnTokens = bn.split(' ').filter(Boolean);
            const overlap = rnTokens.filter(t => bnTokens.includes(t));
            if (overlap.length >= 2) { chosen = b; break; }
          }
          if (chosen) {
            abrirEdicao(m);
            setEditBenefId(chosen.id);
            toast({ title: 'Beneficiário', description: `Pré-preenchido: ${chosen.name}` });
          }
        }
        return;
      }
      
      const sugestao = result?.sugestao ?? undefined;
      if (sugestao?.beneficiario_id) {
        toast({ title: "Dados do Recebedor", description: sugestao.motivo ? `${sugestao.motivo}` : `Beneficiário identificado.` });
        return;
      }
      toast({ title: "Leitura feita", description: "Nenhuma informação de recebedor encontrada." });
    } catch (e: unknown) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao ler comprovante.", variant: "destructive" });
    } finally {
      const s2 = new Set(analyzingIds);
      s2.delete(m.id);
      setAnalyzingIds(s2);
    }
  }

  async function confirmarNovoLancamento() {
    if (!user) return;
    if (!novoContaId) {
      toast({ title: "Atenção", description: "Selecione a conta.", variant: "destructive" });
      return;
    }
    if (!novoData || !/^\d{4}-\d{2}-\d{2}$/.test(novoData)) {
      toast({ title: "Atenção", description: "Data inválida.", variant: "destructive" });
      return;
    }
    const valor = Number(String(novoValor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }
    setNovoSalvando(true);
    try {
      const { error } = await supabase.from("movimentos_financeiros").insert({
        user_id: user.id,
        conta_id: novoContaId,
        data: novoData,
        tipo: novoTipo,
        valor,
        descricao: novoDescricao.trim() || null,
        categoria_id: novoCategoriaId || null,
        beneficiario_id: novoBenefId || null,
        origem: "LANCAMENTO",
      });
      if (error) throw error;
      toast({ title: "Sucesso", description: "Lançamento criado." });
      setReloadKey((k) => k + 1);
      // Mantém o diálogo aberto e os campos preenchidos para entrada em série.
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível criar o lançamento.", variant: "destructive" });
    } finally {
      setNovoSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Extrato de Lançamentos</h1>
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-1">
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-60 justify-start sm:w-64">
                    {(() => {
                      const first = contasSel.length ? contas.find(c => c.id === contasSel[0]) : null;
                      return (
                        <div className="flex w-full min-w-0 items-center gap-2">
                          {first?.logo ? (
                            <img src={first.logo} alt="Logo" className="h-5 w-5 shrink-0 object-contain" />
                          ) : null}
                          <span className="truncate">{first?.nome || 'Todas as Contas e Cartões'}</span>
                        </div>
                      );
                    })()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[260px]">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setContasSel([]); setMenuOpen(false); }}>
                    <div className="flex items-center gap-2">
                      <span>Todas as Contas e Cartões</span>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground"
                    aria-label="Ajuda sobre Todas as Contas e Cartões"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
                  <p className="font-medium text-foreground">Todas as Contas e Cartões</p>
                  <p className="mt-1 text-muted-foreground">
                    Mostra os lançamentos de todas as contas e cartões no mês selecionado. Escolha uma conta ou cartão na lista para ver somente os movimentos dela.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu open={tipoMenuOpen} onOpenChange={setTipoMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-60 justify-start sm:w-64">
                    <span className="truncate">
                      {tipoVisao === 'TODOS' ? 'Todos os Lançamentos' : tipoVisao === 'DESPESAS' ? 'Despesas' : tipoVisao === 'RECEITAS' ? 'Receitas' : 'Transferências'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[220px]">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('TODOS'); setTipoMenuOpen(false); }}>Todos os Lançamentos</DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('DESPESAS'); setTipoMenuOpen(false); }}>Despesas</DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('RECEITAS'); setTipoMenuOpen(false); }}>Receitas</DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('TRANSFERENCIAS'); setTipoMenuOpen(false); }}>Transferências</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground"
                    aria-label="Ajuda sobre Todos os Lançamentos"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
                  <p className="font-medium text-foreground">Todos os Lançamentos</p>
                  <p className="mt-1 text-muted-foreground">
                    Mostra todos os movimentos do mês selecionado: despesas, receitas e transferências. Use as outras opções para ver apenas um tipo de lançamento.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-y-4 sm:grid-cols-2 sm:gap-x-10 lg:gap-x-14">
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-1">
                <Button className="w-48 justify-start" variant="outline" onClick={aplicarRegras} disabled={applyingRules}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {applyingRules ? "Aplicando..." : "Aplicar Regras"}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground"
                      aria-label="Ajuda sobre Aplicar Regras"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
                    <p className="font-medium text-foreground">Aplicar Regras</p>
                    <p className="mt-1 text-muted-foreground">
                      Atualiza categoria e beneficiário dos lançamentos visíveis que ainda não receberam regras, usando os termos cadastrados pela descrição.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1">
                <Button className="w-48 justify-start" variant="outline" onClick={ajustarDescricoesLote} disabled={bulkAdjusting}>
                  {bulkAdjusting ? 'Ajustando...' : 'Ajustar Descrições'}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground"
                      aria-label="Ajuda sobre Ajustar Descrições"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
                    <p className="font-medium text-foreground">Ajustar Descrições</p>
                    <p className="mt-1 text-muted-foreground">
                      Padroniza a descrição apenas dos lançamentos do mês/conta selecionados que já receberam regras, usando "Valor referente a" mais o nome da categoria.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button className="w-48 justify-start" variant="outline" onClick={() => setExtratoPdfOpen(true)} disabled={extratoPdfBusy}>
                <FileText className="w-4 h-4 mr-2" />
                Extrato PDF
                {contaExtrato && extratoPdfExists ? (
                  <span className="ml-2 inline-flex items-center rounded border px-2 py-0.5 text-xs">OK</span>
                ) : null}
              </Button>
              <Button className="w-48 justify-start" variant="outline" onClick={() => setCalcOpen(true)} aria-label="Abrir calculadora">
                <Calculator className="w-4 h-4 mr-2" />
                Calculadora
              </Button>
            </div>
          </div>

          <div className="w-full lg:w-64 flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => {
                const hoje = new Date();
                setNovoData(toYmd(hoje));
                setNovoContaId(contasSel.length === 1 ? contasSel[0] : "");
                setNovoTipo("SAIDA");
                setNovoValor("");
                setNovoDescricao("");
                setNovoCategoriaId("");
                setNovoBenefId("");
                setNovoOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Lançamento
            </Button>
            <div className="relative w-full">
              <Input
                placeholder="Pesquisar"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pr-8"
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
          </div>
        </div>

        <div className="mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saldo Anterior</span>
                  <span className={`font-semibold ${saldoInicial >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(saldoInicial)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Entradas</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(totalEntradas)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saídas</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalSaidas)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saldo Final</span>
                  <span className={`font-semibold ${saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(saldoFinal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
          <div className="flex items-center gap-2 justify-start">
            <span className="text-sm text-muted-foreground">Visualização</span>
            <Button variant={modoCard ? "secondary" : "ghost"} onClick={() => setModoCard(false)}><Rows className="w-4 h-4" /></Button>
            <Button variant={modoCard ? "ghost" : "secondary"} onClick={() => setModoCard(true)}><Square className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center gap-3 justify-center">
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
                      {capitalize(nomeMes).substring(0, 3)}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div />
        </div>

        {!modoCard ? (
          <div className="overflow-auto rounded border bg-white max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-center w-10">Conta</th>
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
                {rowsView.filter(r => {
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
                      <td className="p-2 text-center">
                        {r.conta_logo ? (
                          <img
                            src={r.conta_logo}
                            alt={r.conta_nome || ''}
                            title={r.conta_nome || ''}
                            className="w-6 h-6 object-contain rounded inline-block"
                          />
                        ) : (
                          <span
                            title={r.conta_nome || ''}
                            className="inline-flex items-center justify-center w-6 h-6 rounded bg-muted text-[10px] font-semibold"
                          >
                            {(r.conta_nome || '?').slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="p-2">{ymdToBr(r.data)}</td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <span>{r.descricao}</span>
                          {r.regras_aplicadas_em ? (
                            <span className="inline-flex w-fit items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Regras aplicadas
                            </span>
                          ) : null}
                          {r.descricao_ajustada_em ? (
                            <span className="inline-flex w-fit items-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              Descrição ajustada
                            </span>
                          ) : null}
                        </div>
                      </td>
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
                      <td className="p-2 text-right"><span className={r.tipo === 'ENTRADA' ? 'text-blue-600' : 'text-red-600'}>{formatCurrency(r.valor)}</span></td>
                      <td className={`p-2 text-right ${isLast ? (sd >= 0 ? 'text-blue-600' : 'text-red-600') : ''}`}>{isLast ? formatCurrency(sd) : ''}</td>
                      <td className="p-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { abrirEdicao(r); }}>Editar</DropdownMenuItem>
                            {r.tipo === 'SAIDA' ? (
                              <>
                                <DropdownMenuItem onSelect={() => { gerarReciboMov(r); }}>Recibo</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { gerarReembolsoMov(r); }}>Reembolso</DropdownMenuItem>
                              </>
                            ) : null}
                            <DropdownMenuItem onSelect={() => { excluirMovimento(r); }} className="text-destructive" disabled={deleting}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {rowsView.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rowsView.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{ymdToBr(r.data)}</div>
                  <div className="font-medium">{r.descricao}</div>
                  <div className="text-sm flex items-center gap-2">
                    {r.conta_logo ? (
                      <img src={r.conta_logo} alt={r.conta_nome || ''} className="w-5 h-5 object-contain rounded" />
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[9px] font-semibold">
                        {(r.conta_nome || '?').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span>{r.conta_nome || ''}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.categoria_nome || ''}</div>
                  <div className="text-xs text-muted-foreground">{r.beneficiario_nome || ''}</div>
                  {r.regras_aplicadas_em ? (
                    <div className="mt-2 inline-flex w-fit items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Regras aplicadas
                    </div>
                  ) : null}
                  {r.descricao_ajustada_em ? (
                    <div className="mt-2 inline-flex w-fit items-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      Descrição ajustada
                    </div>
                  ) : null}
                  <div className={`mt-2 text-lg font-semibold ${r.tipo === 'ENTRADA' ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(r.valor)}</div>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { abrirEdicao(r); }}>Editar</DropdownMenuItem>
                      {r.tipo === 'SAIDA' ? (
                        <>
                          <DropdownMenuItem onSelect={() => { gerarReciboMov(r); }}>Recibo</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => { gerarReembolsoMov(r); }}>Reembolso</DropdownMenuItem>
                        </>
                      ) : null}
                      <DropdownMenuItem onSelect={() => { excluirMovimento(r); }} className="text-destructive" disabled={deleting}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {rowsView.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum Lançamento</CardContent></Card>
            )}
          </div>
        )}
        <Dialog open={extratoPdfOpen} onOpenChange={setExtratoPdfOpen}>
          <DialogContent className="sm:max-w-[900px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Extrato Bancário - {capitalize(mesesPt[mes])} {ano}</DialogTitle>
            </DialogHeader>
            {!contaExtrato ? (
              <div className="text-sm text-muted-foreground">Selecione uma conta (não &quot;Todas&quot;) para vincular o PDF ao mês.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{contaExtrato.nome}</span>
                    <span className="mx-2">•</span>
                    <span>{extratoPdfName}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={carregarExtratoPdfUrl} disabled={extratoPdfBusy}>
                      Atualizar
                    </Button>
                    {extratoPdfExists ? (
                      <>
                        <Button type="button" variant="outline" onClick={abrirExtratoPdf} disabled={extratoPdfBusy}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                        <Button type="button" variant="outline" onClick={removerExtratoPdf} disabled={extratoPdfBusy}>
                          Remover
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Enviar / Substituir PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={extratoPdfBusy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      await uploadExtratoPdf(file);
                      await refreshExtratoPdfExists();
                      await carregarExtratoPdfUrl();
                    }}
                  />
                </div>

                {extratoPdfUrl ? (
                  <iframe src={extratoPdfUrl} className="w-full h-[70vh] rounded-md border bg-white" />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {extratoPdfBusy ? "Carregando PDF..." : (extratoPdfExists ? "Clique em Atualizar para carregar a pré-visualização." : "Nenhum PDF encontrado para este mês.")}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
          <DialogContent className="sm:max-w-[360px]" onKeyDownCapture={onCalcKeyDown}>
            <DialogHeader>
              <DialogTitle>Calculadora</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground text-right">
                {calcStored !== null && calcOp ? `${calcStored} ${calcOp}` : ""}
              </div>
              <Input value={calcDisplay} readOnly className="text-right font-mono text-lg" />
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" onClick={calcReset}>C</Button>
                <Button variant="outline" onClick={calcBackspace}>⌫</Button>
                <Button variant="outline" onClick={calcToggleSign}>±</Button>
                <Button variant="outline" onClick={() => calcPressOp("/")}>÷</Button>

                <Button variant="outline" onClick={() => calcPressDigit("7")}>7</Button>
                <Button variant="outline" onClick={() => calcPressDigit("8")}>8</Button>
                <Button variant="outline" onClick={() => calcPressDigit("9")}>9</Button>
                <Button variant="outline" onClick={() => calcPressOp("*")}>×</Button>

                <Button variant="outline" onClick={() => calcPressDigit("4")}>4</Button>
                <Button variant="outline" onClick={() => calcPressDigit("5")}>5</Button>
                <Button variant="outline" onClick={() => calcPressDigit("6")}>6</Button>
                <Button variant="outline" onClick={() => calcPressOp("-")}>−</Button>

                <Button variant="outline" onClick={() => calcPressDigit("1")}>1</Button>
                <Button variant="outline" onClick={() => calcPressDigit("2")}>2</Button>
                <Button variant="outline" onClick={() => calcPressDigit("3")}>3</Button>
                <Button variant="outline" onClick={() => calcPressOp("+")}>+</Button>

                <Button variant="outline" className="col-span-2" onClick={() => calcPressDigit("0")}>0</Button>
                <Button variant="outline" onClick={calcPressDecimal}>.</Button>
                <Button onClick={calcPressEquals}>=</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Editar Movimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição" />
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={editValor}
                  onChange={e => setEditValor(e.target.value)}
                />
              </div>
              <div>
                <Label>Conta</Label>
                <Select value={editContaId} onValueChange={setEditContaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <Command
                      filter={(value, search) => (
                        normalizeSearchText(value).includes(normalizeSearchText(search)) ? 1 : 0
                      )}
                    >
                      <CommandInput placeholder="Buscar categoria..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                        <CommandGroup>
                          {catOpts
                            .filter(c => editMov ? (c.tipo === 'TRANSFERENCIA' || c.tipo === (editMov.tipo === "ENTRADA" ? "RECEITA" : "DESPESA")) : true)
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
                                {c.name === 'Transferência Interna' ? (
                                  <span className="ml-2"><span className="inline-block rounded border px-2 py-0.5 text-xs">Transferência</span></span>
                                ) : null}
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
                onUploadingChange={setEditComprovanteUploading}
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
                <Button onClick={salvarEdicao} disabled={saving || editComprovanteUploading}>
                  {editComprovanteUploading ? 'Enviando comprovante...' : saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showReciboModal} onOpenChange={setShowReciboModal}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>{docType === 'RECIBO' ? 'Recibo ERP' : 'Reembolso'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {(docType === 'REEMBOLSO' || docType === 'RECIBO') && (
                <div className="space-y-2">
                  <Label>Beneficiário</Label>
                  <Popover open={openBenefReembMov} onOpenChange={setOpenBenefReembMov}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={openBenefReembMov} className="w-full justify-between">
                        {reembBenefIdMov ? (benefOpts.find(b => b.id === reembBenefIdMov)?.name || 'Selecionado') : 'Selecione um beneficiário...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar beneficiário..." value={rbSearchMov} onValueChange={setRbSearchMov} />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2 flex flex-col items-center gap-2">
                          <span className="text-sm text-muted-foreground">Não encontrado.</span>
                          {rbSearchMov.length > 2 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-8"
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  const nome = rbSearchMov.trim();
                                  const { data, error } = await supabase
                                    .from('beneficiaries')
                                    .insert({ user_id: user.id, name: nome })
                                    .select('id,name')
                                    .single();
                                  if (error) throw error;
                                  setBenefOpts(prev => [{ id: data.id, name: data.name }, ...prev]);
                                  setOpenBenefReembMov(false);
                                  setRbSearchMov('');
                                  await selecionarBeneficiarioReembolsoMov(data.id);
                                  toast({ title: 'Beneficiário criado', description: data.name });
                                } catch (err: unknown) {
                                  toast({ title: 'Erro ao criar beneficiário', description: err instanceof Error ? err.message : 'Falha ao criar', variant: 'destructive' });
                                }
                              }}
                            >
                              {`Criar "${rbSearchMov}"`}
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                            {benefOpts.filter(b => b.name.toLowerCase().includes(rbSearchMov.toLowerCase())).map(b => (
                              <CommandItem key={b.id} value={b.name} onSelect={() => { setOpenBenefReembMov(false); selecionarBeneficiarioReembolsoMov(b.id); }}>
                                <Check className={cn("mr-2 h-4 w-4", reembBenefIdMov === b.id ? "opacity-100" : "opacity-0")} />
                                {b.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!reembBenefIdMov && docType === 'REEMBOLSO' && (
                    <div className="text-xs text-muted-foreground">Selecione um beneficiário para gerar o PDF.</div>
                  )}
                  {!reembBenefIdMov && docType === 'RECIBO' && !reciboUrl && (
                    <div className="text-xs text-muted-foreground">Selecione um beneficiário para gerar o recibo com assinatura.</div>
                  )}
                  
                </div>
              )}
              {reciboLoading ? (
                <div className="text-sm text-muted-foreground">Carregando recibo...</div>
              ) : reciboUrl ? (
                <iframe src={reciboUrl} className="w-full h-[70vh] rounded border" />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {docType === 'RECIBO' ? 'Selecione um beneficiário para gerar o recibo.' : 'Selecione um beneficiário para gerar o reembolso.'}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowReciboModal(false)}>Fechar</Button>
                <Button type="button" onClick={adicionarReciboComoComprovanteMov} disabled={addingComprovante || !reciboBlob || ((docType === 'REEMBOLSO' || docType === 'RECIBO') && !reembBenefIdMov)}>
                  {addingComprovante ? 'Adicionando...' : 'Adicionar como comprovante'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Novo Lançamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={novoTipo} onValueChange={(v: "ENTRADA" | "SAIDA") => { setNovoTipo(v); setNovoCategoriaId(""); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRADA">Entrada</SelectItem>
                      <SelectItem value="SAIDA">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={novoContaId} onValueChange={setNovoContaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria (opcional)</Label>
                <Select value={novoCategoriaId} onValueChange={setNovoCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {catOpts
                      .filter((c) => {
                        const alvo = novoTipo === "ENTRADA" ? "RECEITA" : "DESPESA";
                        return !c.tipo || c.tipo === alvo || c.tipo === "TRANSFERENCIA";
                      })
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Beneficiário (opcional)</Label>
                <Select value={novoBenefId} onValueChange={setNovoBenefId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem beneficiário" />
                  </SelectTrigger>
                  <SelectContent>
                    {benefOpts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Após salvar, os campos ficam preenchidos para você criar o próximo lançamento mais rápido. Use "Fechar" quando terminar.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setNovoOpen(false)} disabled={novoSalvando}>
                  Fechar
                </Button>
                <Button type="button" onClick={confirmarNovoLancamento} disabled={novoSalvando}>
                  {novoSalvando ? "Salvando..." : "Salvar e continuar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}
