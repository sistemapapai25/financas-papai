import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter, Rows, Square, Edit3, Search, X, Wand2, FileText, ExternalLink, ScanText, Receipt, MoreVertical } from "lucide-react";
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

const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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

  useEffect(() => {
    if (!user) return;
    if (showReciboModal && docType === 'REEMBOLSO' && benefOpts.length === 0) {
      supabase
        .from('beneficiaries')
        .select('id,name')
        .eq('user_id', user.id)
        .order('name')
        .then(({ data }) => {
          if (data) setBenefOpts(data);
        });
    }
  }, [showReciboModal, docType, user]);
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
      setBulkAdjusting(true);
      let ok = 0, skip = 0, fail = 0;
      const updates: { id: string; desc: string }[] = [];
      for (const r of rowsView) {
        const categoria = (r.categoria_nome || '').trim();
        if (!categoria) { skip++; continue; }
        const nova = `Valor referente a ${categoria}`;
        if ((r.descricao || '').trim() === nova) { skip++; continue; }
        const { error } = await supabase
          .from('movimentos_financeiros')
          .update({ descricao: nova })
          .eq('id', r.id)
          .eq('user_id', user.id);
        if (error) { fail++; continue; }
        ok++;
        updates.push({ id: r.id, desc: nova });
      }
      if (updates.length > 0) {
        setRows(prev => prev.map(p => {
          const u = updates.find(u => u.id === p.id);
          return u ? { ...p, descricao: u.desc } : p;
        }));
      }
      toast({ title: 'Ajuste de descrições', description: `Atualizados: ${ok}. Ignorados: ${skip}. Falhas: ${fail}.` });
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
  function onlyDigits(s: string | null | undefined) { return String(s ?? '').replace(/\D+/g, ''); }
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

  async function gerarReciboMov(m: Mov) {
    try {
      if (!user) { toast({ title: 'Sessão', description: 'Faça login para emitir recibo', variant: 'destructive' }); return; }
      if (m.tipo !== 'SAIDA') { toast({ title: 'Recibo', description: 'Recibo é emitido para saídas (despesas).' }); return; }
      if (!church) { toast({ title: 'Configuração da Igreja', description: 'Preencha os dados em Configurações > Igreja', variant: 'destructive' }); return; }
      setDocType('RECIBO');
      setReciboUrl(null);
      setReembBenefIdMov(null);
      setReembBenefNameMov(null);
      setReembBenefDocMov(null);
      setReembBenefAssUrlMov(null);
      setShowReciboModal(true);
      setReciboLoading(true);
      setReciboMovId(m.id);
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
      let yNome = y - 24;
      if (m.beneficiario_id) {
        const { data: ben } = await supabase
          .from('beneficiaries')
          .select('name,documento')
          .eq('id', m.beneficiario_id)
          .maybeSingle();
        const signerName = ben?.name || null;
        const signerDoc = ben?.documento || null;
        let signerPath: string | null = null;
        if (user) {
          const folder = `assinaturas/${user.id}/beneficiarios`;
          const { data: files } = await supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
          const match = (files || []).find(f => f.name.startsWith(`${m.beneficiario_id}-`));
          if (match) signerPath = `${folder}/${match.name}`;
        }
        if (signerPath) {
          const { data: blobRes } = await supabase.storage.from('Assinaturas').download(signerPath);
          if (blobRes) {
            const buf = await blobRes.arrayBuffer();
            let img;
            try { img = await pdfDoc.embedPng(buf); }
            catch { img = await pdfDoc.embedJpg(buf); }
            const sigW = Math.min(180, width - MARGIN_L - MARGIN_R);
            const sigH = img.height * (sigW / img.width);
            const sigX = (width - sigW) / 2;
            const sigY = y - sigH - 8;
            page.drawImage(img, { x: sigX, y: sigY, width: sigW, height: sigH });
            yNome = sigY - 24;
          }
        }
        if (signerName) {
          center(signerName, yNome, 12, true);
          const docFmt = signerDoc ? (onlyDigits(signerDoc).length <= 11 ? formatCPF(signerDoc) : formatCNPJ(signerDoc)) : null;
          if (docFmt) center(`CPF / CNPJ: ${docFmt}`, yNome - 18, 12);
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
      if (m) await gerarReembolsoMovPdf(m);
      else if (reciboMovId) {
        const mov = rows.find(r => r.id === reciboMovId);
        if (mov) await gerarReembolsoMovPdf(mov);
      }
    } catch {
      if (m) await gerarReembolsoMovPdf(m);
    }
  }
  const rowsView = useMemo(() => {
    if (tipoVisao === 'DESPESAS') return rows.filter(r => r.categoria_nome !== 'Transferência Interna' && r.tipo === 'SAIDA');
    if (tipoVisao === 'RECEITAS') return rows.filter(r => r.categoria_nome !== 'Transferência Interna' && r.tipo === 'ENTRADA');
    if (tipoVisao === 'TRANSFERENCIAS') return rows.filter(r => r.categoria_nome === 'Transferência Interna');
    return rows;
  }, [rows, tipoVisao]);

  const rowsResumo = useMemo(() => {
    return tipoVisao === 'TRANSFERENCIAS' ? rowsView : rowsView.filter(r => r.categoria_nome !== 'Transferência Interna');
  }, [rowsView, tipoVisao]);

  const saldoAtual = useMemo(() => {
    return rowsResumo.reduce((s, r) => s + (r.tipo === "ENTRADA" ? r.valor : -r.valor), 0);
  }, [rowsResumo]);

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
        const { error: upMovErr } = await supabase
          .from('movimentos_financeiros')
          .update({ comprovante_url: publicUrl })
          .eq('id', reciboMovId)
          .eq('user_id', user.id);
        if (upMovErr) throw upMovErr;
        setRows(prev => prev.map(r => r.id === reciboMovId ? { ...r, comprovante_url: publicUrl } : r));
        toast({ title: 'Comprovante', description: 'Recibo adicionado como comprovante.' });
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

      if (editMov.conta_id && editCategoriaId && editBenefId) {
        const { data: contasAll } = await supabase
          .from('contas_financeiras')
          .select('id,nome,tipo')
          .eq('user_id', user.id);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Extrato de Lançamentos</h1>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
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

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={aplicarRegras} disabled={applyingRules}>
              <Wand2 className="w-4 h-4 mr-2" />
              {applyingRules ? "Aplicando..." : "Aplicar Regras"}
            </Button>
            <Button variant="outline" onClick={ajustarDescricoesLote} disabled={bulkAdjusting}>
              {bulkAdjusting ? 'Ajustando...' : 'Ajustar Descrições'}
            </Button>
            <DropdownMenu open={tipoMenuOpen} onOpenChange={setTipoMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {tipoVisao === 'TODOS' ? 'Todos Lançamentos' : tipoVisao === 'DESPESAS' ? 'Despesas' : tipoVisao === 'RECEITAS' ? 'Receitas' : 'Transferências'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[220px]">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('TODOS'); setTipoMenuOpen(false); }}>Todos Lançamentos</DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('DESPESAS'); setTipoMenuOpen(false); }}>Despesas</DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('RECEITAS'); setTipoMenuOpen(false); }}>Receitas</DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTipoVisao('TRANSFERENCIAS'); setTipoMenuOpen(false); }}>Transferências</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative w-full lg:w-64">
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

        <div className="mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saldo Anterior</span>
                  <span className={`font-semibold ${saldoInicial >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(saldoInicial)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Entradas</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(totalEntradas)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saídas</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalSaidas)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Saldo Final</span>
                  <span className={`font-semibold ${saldoFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(saldoFinal)}</span>
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {rowsView.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum Lançamento</td>
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
        <Dialog open={showReciboModal} onOpenChange={setShowReciboModal}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>{docType === 'RECIBO' ? 'Recibo ERP' : 'Reembolso'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {docType === 'REEMBOLSO' && (
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
                  {!reembBenefIdMov && (
                    <div className="text-xs text-muted-foreground">Selecione um beneficiário para gerar o PDF.</div>
                  )}
                  
                </div>
              )}
              {reciboLoading ? (
                <div className="text-sm text-muted-foreground">Carregando recibo...</div>
              ) : reciboUrl ? (
                <iframe src={reciboUrl} className="w-full h-[70vh] rounded border" />
              ) : (
                <div className="text-sm text-muted-foreground">Selecione um beneficiário para gerar o reembolso.</div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowReciboModal(false)}>Fechar</Button>
                <Button type="button" onClick={adicionarReciboComoComprovanteMov} disabled={addingComprovante || !reciboBlob || (docType === 'REEMBOLSO' && !reembBenefIdMov)}>
                  {addingComprovante ? 'Adicionando...' : 'Adicionar como comprovante'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}
