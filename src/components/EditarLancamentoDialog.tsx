import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NovoBeneficiarioModal from './NovoBeneficiarioModal';
import NovaCategoriaModal from './NovaCategoriaModal';
import FileUpload from './FileUpload';
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, PenTool, Image as ImageIcon, FileText } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ymdToBr } from '@/utils/date';

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
function formatDocAuto(s: string | null | undefined) {
  const d = onlyDigits(s);
  if (d.length >= 14) return formatCNPJ(s);
  return formatCPF(s);
}

interface EditarLancamentoDialogProps {
  lancamento: {
    id: string;
    descricao: string;
    valor: number;
    vencimento: string;
    tipo: 'DESPESA' | 'RECEITA';
    status: 'EM_ABERTO' | 'PAGO' | 'CANCELADO';
    observacoes?: string;
    categoria_id: string;
    beneficiario_id?: string;
    data_pagamento?: string;
    valor_pago?: number;
    boleto_url?: string;
    comprovante_url?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  restrictedEditing?: boolean;
  enableRecibo?: boolean;
}

interface Categoria {
  id: string;
  name: string;
  tipo: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA';
}

interface Beneficiario {
  id: string;
  name: string;
}

const EditarLancamentoDialog = ({ lancamento, open, onOpenChange, onSuccess, restrictedEditing = false, enableRecibo = false }: EditarLancamentoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    vencimento: '',
    tipo: 'DESPESA' as 'DESPESA' | 'RECEITA',
    categoria_id: '',
    beneficiario_id: 'none',
    observacoes: '',
    status: 'EM_ABERTO' as 'EM_ABERTO' | 'PAGO' | 'CANCELADO',
    data_pagamento: '',
    valor_pago: '',
    boleto_url: '',
    comprovante_url: ''
  });
  const [openCategoria, setOpenCategoria] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  const [reciboInfo, setReciboInfo] = useState<{ path: string | null; numero: number | null; ano: number | null }>(() => ({ path: null, numero: null, ano: null }));
  const [church, setChurch] = useState<{ igreja_nome: string; igreja_cnpj: string; responsavel_nome: string; responsavel_cpf: string; assinatura_path?: string | null } | null>(null);
  const [assinaturaFile, setAssinaturaFile] = useState<File | null>(null);
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState<string | null>(null);
  const [showAssinaturaPad, setShowAssinaturaPad] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{ drawing: boolean; ctx: CanvasRenderingContext2D | null }>({ drawing: false, ctx: null });
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboUrl, setReciboUrl] = useState<string | null>(null);
  const [addingComprovante, setAddingComprovante] = useState(false);
  const [reciboLoading, setReciboLoading] = useState(false);
  const [reciboBlob, setReciboBlob] = useState<Blob | null>(null);
  const [docType, setDocType] = useState<'RECIBO' | 'REEMBOLSO'>('RECIBO');
  const [reembolsoBenefId, setReembolsoBenefId] = useState<string | null>(null);
  const [reembolsoBenefName, setReembolsoBenefName] = useState<string | null>(null);
  const [reembolsoBenefDoc, setReembolsoBenefDoc] = useState<string | null>(null);
  const [reembolsoBenefAssUrl, setReembolsoBenefAssUrl] = useState<string | null>(null);
  const [openBenefReemb, setOpenBenefReemb] = useState(false);
  const [rbSearch, setRbSearch] = useState("");

  const isLocked = restrictedEditing || !!reciboInfo.path;

  useEffect(() => {
    if (open && user) {
      carregarDados();
      (async () => {
        const { data: lanc } = await supabase
          .from('lancamentos')
          .select('recibo_pdf_path, recibo_numero, recibo_ano')
          .eq('id', lancamento.id)
          .single();
        setReciboInfo({ path: lanc?.recibo_pdf_path ?? null, numero: lanc?.recibo_numero ?? null, ano: lanc?.recibo_ano ?? null });
        const { data: cs } = await supabase
          .from('church_settings')
          .select('igreja_nome, igreja_cnpj, responsavel_nome, responsavel_cpf, assinatura_path')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cs) setChurch({ igreja_nome: cs.igreja_nome, igreja_cnpj: cs.igreja_cnpj, responsavel_nome: cs.responsavel_nome, responsavel_cpf: cs.responsavel_cpf, assinatura_path: cs.assinatura_path });
      })();
    }
  }, [open, user]);

  useEffect(() => {
    // Preencher form com dados do lançamento após categorias e beneficiários serem carregados
    if (open && categorias.length > 0) {
      setFormData({
        descricao: lancamento.descricao,
        valor: lancamento.valor.toString(),
        vencimento: lancamento.vencimento,
        tipo: lancamento.tipo,
        categoria_id: lancamento.categoria_id,
        beneficiario_id: lancamento.beneficiario_id || 'none',
        observacoes: lancamento.observacoes || '',
        status: lancamento.status,
        data_pagamento: lancamento.data_pagamento || '',
        valor_pago: lancamento.valor_pago?.toString() || '',
        boleto_url: lancamento.boleto_url || '',
        comprovante_url: lancamento.comprovante_url || ''
      });
    }
  }, [open, categorias, beneficiarios, lancamento]);

  const carregarDados = async () => {
    try {
      // Carregar categorias
      const { data: categoriasData } = await supabase
        .from('categories')
        .select('id, name, tipo')
        .eq('user_id', user?.id)
        .order('name');

      setCategorias(categoriasData || []);

      // Carregar beneficiários
      const { data: beneficiariosData } = await supabase
        .from('beneficiaries')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name');

      setBeneficiarios(beneficiariosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawingRef.current.ctx = ctx;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    const start = (x: number, y: number) => { drawingRef.current.drawing = true; ctx.beginPath(); ctx.moveTo(x, y); };
    const draw = (x: number, y: number) => { if (!drawingRef.current.drawing) return; ctx.lineTo(x, y); ctx.stroke(); };
    const end = () => { drawingRef.current.drawing = false; };
    const getXY = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (e instanceof TouchEvent) {
        const t = e.touches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
      const m = e as MouseEvent;
      return { x: m.clientX - rect.left, y: m.clientY - rect.top };
    };
    canvas.onmousedown = (e) => { const { x, y } = getXY(e); start(x, y); };
    canvas.onmousemove = (e) => { const { x, y } = getXY(e); draw(x, y); };
    canvas.onmouseup = () => end();
    canvas.onmouseleave = () => end();
    canvas.ontouchstart = (e) => { const { x, y } = getXY(e); start(x, y); };
    canvas.ontouchmove = (e) => { const { x, y } = getXY(e); draw(x, y); };
    canvas.ontouchend = () => end();
  }

  async function gerarRecibo() {
    try {
      setLoading(true);
      if (!user) { toast({ title: 'Sessão', description: 'Usuário não autenticado', variant: 'destructive' }); return; }
      if (reciboInfo.path) { toast({ title: 'Recibo já gerado', description: 'Este lançamento já possui recibo.' }); return; }
      if (!church) {
        toast({ title: 'Configuração necessária', description: 'Preencha os dados da igreja antes de gerar.' });
        return;
      }

      const ano = new Date().getFullYear();
      const { data: nextNumRes, error: nextErr } = await supabase.rpc('next_recibo_num', { _user_id: user.id, _ano: ano });
      if (nextErr) throw nextErr;
      const numero = Number(nextNumRes);
      const numeroFmt = String(numero).padStart(6, '0');

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width } = page.getSize();
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

      center(church.igreja_nome, 800, 16, true);
      center(`CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, 780, 12, false);
      center(`RECIBO Nº ${numeroFmt}/${ano}`, 750, 14, true);

      const valor = formData.status === 'PAGO' ? parseFloat(formData.valor_pago) || formData.valor : formData.valor;
      const dataStrIso = formData.status === 'PAGO' && formData.data_pagamento ? formData.data_pagamento : formData.vencimento;
      const dataStr = ymdToBr(dataStrIso);
      const corpo = `Recebi da Igreja ${church.igreja_nome} a quantia de R$ ${Number(valor).toFixed(2)} referente a "${formData.descricao}" na data ${dataStr}.`;
      let y = 700;
      for (const line of wrapByWidth(corpo, 12)) { drawText(line, MARGIN_L, y, 12, false); y -= 18; }

      // Assinatura
      let assinaturaImgBytes: Uint8Array | null = null;
      if (assinaturaDataUrl) {
        const b64 = assinaturaDataUrl.split(',')[1];
        assinaturaImgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      } else if (assinaturaFile) {
        assinaturaImgBytes = new Uint8Array(await assinaturaFile.arrayBuffer());
      } else if (church.assinatura_path) {
        const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(church.assinatura_path, 300);
        if (signed?.signedUrl) {
          const resp = await fetch(signed.signedUrl);
          if (resp.ok) {
            const buf = new Uint8Array(await resp.arrayBuffer());
            assinaturaImgBytes = buf;
          }
        }
      }
      if (assinaturaImgBytes) {
        try {
          const img = await pdfDoc.embedPng(assinaturaImgBytes).catch(async () => pdfDoc.embedJpg(assinaturaImgBytes!));
          const imgW = 200;
          const scale = imgW / img.width;
          const imgH = img.height * scale;
          page.drawImage(img, { x: (width - imgW) / 2, y: 620 - imgH, width: imgW, height: imgH });
        } catch { /* ignore */ }
      }
      center(church.responsavel_nome, 600, 12, true);
      center(`CPF: ${formatCPF(church.responsavel_cpf)}`, 582, 12, false);

      const pdfBytes = await pdfDoc.save();
      const ab = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(ab).set(pdfBytes);
      const pdfBlob = new Blob([ab], { type: 'application/pdf' });
      const path = `recibos/${user.id}/${lancamento.id}-${ano}-${numeroFmt}.pdf`;
      const { error: upErr } = await supabase.storage.from('Recibos').upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { error: upLancErr } = await supabase
        .from('lancamentos')
        .update({ recibo_numero: numero, recibo_ano: ano, recibo_pdf_path: path, recibo_gerado_em: new Date().toISOString() })
        .eq('id', lancamento.id);
      if (upLancErr) throw upLancErr;

      setReciboInfo({ path, numero, ano });
      toast({ title: 'Recibo gerado', description: `RECIBO Nº ${numeroFmt}/${ano}` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar recibo', description: e?.message || 'Falha na geração', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function abrirRecibo() {
    if (!reciboInfo.path) return;
    setDocType('RECIBO');
    setShowReciboModal(true);
    setReciboLoading(true);
    try {
      const { data } = await supabase.storage.from('Recibos').createSignedUrl(reciboInfo.path, 3600);
      if (data?.signedUrl) {
        setReciboUrl(data.signedUrl);
        return;
      }
      const { data: pub } = supabase.storage.from('Recibos').getPublicUrl(reciboInfo.path);
      if (pub?.publicUrl) {
        setReciboUrl(pub.publicUrl);
        return;
      }
      setReciboUrl(null);
    } finally {
      setReciboLoading(false);
    }
  }

  function gerarReembolso() {
    if (!user) { toast({ title: 'Sessão', description: 'Usuário não autenticado', variant: 'destructive' }); return; }
    if (!church) { toast({ title: 'Configuração necessária', description: 'Preencha os dados da igreja antes de gerar.' }); return; }
    setDocType('REEMBOLSO');
    setShowReciboModal(true);
    setReciboUrl(null);
  }

  async function gerarReembolsoPdf() {
    try {
      if (!user || !church) return;
      setReciboLoading(true);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const drawText = (text: string, x: number, y: number, size = 12, bold = false) => { page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) }); };
      const center = (text: string, y: number, size = 12, bold = false) => { const w = (bold ? fontBold : font).widthOfTextAtSize(text, size); const x = (width - w) / 2; drawText(text, x, y, size, bold); };
      const MARGIN_L = 60; const MARGIN_R = 60; const CONTENT_W = width - MARGIN_L - MARGIN_R;
      function wrapByWidth(s: string, size = 12) { const words = s.split(/\s+/); const lines: string[] = []; let cur = ''; for (const w of words) { const test = cur ? cur + ' ' + w : w; const wpx = font.widthOfTextAtSize(test, size); if (wpx <= CONTENT_W) { cur = test; } else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur); return lines; }
      center(church.igreja_nome, 780, 16, true);
      center(`CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, 758, 12);
      let numero = reciboInfo.numero || null;
      const ano = reciboInfo.ano || new Date().getFullYear();
      if (!numero) {
        const { data: nextNumRes, error: nextErr } = await supabase.rpc('next_recibo_num', { _user_id: user.id, _ano: ano });
        if (nextErr) throw nextErr;
        numero = Number(nextNumRes);
        const { error: upLancErr } = await supabase
          .from('lancamentos')
          .update({ recibo_numero: numero, recibo_ano: ano })
          .eq('id', lancamento.id);
        if (upLancErr) throw upLancErr;
        setReciboInfo({ path: reciboInfo.path, numero, ano });
      }
      const numeroFmt = String(numero).padStart(6, '0');
      center(`REEMBOLSO Nº ${numeroFmt}/${ano}`, 730, 14, true);
      const valor = formData.status === 'PAGO' ? parseFloat(formData.valor_pago) || formData.valor : formData.valor;
      const dataStrIso = formData.status === 'PAGO' && formData.data_pagamento ? formData.data_pagamento : formData.vencimento;
      const dataStr = ymdToBr(dataStrIso);
      const corpo = `Recebi da Igreja ${church.igreja_nome} a reembolso no valor de R$ ${Number(valor).toFixed(2)}, ${formData.descricao} na data ${dataStr}.`;
      let y = 700; for (const line of wrapByWidth(corpo, 12)) { drawText(line, MARGIN_L, y, 12, false); y -= 18; }
      let assinaturaImgBytes: Uint8Array | null = null;
      if (reembolsoBenefAssUrl) { const resp = await fetch(reembolsoBenefAssUrl); if (resp.ok) { assinaturaImgBytes = new Uint8Array(await resp.arrayBuffer()); } }
      else if (assinaturaDataUrl) { const b64 = assinaturaDataUrl.split(',')[1]; assinaturaImgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
      else if (assinaturaFile) { assinaturaImgBytes = new Uint8Array(await assinaturaFile.arrayBuffer()); }
      else if (church.assinatura_path) { const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(church.assinatura_path, 300); if (signed?.signedUrl) { const resp = await fetch(signed.signedUrl); if (resp.ok) { const buf = new Uint8Array(await resp.arrayBuffer()); assinaturaImgBytes = buf; } } }
      if (assinaturaImgBytes) { try { const img = await pdfDoc.embedPng(assinaturaImgBytes).catch(async () => pdfDoc.embedJpg(assinaturaImgBytes!)); const imgW = 200; const scale = imgW / img.width; const imgH = img.height * scale; page.drawImage(img, { x: (width - imgW) / 2, y: 620 - imgH, width: imgW, height: imgH }); } catch { void 0; } }
      if (reembolsoBenefName) { center(reembolsoBenefName, 600, 12, true); }
      if (reembolsoBenefDoc) { center(`CPF/CNPJ: ${formatDocAuto(reembolsoBenefDoc)}`, 582, 12, false); }
      if (!reembolsoBenefName) { center(church.responsavel_nome, 600, 12, true); center(`CPF/CNPJ: ${formatDocAuto(church.responsavel_cpf)}`, 582, 12, false); }
      const pdfBytes = await pdfDoc.save();
      const ab = new ArrayBuffer(pdfBytes.byteLength); new Uint8Array(ab).set(pdfBytes);
      const pdfBlob = new Blob([ab], { type: 'application/pdf' });
      setReciboBlob(pdfBlob);
      const url = URL.createObjectURL(pdfBlob);
      setReciboUrl(url);
    } catch (e) {
      toast({ title: 'Erro ao gerar reembolso', description: e instanceof Error ? e.message : 'Falha na geração', variant: 'destructive' });
    } finally {
      setReciboLoading(false);
    }
  }

  async function selecionarBeneficiarioReembolso(id: string) {
    try {
      setReembolsoBenefId(id);
      const name = beneficiarios.find(b => b.id === id)?.name || null;
      setReembolsoBenefName(name);
      let doc: string | null = null;
      const { data: ben } = await supabase.from('beneficiaries').select('documento').eq('id', id).maybeSingle();
      if (ben?.documento) doc = ben.documento;
      setReembolsoBenefDoc(doc);
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
      setReembolsoBenefAssUrl(assUrl);
      await gerarReembolsoPdf();
    } catch {
      await gerarReembolsoPdf();
    }
  }

  async function adicionarReciboComoComprovante() {
    if (!user) return;
    try {
      setAddingComprovante(true);
      let blob: Blob | null = reciboBlob;
      if (!blob && reciboInfo.path) {
        const { data: blobRes } = await supabase.storage.from('Recibos').download(reciboInfo.path);
        if (!blobRes) throw new Error('Falha ao baixar recibo');
        blob = blobRes;
      }
      if (!blob) throw new Error('Arquivo indisponível');
      const destPath = `comprovantes/${user.id}/${lancamento.id}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('Comprovantes')
        .upload(destPath, blob, { cacheControl: '3600', contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('Comprovantes').getPublicUrl(destPath);
      const publicUrl = pub?.publicUrl ?? null;
      if (publicUrl) {
        const { error: upLancErr } = await supabase
          .from('lancamentos')
          .update({ comprovante_url: publicUrl })
          .eq('id', lancamento.id);
        if (upLancErr) throw upLancErr;
        setFormData({ ...formData, comprovante_url: publicUrl });
        toast({ title: 'Comprovante', description: 'Recibo adicionado como comprovante.' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao adicionar comprovante', variant: 'destructive' });
    } finally {
      setAddingComprovante(false);
    }
  }

  const handleNovoBeneficiario = (novoBeneficiario: { id: string; name: string }) => {
    setBeneficiarios(prev => [...prev, novoBeneficiario]);
    setFormData({ ...formData, beneficiario_id: novoBeneficiario.id });
  };

  const handleNovaCategoria = (novaCategoria: { id: string; name: string; tipo: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA' }) => {
    setCategorias(prev => [...prev, novaCategoria]);
    setFormData({ ...formData, categoria_id: novaCategoria.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao || !formData.valor || !formData.vencimento || !formData.categoria_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (formData.status === 'PAGO' && (!formData.data_pagamento || !formData.valor_pago)) {
      toast({
        title: "Erro",
        description: "Para status pago, preencha a data de pagamento e valor pago",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('lancamentos')
        .update({
          categoria_id: formData.categoria_id,
          beneficiario_id: formData.beneficiario_id === 'none' ? null : formData.beneficiario_id,
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          vencimento: formData.vencimento,
          tipo: formData.tipo,
          observacoes: formData.observacoes || null,
          status: formData.status,
          data_pagamento: formData.status === 'PAGO' ? formData.data_pagamento : null,
          valor_pago: formData.status === 'PAGO' ? parseFloat(formData.valor_pago) : null,
          boleto_url: formData.boleto_url || null,
          comprovante_url: formData.comprovante_url || null
        })
        .eq('id', lancamento.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Lançamento atualizado com sucesso!",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao atualizar lançamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar lançamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo - Primeiro campo */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: 'DESPESA' | 'RECEITA') => {
                setFormData({ ...formData, tipo: value, categoria_id: '' });
              }}
              disabled={restrictedEditing}
            >
              <SelectTrigger disabled={isLocked}>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESPESA">Despesa</SelectItem>
                <SelectItem value="RECEITA">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Beneficiário - Segundo campo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="beneficiario">Beneficiário</Label>
              <NovoBeneficiarioModal onSuccess={handleNovoBeneficiario} />
            </div>
            <Select
              value={formData.beneficiario_id}
              onValueChange={(value) => setFormData({ ...formData, beneficiario_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o beneficiário (opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="none">Sem beneficiário</SelectItem>
                {beneficiarios.map((beneficiario) => (
                  <SelectItem key={beneficiario.id} value={beneficiario.id}>
                    {beneficiario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria - Terceiro campo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria *</Label>
              <NovaCategoriaModal onSuccess={handleNovaCategoria} tipoFiltro={formData.tipo} />
            </div>
            <Popover open={openCategoria} onOpenChange={setOpenCategoria}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCategoria}
                  className="w-full justify-between"
                  disabled={isLocked}
                >
                  {formData.categoria_id
                    ? categorias.find((categoria) => categoria.id === formData.categoria_id)?.name
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
                      {categorias
                        .filter(cat => cat.tipo === 'TRANSFERENCIA' || cat.tipo === formData.tipo)
                        .map((categoria) => (
                          <CommandItem
                            key={categoria.id}
                            value={categoria.name}
                            onSelect={() => {
                              setFormData({ ...formData, categoria_id: categoria.id });
                              setOpenCategoria(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.categoria_id === categoria.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {categoria.name}
                            {categoria.name === 'Transferência Interna' ? (
                              <Badge variant="secondary" className="ml-2">Transferência</Badge>
                            ) : null}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Conta de luz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                required
                disabled={isLocked}
              />
            </div>
          </div>

          {/* Vencimento e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                required
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'EM_ABERTO' | 'PAGO' | 'CANCELADO') => setFormData({ ...formData, status: value })}
                disabled={isLocked}
              >
                <SelectTrigger disabled={restrictedEditing}>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos para quando status é PAGO */}
          {formData.status === 'PAGO' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_pagamento">Data de Pagamento *</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_pago">Valor Pago *</Label>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_pago}
                  onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          {/* Upload de Arquivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUpload
              label="Boleto"
              value={formData.boleto_url}
              onChange={(url) => setFormData({ ...formData, boleto_url: url || '' })}
              bucket="boletos"
              folder="boletos"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <FileUpload
              label="Comprovante"
              value={formData.comprovante_url}
              onChange={(url) => setFormData({ ...formData, comprovante_url: url || '' })}
              bucket="Comprovantes"
              folder="comprovantes"
              filenameHint={formData.descricao}
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Recibo ERP</Label>
              {reciboInfo.path ? (
                <Button type="button" variant="outline" onClick={abrirRecibo}>
                  <FileText className="w-4 h-4 mr-2" /> Abrir Recibo
                </Button>
              ) : (
                <Button type="button" variant="default" onClick={gerarRecibo} disabled={loading}>
                  {loading ? 'Gerando...' : 'Gerar Recibo PDF'}
                </Button>
              )}
            </div>

            {!church && (
              <div className="text-sm text-muted-foreground">
                Preencha os dados da igreja para gerar o recibo.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assinatura</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => { setShowAssinaturaPad(true); setTimeout(initCanvas, 0); }}>
                    <PenTool className="w-4 h-4 mr-2" /> Capturar
                  </Button>
                  <Button asChild variant="outline">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => setAssinaturaFile(e.target.files?.[0] || null)} />
                      <ImageIcon className="w-4 h-4 mr-2" /> Enviar Imagem
                    </label>
                  </Button>
                </div>
                {showAssinaturaPad && (
                  <div className="mt-2">
                    <canvas ref={canvasRef} width={400} height={160} className="border rounded bg-white" />
                    <div className="flex items-center gap-2 mt-2">
                      <Button type="button" variant="outline" onClick={() => {
                        const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, c.width, c.height);
                      }}>Limpar</Button>
                      <Button type="button" variant="secondary" onClick={() => {
                        const c = canvasRef.current; if (!c) return; setAssinaturaDataUrl(c.toDataURL('image/png'));
                        setShowAssinaturaPad(false);
                      }}>Usar Assinatura</Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Dados da Igreja</Label>
                {church ? (
                  <div className="text-sm">
                    <div><strong>{church.igreja_nome}</strong></div>
                    <div>CNPJ: {formatCNPJ(church.igreja_cnpj)}</div>
                    <div>Responsável: {church.responsavel_nome}</div>
                    <div>CPF: {formatCPF(church.responsavel_cpf)}</div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600">Dados não configurados</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Reembolso</Label>
              <Button type="button" variant="default" onClick={gerarReembolso} disabled={reciboLoading}>
                {reciboLoading && docType === 'REEMBOLSO' ? 'Gerando...' : 'Gerar Reembolso PDF'}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">Gera um PDF com texto de reembolso e permite adicionar como comprovante.</div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
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
                <Popover open={openBenefReemb} onOpenChange={setOpenBenefReemb}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openBenefReemb} className="w-full justify-between">
                      {reembolsoBenefId ? (beneficiarios.find(b => b.id === reembolsoBenefId)?.name || 'Selecionado') : 'Selecione um beneficiário...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar beneficiário..." value={rbSearch} onValueChange={setRbSearch} />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 flex flex-col items-center gap-2">
                            <span className="text-sm text-muted-foreground">Não encontrado.</span>
                            {rbSearch.length > 2 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8"
                                onClick={async () => {
                                  if (!user) return;
                                  try {
                                    const nome = rbSearch.trim();
                                    const { data, error } = await supabase
                                      .from('beneficiaries')
                                      .insert({ user_id: user.id, name: nome })
                                      .select('id,name')
                                      .single();
                                    if (error) throw error;
                                    setBeneficiarios(prev => [{ id: data.id, name: data.name }, ...prev]);
                                    setOpenBenefReemb(false);
                                    setRbSearch('');
                                    await selecionarBeneficiarioReembolso(data.id);
                                    toast({ title: 'Beneficiário criado', description: data.name });
                                  } catch (err: unknown) {
                                    toast({ title: 'Erro ao criar beneficiário', description: err instanceof Error ? err.message : 'Falha ao criar', variant: 'destructive' });
                                  }
                                }}
                              >
                                {`Criar "${rbSearch}"`}
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {beneficiarios.filter(b => b.name.toLowerCase().includes(rbSearch.toLowerCase())).map(b => (
                            <CommandItem key={b.id} value={b.name} onSelect={() => { setOpenBenefReemb(false); selecionarBeneficiarioReembolso(b.id); }}>
                              <Check className={cn("mr-2 h-4 w-4", reembolsoBenefId === b.id ? "opacity-100" : "opacity-0")} />
                              {b.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!reembolsoBenefId && (
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
                <Button type="button" onClick={adicionarReciboComoComprovante} disabled={addingComprovante || !!formData.comprovante_url || (docType === 'REEMBOLSO' && !reembolsoBenefId)}>
                  {addingComprovante ? 'Adicionando...' : (formData.comprovante_url ? 'Comprovante já definido' : 'Adicionar como comprovante')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </>
  );
};

export default EditarLancamentoDialog;
