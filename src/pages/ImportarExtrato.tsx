import { useEffect, useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type LinhaPreview = {
  idx: number;
  data: string | null;
  descricao: string | null;
  credito: number | null;
  debito: number | null;
  tipo: "ENTRADA" | "SAIDA" | null;
  valor: number | null;
  valido: boolean;
  erro?: string;
  selecionado: boolean;
};

function normalizarValor(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s || s === "0" || s === "0,00") return null;
  const n = Number(s.replace(/\./g, "").replace(/,/g, "."));
  return isNaN(n) ? null : n;
}

function normalizarDataPT(s: unknown): string | null {
  if (!s) return null;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const mkYmd = (ano: number, mes: number, dia: number) => {
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;
    if (ano < 1900 || ano > 2100) return null;
    if (mes < 1 || mes > 12) return null;
    if (dia < 1 || dia > 31) return null;
    return `${ano}-${pad2(mes)}-${pad2(dia)}`;
  };
  if (s instanceof Date) {
    const d = s as Date;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  }
  const txt = String(s).trim();
  const isoWithOptionalTime = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoWithOptionalTime) {
    return mkYmd(Number(isoWithOptionalTime[1]), Number(isoWithOptionalTime[2]), Number(isoWithOptionalTime[3]));
  }
  const brWithOptionalTime = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (brWithOptionalTime) {
    return mkYmd(Number(brWithOptionalTime[3]), Number(brWithOptionalTime[2]), Number(brWithOptionalTime[1]));
  }
  const brShortYear = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s.*)?$/);
  if (brShortYear) {
    const yy = Number(brShortYear[3]);
    const ano = yy >= 70 ? 1900 + yy : 2000 + yy;
    return mkYmd(ano, Number(brShortYear[2]), Number(brShortYear[1]));
  }
  const dashDMY = txt.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s.*)?$/);
  if (dashDMY) {
    return mkYmd(Number(dashDMY[3]), Number(dashDMY[2]), Number(dashDMY[1]));
  }
  const slashYMD = txt.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s.*)?$/);
  if (slashYMD) {
    return mkYmd(Number(slashYMD[1]), Number(slashYMD[2]), Number(slashYMD[3]));
  }
  // Ex.: "Sexta, 28 de fevereiro de 2025"
  const m = txt.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (m) {
    const dia = Number(m[1]);
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const nome = m[2].toLowerCase();
    const mes = meses.indexOf(nome);
    const ano = Number(m[3]);
    if (mes >= 0) {
      return new Date(Date.UTC(ano, mes, dia)).toISOString().slice(0, 10);
    }
  }
  // Tenta parse padrão Excel como número de série
  const maybeNum = Number(txt);
  if (!isNaN(maybeNum) && maybeNum > 30000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + maybeNum * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export default function ImportarExtrato() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaPreview[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contaId, setContaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [permitirDuplicados, setPermitirDuplicados] = useState(true);
  const [church, setChurch] = useState<{ igreja_nome: string; igreja_cnpj: string; responsavel_nome: string; responsavel_cpf: string; assinatura_path?: string | null } | null>(null);
  const [beneficiarios, setBeneficiarios] = useState<{ id: string; name: string; documento: string | null; assinatura_path: string | null }[]>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("contas_financeiras")
      .select("id,nome")
      .order("nome")
      .then(({ data, error }) => {
        if (error) return;
        const arr: { id: string; nome: string }[] = [];
        if (Array.isArray(data)) {
          for (const c of data) {
            const id = (c as Record<string, unknown>)?.id;
            const nome = (c as Record<string, unknown>)?.nome;
            if (typeof id === "string" && typeof nome === "string") arr.push({ id, nome });
          }
        }
      setContas(arr);
    });
    supabase
      .from('church_settings')
      .select('igreja_nome, igreja_cnpj, responsavel_nome, responsavel_cpf, assinatura_path')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setChurch({ igreja_nome: data.igreja_nome, igreja_cnpj: data.igreja_cnpj, responsavel_nome: data.responsavel_nome, responsavel_cpf: data.responsavel_cpf, assinatura_path: data.assinatura_path });
      });
    supabase
      .from('beneficiaries')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => {
        if (Array.isArray(data)) {
          const arr = data as { id: string; name: string; documento: string | null; assinatura_path: string | null }[];
          setBeneficiarios(arr);
        }
      });
  }, [user]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setLinhas([]);
    if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown as unknown[][];

    // Encontrar linha de cabeçalho real
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const r = rows[i].map((x: unknown) => String(x ?? "").toLowerCase());
      if (r.some((c: string) => c.includes("data")) && r.some((c: string) => c.includes("descri"))) {
        if (r.some((c: string) => c.includes("crédito")) || r.some((c: string) => c.includes("credito"))) {
          headerRowIdx = i;
          break;
        }
      }
    }
    if (headerRowIdx < 0) {
      toast({ title: "Cabeçalho não encontrado", description: "Verifique se a planilha tem as colunas Data, Descrição, Crédito, Débito", variant: "destructive" });
      return;
    }

    const header = rows[headerRowIdx].map((x: unknown) => String(x ?? "").trim());
    const idxData = header.findIndex((h: string) => h.toLowerCase().includes("data"));
    const idxDesc = header.findIndex((h: string) => h.toLowerCase().includes("descri"));
    const idxCred = header.findIndex((h: string) => h.toLowerCase().includes("crédito") || h.toLowerCase().includes("credito"));
    const idxDeb = header.findIndex((h: string) => h.toLowerCase().includes("débito") || h.toLowerCase().includes("debito"));
    const parsed: LinhaPreview[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const data = normalizarDataPT(r[idxData]);
      const descricao = r[idxDesc] != null ? String(r[idxDesc]).trim() : null;
      const credito = normalizarValor(r[idxCred]);
      const debito = normalizarValor(r[idxDeb]);
      let tipo: "ENTRADA" | "SAIDA" | null = null;
      let valor: number | null = null;
      if (credito && !debito) { tipo = "ENTRADA"; valor = credito; }
      else if (debito && !credito) { tipo = "SAIDA"; valor = debito; }
      const valido = Boolean(data && descricao && valor && tipo);
      if (!data && !descricao && !credito && !debito) continue; // pula linhas vazias
      parsed.push({ idx: i, data, descricao, credito, debito, tipo, valor, valido, selecionado: valido, erro: valido ? undefined : "Linha incompleta" });
    }
    setLinhas(parsed);
  }

  const resumo = useMemo(() => {
    const sel = linhas.filter(l => l.selecionado && l.valido);
    const entradas = sel.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + (l.valor || 0), 0);
    const saídas = sel.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + (l.valor || 0), 0);
    return { totalSelecionado: sel.length, entradas, saídas };
  }, [linhas]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  async function importarSelecionados() {
    if (!user) { toast({ title: "Sessão", description: "Você precisa estar logado" }); return; }
    if (!supabase) { toast({ title: "Ambiente", description: "Supabase não configurado", variant: "destructive" }); return; }
    if (!contaId) { toast({ title: "Conta financeira", description: "Selecione a conta", variant: "destructive" }); return; }
    let selecionadas = linhas.filter(l => l.selecionado && l.valido);

    // Deduplicação básica por conjunto (data|valor|descricao) no intervalo selecionado
    if (!permitirDuplicados && selecionadas.length > 0) {
      const minData = selecionadas.map(l => l.data!).sort()[0];
      const maxData = selecionadas.map(l => l.data!).sort().slice(-1)[0];
      const { data: existentes } = await supabase
        .from('movimentos_financeiros')
        .select('id,data,valor,descricao')
        .eq('conta_id', contaId)
        .gte('data', minData)
        .lte('data', maxData);
      const setKeys = new Set<string>();
      if (Array.isArray(existentes)) {
        for (const r of existentes) {
          const obj = r as Record<string, unknown>;
          const d = String(obj.data ?? '');
          const vNum = typeof obj.valor === 'number' ? obj.valor : Number(obj.valor as unknown as string);
          const desc = typeof obj.descricao === 'string' ? obj.descricao.toLowerCase().trim() : '';
          if (d && !isNaN(vNum)) {
            setKeys.add(`${d}|${vNum.toFixed(2)}|${desc}`);
          }
        }
      }
      const antes = selecionadas.length;
      selecionadas = selecionadas.filter(l => !setKeys.has(`${l.data}|${(l.valor || 0).toFixed(2)}|${String(l.descricao || '').toLowerCase().trim()}`));
      const removidos = antes - selecionadas.length;
      if (removidos > 0) {
        toast({ title: 'Duplicados ignorados', description: `${removidos} linhas já existiam e foram removidas do envio.` });
      }
    }

    const registros = selecionadas.map(l => ({
      user_id: user.id,
      conta_id: contaId,
      data: l.data!,
      tipo: l.tipo!,
      valor: l.valor!,
      descricao: l.descricao,
      origem: permitirDuplicados ? "EXTRATO" : "AJUSTE",
    }));
    if (registros.length === 0) { toast({ title: "Nada para importar" }); return; }
    setLoading(true);
    try {
      let inseridos = 0;
      let duplicados = 0;
      for (const rec of registros) {
        const payload = {
          user_id: rec.user_id,
          conta_id: rec.conta_id,
          data: rec.data,
          tipo: rec.tipo,
          valor: rec.valor,
          descricao: rec.descricao ?? null,
          origem: permitirDuplicados ? "EXTRATO" : "AJUSTE",
        };
        const { error } = await supabase.from("movimentos_financeiros").insert(payload);
        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("duplicate key value") || msg.includes("violates unique constraint")) {
            duplicados++;
            continue;
          }
          throw error;
        }
        inseridos++;
      }
      toast({ title: "Importação concluída", description: `${inseridos} novos movimentos. Duplicados ignorados: ${duplicados}.` });
      setLinhas([]);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

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

  function norm(s: string | null | undefined) {
    const base = String(s || '').toLowerCase();
    return base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-.,;:/_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function gerarRecibosSaidasSelecionadas() {
    try {
      if (!user) { toast({ title: 'Sessão', description: 'Você precisa estar logado', variant: 'destructive' }); return; }
      if (!church) { toast({ title: 'Configuração necessária', description: 'Preencha os dados da igreja em Configurações' }); return; }
      const selecionadas = linhas.filter(l => l.selecionado && l.valido && l.tipo === 'SAIDA');
      if (selecionadas.length === 0) { toast({ title: 'Seleção vazia', description: 'Marque saídas válidas para gerar recibo' }); return; }
      for (const l of selecionadas) {
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
        let yHeader = height - 40;
        center(church.igreja_nome, yHeader, 16, true);
        yHeader -= 22;
        center(`CNPJ: ${formatCNPJ(church.igreja_cnpj)}`, yHeader, 12);
        const valor = Number(l.valor || 0);
        const dataStr = l.data || '';
        const desc = String(l.descricao || '').trim() || 'Movimento Financeiro';
        const corpo = `Recebi da Igreja ${church.igreja_nome} a quantia de ${formatCurrency(valor)}, "${desc}" na data ${dataStr}.`;
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
        let y = yHeader - 40;
        for (const line of wrapByWidth(corpo, 12)) { drawText(line, MARGIN_L, y, 12, false); y -= 18; }
        let yNome = y - 24;
        let signerName: string | null = null;
        let signerDoc: string | null = null;
        let signerPath: string | null = null;
        const rdesc = norm(desc);
        let chosen: { id: string; name: string; documento: string | null; assinatura_path: string | null } | null = null;
        for (const b of beneficiarios) {
          const bn = norm(b.name);
          if (!bn) continue;
          if (rdesc.includes(bn) || bn.includes(rdesc)) { chosen = b; break; }
          const rnTokens = rdesc.split(' ').filter(Boolean);
          const bnTokens = bn.split(' ').filter(Boolean);
          const overlap = rnTokens.filter(t => bnTokens.includes(t));
          if (overlap.length >= 2) { chosen = b; break; }
        }
        if (chosen) {
          signerName = chosen.name || null;
          signerDoc = chosen.documento || null;
          signerPath = chosen.assinatura_path || null;
          if (!signerPath && user) {
            const folder = `assinaturas/${user.id}/beneficiarios`;
            const { data: files } = await supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
            const match = (files || []).find(f => f.name.startsWith(`${chosen.id}-`));
            if (match) signerPath = `${folder}/${match.name}`;
          }
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
        const pdfBytes = await pdfDoc.save();
        const ab = new ArrayBuffer(pdfBytes.byteLength);
        new Uint8Array(ab).set(pdfBytes);
        const pdfBlob = new Blob([ab], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        window.open(url, '_blank');
      }
      toast({ title: 'Recibos gerados', description: `${selecionadas.length} recibo(s) aberto(s)` });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao gerar recibo', variant: 'destructive' });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Importar Extrato (.xlsx)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label>Arquivo Excel (.xlsx)</Label>
              <Input type="file" accept=".xlsx" onChange={onFileChange} />
            </div>
            <div>
              <Label>Conta financeira</Label>
              <select className="w-full border rounded-md h-10 px-3" value={contaId} onChange={e => setContaId(e.target.value)}>
                <option value="">Selecione...</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="default" onClick={gerarRecibosSaidasSelecionadas} disabled={!linhas.some(l => l.selecionado && l.valido && l.tipo === 'SAIDA')}>
              Gerar Recibo (saídas selecionadas)
            </Button>
          </div>

            {linhas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 font-bold">
                  <div>Selecionados: {resumo.totalSelecionado}</div>
                  <div>Entradas: {formatCurrency(resumo.entradas)}</div>
                  <div>Saídas: {formatCurrency(resumo.saídas)}</div>
                  <label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={permitirDuplicados}
                      onCheckedChange={(v) => setPermitirDuplicados(Boolean(v))}
                    />
                    Permitir duplicados
                  </label>
                </div>
                <div className="overflow-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2">✔</th>
                        <th className="p-2">Data</th>
                        <th className="p-2">Descrição</th>
                        <th className="p-2">Crédito</th>
                        <th className="p-2">Débito</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Valor</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l, i) => (
                        <tr key={i} className={!l.valido ? "bg-red-50" : undefined}>
                          <td className="p-2 text-center">
                            <Checkbox checked={l.selecionado} onCheckedChange={(v) => {
                              const c = Boolean(v);
                              setLinhas(prev => prev.map((x, idx) => idx === i ? { ...x, selecionado: c } : x));
                            }} />
                          </td>
                          <td className="p-2">{l.data || ""}</td>
                          <td className="p-2">{l.descricao || ""}</td>
                          <td className="p-2">{l.credito != null ? formatCurrency(l.credito) : ""}</td>
                          <td className="p-2">{l.debito != null ? formatCurrency(l.debito) : ""}</td>
                          <td className="p-2">{l.tipo || ""}</td>
                          <td className="p-2">{l.valor != null ? formatCurrency(l.valor) : ""}</td>
                          <td className="p-2">{l.valido ? "OK" : l.erro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <Button disabled={loading || !contaId} onClick={importarSelecionados}>Importar selecionados</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card >
      </div >
    </div >
  );
}
