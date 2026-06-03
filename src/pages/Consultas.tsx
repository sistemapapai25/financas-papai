import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { ymdToBr, todayYMD } from "@/utils/date";
import { Search, FileText, Download, Filter, Check, ChevronsUpDown, BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Linha = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  conta_id: string | null;
  conta_nome: string | null;
  conta_logo: string | null;
  categoria_nome: string | null;
  beneficiario_nome: string | null;
};

type Opcao = { id: string; name: string };
type Tipo = "TODOS" | "ENTRADA" | "SAIDA";
type Agrupamento = "NENHUM" | "BENEFICIARIO" | "CATEGORIA" | "MES";
type Ordenacao = { campo: "data" | "valor"; dir: "asc" | "desc" };

const TRANSFER_CAT = "Transferência Interna";
const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function formatCNPJ(s: string | null | undefined) {
  const d = String(s ?? "").replace(/\D+/g, "").slice(0, 14);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = "";
  if (p[0]) out += p[0];
  if (p[1]) out += "." + p[1];
  if (p[2]) out += "." + p[2];
  if (p[3]) out += "/" + p[3];
  if (p[4]) out += "-" + p[4];
  return out;
}

function ContaIcone({ nome, logo }: { nome: string | null; logo: string | null }) {
  if (logo) {
    return <img src={logo} alt={nome || ""} title={nome || ""} className="w-6 h-6 object-contain rounded inline-block" />;
  }
  return (
    <span title={nome || ""} className="inline-flex items-center justify-center w-6 h-6 rounded bg-muted text-[10px] font-semibold">
      {(nome || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function ComboFiltro({ value, onChange, options, placeholder, emptyLabel }: { value: string; onChange: (v: string) => void; options: Opcao[]; placeholder: string; emptyLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              <CommandItem value="__todos__" onSelect={() => { onChange(""); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                {placeholder}
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o.id} value={o.name} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Consultas() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [beneficiarioId, setBeneficiarioId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("TODOS");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [textoDesc, setTextoDesc] = useState("");
  const [excluirTransf, setExcluirTransf] = useState(true);

  const [contas, setContas] = useState<Opcao[]>([]);
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<Opcao[]>([]);
  const [church, setChurch] = useState<{ igreja_nome: string; igreja_cnpj: string } | null>(null);

  const [resultado, setResultado] = useState<Linha[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limiteAtingido, setLimiteAtingido] = useState(false);

  const [agrupamento, setAgrupamento] = useState<Agrupamento>("NENHUM");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: "data", dir: "desc" });
  const [pdfBusy, setPdfBusy] = useState(false);

  const LIMITE = 1000;

  useEffect(() => {
    if (!user) return;
    supabase.from("contas_financeiras").select("id,nome").eq("ativo", true).order("nome").then(({ data }) => {
      if (data) setContas(data.map((c) => ({ id: c.id, name: c.nome })));
    });
    supabase.from("categories").select("id,name,parent_id").order("name").then(({ data }) => {
      if (data) setCategorias(data.filter((c) => c.parent_id !== null).map((c) => ({ id: c.id, name: c.name })));
    });
    supabase.from("beneficiaries").select("id,name").order("name").then(({ data }) => {
      if (data) setBeneficiarios(data);
    });
    supabase.from("church_settings").select("igreja_nome,igreja_cnpj,user_id,updated_at").order("updated_at", { ascending: false }).then(({ data }) => {
      const sel = (data || []).find((x) => x.user_id === user.id) || (data || [])[0];
      if (sel) setChurch({ igreja_nome: sel.igreja_nome, igreja_cnpj: sel.igreja_cnpj });
    });
  }, [user]);

  function periodoRapido(tipo: "MES" | "ANO" | "D90" | "TUDO") {
    const hoje = new Date();
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (tipo === "TUDO") { setDataDe(""); setDataAte(""); return; }
    if (tipo === "MES") {
      setDataDe(ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setDataAte(ymd(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
      return;
    }
    if (tipo === "ANO") {
      setDataDe(`${hoje.getFullYear()}-01-01`);
      setDataAte(`${hoje.getFullYear()}-12-31`);
      return;
    }
    if (tipo === "D90") {
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - 90);
      setDataDe(ymd(ini));
      setDataAte(todayYMD());
    }
  }

  function limparFiltros() {
    setDataDe(""); setDataAte(""); setContaId(""); setCategoriaId(""); setBeneficiarioId("");
    setTipo("TODOS"); setValorMin(""); setValorMax(""); setTextoDesc(""); setExcluirTransf(true);
    setResultado([]); setBuscou(false); setLimiteAtingido(false);
  }

  async function buscar() {
    if (!user || roleLoading) return;
    setLoading(true);
    setLimiteAtingido(false);
    try {
      let q = supabase
        .from("movimentos_financeiros")
        .select("id, user_id, data, descricao, valor, tipo, conta_id, categoria_id, beneficiario_id, contas:contas_financeiras(nome,logo), categoria:categories(name), beneficiario:beneficiaries(name)")
        .order("data", { ascending: false })
        .limit(LIMITE);
      if (!isAdmin) q = q.eq("user_id", user.id);
      if (dataDe) q = q.gte("data", dataDe);
      if (dataAte) q = q.lte("data", dataAte);
      if (contaId) q = q.eq("conta_id", contaId);
      if (categoriaId) q = q.eq("categoria_id", categoriaId);
      if (beneficiarioId) q = q.eq("beneficiario_id", beneficiarioId);
      if (tipo !== "TODOS") q = q.eq("tipo", tipo);
      const vMin = Number(String(valorMin).replace(",", "."));
      const vMax = Number(String(valorMax).replace(",", "."));
      if (valorMin && Number.isFinite(vMin)) q = q.gte("valor", vMin);
      if (valorMax && Number.isFinite(vMax)) q = q.lte("valor", vMax);
      if (textoDesc.trim()) q = q.ilike("descricao", `%${textoDesc.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;

      let linhas: Linha[] = (data || []).map((r) => ({
        id: r.id,
        data: r.data,
        descricao: r.descricao ?? null,
        valor: Number(r.valor || 0),
        tipo: r.tipo as Linha["tipo"],
        conta_id: r.conta_id ?? null,
        conta_nome: r.contas?.nome ?? null,
        conta_logo: r.contas?.logo ?? null,
        categoria_nome: r.categoria?.name ?? null,
        beneficiario_nome: r.beneficiario?.name ?? null,
      }));
      if (excluirTransf) linhas = linhas.filter((l) => l.categoria_nome !== TRANSFER_CAT);

      setResultado(linhas);
      setBuscou(true);
      setLimiteAtingido((data || []).length >= LIMITE);
    } catch (e: unknown) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao consultar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const totais = useMemo(() => {
    const entradas = resultado.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
    const saidas = resultado.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
    return { count: resultado.length, entradas, saidas, liquido: entradas - saidas };
  }, [resultado]);

  const resultadoOrdenado = useMemo(() => {
    const arr = [...resultado];
    arr.sort((a, b) => {
      let cmp = 0;
      if (ordenacao.campo === "data") cmp = a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
      else cmp = a.valor - b.valor;
      return ordenacao.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [resultado, ordenacao]);

  const grupos = useMemo(() => {
    if (agrupamento === "NENHUM") return null;
    const map = new Map<string, { chave: string; itens: Linha[]; entradas: number; saidas: number }>();
    for (const l of resultadoOrdenado) {
      let chave = "—";
      if (agrupamento === "BENEFICIARIO") chave = l.beneficiario_nome || "(sem beneficiário)";
      else if (agrupamento === "CATEGORIA") chave = l.categoria_nome || "(sem categoria)";
      else if (agrupamento === "MES") {
        const [y, m] = l.data.split("-");
        chave = `${mesesPt[Number(m) - 1] ?? m}/${y}`;
      }
      const g = map.get(chave) || { chave, itens: [], entradas: 0, saidas: 0 };
      g.itens.push(l);
      if (l.tipo === "ENTRADA") g.entradas += l.valor; else g.saidas += l.valor;
      map.set(chave, g);
    }
    return Array.from(map.values()).sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));
  }, [resultadoOrdenado, agrupamento]);

  function toggleOrden(campo: "data" | "valor") {
    setOrdenacao((prev) => prev.campo === campo ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" } : { campo, dir: "desc" });
  }

  function resumoFiltros(): string {
    const partes: string[] = [];
    if (dataDe || dataAte) partes.push(`Período: ${dataDe ? ymdToBr(dataDe) : "início"} a ${dataAte ? ymdToBr(dataAte) : "hoje"}`);
    if (beneficiarioId) partes.push(`Beneficiário: ${beneficiarios.find((b) => b.id === beneficiarioId)?.name ?? ""}`);
    if (categoriaId) partes.push(`Categoria: ${categorias.find((c) => c.id === categoriaId)?.name ?? ""}`);
    if (contaId) partes.push(`Conta: ${contas.find((c) => c.id === contaId)?.name ?? ""}`);
    if (tipo !== "TODOS") partes.push(`Tipo: ${tipo === "ENTRADA" ? "Entradas" : "Saídas"}`);
    if (valorMin) partes.push(`Valor ≥ ${formatCurrency(Number(valorMin.replace(",", ".")))}`);
    if (valorMax) partes.push(`Valor ≤ ${formatCurrency(Number(valorMax.replace(",", ".")))}`);
    if (textoDesc.trim()) partes.push(`Descrição contém "${textoDesc.trim()}"`);
    if (excluirTransf) partes.push("sem transferências internas");
    return partes.length ? partes.join(" · ") : "Todos os lançamentos";
  }

  function exportarCSV() {
    if (resultado.length === 0) return;
    const sep = ";";
    const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["Data", "Beneficiário", "Categoria", "Conta", "Descrição", "Tipo", "Valor"].join(sep),
      ...resultadoOrdenado.map((l) => [
        ymdToBr(l.data),
        esc(l.beneficiario_nome || ""),
        esc(l.categoria_nome || ""),
        esc(l.conta_nome || ""),
        esc(l.descricao || ""),
        l.tipo === "ENTRADA" ? "Entrada" : "Saída",
        String(l.valor.toFixed(2)).replace(".", ","),
      ].join(sep)),
    ];
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consulta-${todayYMD()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarPDF() {
    if (resultado.length === 0) return;
    setPdfBusy(true);
    try {
      const pdfText = (s: string | null | undefined) => {
        const cleaned = String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
        let out = "";
        for (const ch of cleaned) if (ch.charCodeAt(0) <= 0xff) out += ch;
        return out;
      };
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const PAGE_W = 841.89, PAGE_H = 595.28; // A4 paisagem
      const M = 36;
      const RIGHT = PAGE_W - M;
      const colData = M;
      const colBenef = M + 60;
      const colCat = M + 215;
      const colDesc = M + 350;
      const colValorR = RIGHT;

      const drawText = (p: typeof page, text: string, x: number, yy: number, size = 9, bold = false) => {
        p.drawText(pdfText(text), { x, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      };
      const drawRight = (p: typeof page, text: string, xR: number, yy: number, size = 9, bold = false) => {
        const t = pdfText(text);
        const w = (bold ? fontBold : font).widthOfTextAtSize(t, size);
        p.drawText(t, { x: xR - w, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      };
      const center = (p: typeof page, text: string, yy: number, size: number, bold = false) => {
        const t = pdfText(text);
        const w = (bold ? fontBold : font).widthOfTextAtSize(t, size);
        p.drawText(t, { x: (PAGE_W - w) / 2, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      };
      const trunc = (text: string, maxW: number, size = 9) => {
        let t = pdfText(text);
        if (font.widthOfTextAtSize(t, size) <= maxW) return t;
        while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
        return t + "...";
      };
      const drawHeader = (p: typeof page) => {
        let yy = PAGE_H - M;
        if (church?.igreja_nome) { center(p, church.igreja_nome, yy, 13, true); yy -= 15; }
        if (church?.igreja_cnpj) { center(p, `CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, yy, 9); yy -= 14; }
        yy -= 4;
        center(p, "CONSULTA DE LANÇAMENTOS", yy, 12, true); yy -= 14;
        for (const linha of wrapFiltros(resumoFiltros(), PAGE_W - 2 * M, 8)) { center(p, linha, yy, 8); yy -= 11; }
        yy -= 4;
        drawText(p, "Data", colData, yy, 9, true);
        drawText(p, "Beneficiário", colBenef, yy, 9, true);
        drawText(p, "Categoria", colCat, yy, 9, true);
        drawText(p, "Descrição", colDesc, yy, 9, true);
        drawRight(p, "Valor", colValorR, yy, 9, true);
        yy -= 5;
        p.drawLine({ start: { x: M, y: yy }, end: { x: RIGHT, y: yy }, thickness: 0.5, color: rgb(0, 0, 0) });
        return yy - 13;
      };
      function wrapFiltros(s: string, maxW: number, size: number) {
        const words = pdfText(s).split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? cur + " " + w : w;
          if (font.widthOfTextAtSize(test, size) <= maxW) cur = test;
          else { if (cur) lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        return lines.slice(0, 3);
      }

      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let y = drawHeader(page);
      const rowH = 13;
      const bottom = M + 40;
      const valStr = (l: Linha) => `${l.tipo === "SAIDA" ? "-" : ""}${formatCurrency(l.valor)}`;

      const linhasPdf = resultadoOrdenado;
      for (const l of linhasPdf) {
        if (y < bottom) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = drawHeader(page); }
        drawText(page, ymdToBr(l.data), colData, y, 9);
        drawText(page, trunc(l.beneficiario_nome || "-", colCat - colBenef - 6), colBenef, y, 9);
        drawText(page, trunc(l.categoria_nome || "-", colDesc - colCat - 6), colCat, y, 9);
        drawText(page, trunc(l.descricao || "-", colValorR - 70 - colDesc), colDesc, y, 9);
        drawRight(page, valStr(l), colValorR, y, 9);
        y -= rowH;
      }

      if (y < bottom + 24) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = drawHeader(page); }
      y -= 4;
      page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 0.5, color: rgb(0, 0, 0) });
      y -= 14;
      drawText(page, `Lançamentos: ${totais.count}`, colData, y, 9, true);
      drawText(page, `Entradas: ${formatCurrency(totais.entradas)}`, colBenef, y, 9, true);
      drawText(page, `Saídas: ${formatCurrency(totais.saidas)}`, colCat, y, 9, true);
      drawRight(page, `Líquido: ${formatCurrency(totais.liquido)}`, colValorR, y, 10, true);

      const geradoEm = new Date().toLocaleString("pt-BR");
      const pages = pdfDoc.getPages();
      pages.forEach((p, i) => {
        drawText(p, `Gerado em ${geradoEm}`, M, 20, 8);
        drawRight(p, `Página ${i + 1} de ${pages.length}`, RIGHT, 20, 8);
      });

      const bytes = await pdfDoc.save();
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const blob = new Blob([ab], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: unknown) {
      toast({ title: "Erro ao gerar PDF", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  }

  const setaOrd = (campo: "data" | "valor") => ordenacao.campo === campo ? (ordenacao.dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Consultas</h1>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="w-4 h-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => periodoRapido("MES")}>Este mês</Button>
            <Button size="sm" variant="secondary" onClick={() => periodoRapido("ANO")}>Este ano</Button>
            <Button size="sm" variant="secondary" onClick={() => periodoRapido("D90")}>Últimos 90 dias</Button>
            <Button size="sm" variant="secondary" onClick={() => periodoRapido("TUDO")}>Tudo</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <Label>Data inicial</Label>
              <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
            </div>
            <div>
              <Label>Data final</Label>
              <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
            </div>
            <div>
              <Label>Beneficiário</Label>
              <ComboFiltro value={beneficiarioId} onChange={setBeneficiarioId} options={beneficiarios} placeholder="Todos os beneficiários" emptyLabel="Nenhum beneficiário" />
            </div>
            <div>
              <Label>Categoria</Label>
              <ComboFiltro value={categoriaId} onChange={setCategoriaId} options={categorias} placeholder="Todas as categorias" emptyLabel="Nenhuma categoria" />
            </div>
            <div>
              <Label>Conta</Label>
              <ComboFiltro value={contaId} onChange={setContaId} options={contas} placeholder="Todas as contas" emptyLabel="Nenhuma conta" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="ENTRADA">Entradas</SelectItem>
                  <SelectItem value="SAIDA">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor mínimo</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
            </div>
            <div>
              <Label>Valor máximo</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição contém</Label>
              <Input placeholder="texto na descrição" value={textoDesc} onChange={(e) => setTextoDesc(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={excluirTransf} onChange={(e) => setExcluirTransf(e.target.checked)} />
                Excluir transferências internas
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={buscar} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Buscando..." : "Buscar"}
            </Button>
            <Button variant="outline" onClick={limparFiltros}>
              <X className="w-4 h-4 mr-2" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {buscou && (
        <>
          {/* Cartão-resposta */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Lançamentos</span>
                  <span className="text-xl font-bold">{totais.count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Entradas</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(totais.entradas)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Saídas</span>
                  <span className="text-xl font-bold text-red-600">{formatCurrency(totais.saidas)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Líquido</span>
                  <span className={`text-xl font-bold ${totais.liquido >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatCurrency(totais.liquido)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{resumoFiltros()}</p>
              {limiteAtingido && (
                <p className="mt-1 text-xs text-amber-600">Atenção: a consulta atingiu o limite de {LIMITE} resultados. Refine os filtros (ex.: período) para ver tudo.</p>
              )}
            </CardContent>
          </Card>

          {/* Controles de exibição */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm text-muted-foreground">Agrupar por</span>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NENHUM">Sem agrupamento</SelectItem>
                <SelectItem value="BENEFICIARIO">Beneficiário</SelectItem>
                <SelectItem value="CATEGORIA">Categoria</SelectItem>
                <SelectItem value="MES">Mês</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={exportarPDF} disabled={pdfBusy || resultado.length === 0}>
              <FileText className="w-4 h-4 mr-2" /> {pdfBusy ? "Gerando..." : "PDF"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV} disabled={resultado.length === 0}>
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
          </div>

          {resultado.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum lançamento encontrado para esses filtros.</CardContent></Card>
          ) : grupos ? (
            <div className="space-y-4">
              {grupos.map((g) => (
                <Card key={g.chave}>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between bg-muted px-3 py-2 rounded-t">
                      <span className="font-semibold">{g.chave} <span className="text-muted-foreground font-normal">({g.itens.length})</span></span>
                      <span className="text-sm">
                        {g.entradas > 0 && <span className="text-blue-600 mr-3">{formatCurrency(g.entradas)}</span>}
                        {g.saidas > 0 && <span className="text-red-600">-{formatCurrency(g.saidas)}</span>}
                      </span>
                    </div>
                    <table className="min-w-full text-sm">
                      <tbody>
                        {g.itens.map((l) => (
                          <tr key={l.id} className="border-t">
                            <td className="p-2 text-center w-10"><ContaIcone nome={l.conta_nome} logo={l.conta_logo} /></td>
                            <td className="p-2 w-24">{ymdToBr(l.data)}</td>
                            <td className="p-2">{l.descricao || <span className="text-muted-foreground italic">—</span>}</td>
                            <td className="p-2 text-muted-foreground hidden md:table-cell">{agrupamento === "CATEGORIA" ? (l.beneficiario_nome || "") : (l.categoria_nome || "")}</td>
                            <td className={`p-2 text-right w-32 ${l.tipo === "ENTRADA" ? "text-blue-600" : "text-red-600"}`}>{l.tipo === "SAIDA" ? "-" : ""}{formatCurrency(l.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-auto rounded border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-center w-10">Conta</th>
                    <th className="p-2 text-left cursor-pointer select-none" onClick={() => toggleOrden("data")}>Data{setaOrd("data")}</th>
                    <th className="p-2 text-left">Beneficiário</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleOrden("valor")}>Valor{setaOrd("valor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadoOrdenado.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2 text-center"><ContaIcone nome={l.conta_nome} logo={l.conta_logo} /></td>
                      <td className="p-2 whitespace-nowrap">{ymdToBr(l.data)}</td>
                      <td className="p-2">{l.beneficiario_nome || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-2">{l.categoria_nome || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-2">{l.descricao || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className={`p-2 text-right whitespace-nowrap ${l.tipo === "ENTRADA" ? "text-blue-600" : "text-red-600"}`}>{l.tipo === "SAIDA" ? "-" : ""}{formatCurrency(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!buscou && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Defina os filtros e clique em <strong>Buscar</strong>. Ex.: selecione o beneficiário "Plackcenter" e período "Tudo" para ver todos os pagamentos e o total.</CardContent></Card>
      )}
    </div>
  );
}
