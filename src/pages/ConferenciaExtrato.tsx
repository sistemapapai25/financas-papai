import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ListChecks,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Conta = {
  id: string;
  user_id: string | null;
  nome: string;
  saldo_inicial: number;
  saldo_inicial_em: string | null;
};
type Categoria = { id: string; nome: string; tipo: string | null };
type Beneficiario = { id: string; nome: string };
type Movimento = {
  id: string;
  data: string;
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  descricao: string | null;
  conferido: boolean;
};

type Filtro = "TODOS" | "PENDENTES" | "CONFERIDOS";

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const fmtData = (ymd: string | null | undefined) => {
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : ymd;
};

const meses = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ConferenciaExtrato() {
  const { user } = useAuth();
  const { toast } = useToast();

  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth());

  const [contas, setContas] = useState<Conta[]>([]);
  const [contaId, setContaId] = useState<string>("");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);

  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [movimentosAnterioresSoma, setMovimentosAnterioresSoma] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("PENDENTES");
  const [saldoFinalExtrato, setSaldoFinalExtrato] = useState<string>("");
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set());

  // PDF
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfExists, setPdfExists] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Dialog "Novo lançamento"
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoData, setNovoData] = useState<string>("");
  const [novoTipo, setNovoTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [novoValor, setNovoValor] = useState<string>("");
  const [novoDescricao, setNovoDescricao] = useState<string>("");
  const [novoCategoriaId, setNovoCategoriaId] = useState<string>("");
  const [novoBenefId, setNovoBenefId] = useState<string>("");
  const [novoSalvando, setNovoSalvando] = useState(false);

  // Período
  const dataInicio = useMemo(() => `${ano}-${String(mes + 1).padStart(2, "0")}-01`, [ano, mes]);
  const dataFim = useMemo(() => {
    const last = new Date(ano, mes + 1, 0).getDate();
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }, [ano, mes]);

  // Conta selecionada
  const contaSel = useMemo(() => contas.find((c) => c.id === contaId) ?? null, [contas, contaId]);

  // PDF path (mesma convenção do LancamentosDashboard)
  const pdfName = useMemo(() => `${ano}-${String(mes + 1).padStart(2, "0")}.pdf`, [ano, mes]);
  const pdfFolder = useMemo(() => {
    if (!user || !contaId) return null;
    const ownerUserId = contaSel?.user_id || user.id;
    return `extratos_bancarios/${ownerUserId}/${contaId}`;
  }, [user, contaId, contaSel]);
  const pdfPath = useMemo(() => (pdfFolder ? `${pdfFolder}/${pdfName}` : null), [pdfFolder, pdfName]);

  // Cadastros auxiliares
  useEffect(() => {
    if (!user) return;
    supabase
      .from("contas_financeiras")
      .select("id,user_id,nome,saldo_inicial,saldo_inicial_em")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        const arr = (data ?? []).map((c) => ({
          id: c.id as string,
          user_id: (c.user_id as string) ?? null,
          nome: c.nome as string,
          saldo_inicial: Number(c.saldo_inicial ?? 0),
          saldo_inicial_em: (c.saldo_inicial_em as string) ?? null,
        }));
        setContas(arr);
      });
    supabase
      .from("categories")
      .select("id,name,tipo")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => {
        const arr = (data ?? []).map((c) => ({
          id: (c as Record<string, unknown>).id as string,
          nome: (c as Record<string, unknown>).name as string,
          tipo: ((c as Record<string, unknown>).tipo as string) ?? null,
        }));
        setCategorias(arr);
      });
    supabase
      .from("beneficiaries")
      .select("id,name")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => {
        const arr = (data ?? []).map((b) => ({
          id: (b as Record<string, unknown>).id as string,
          nome: (b as Record<string, unknown>).name as string,
        }));
        setBeneficiarios(arr);
      });
  }, [user]);

  const carregarMovimentos = async () => {
    if (!contaId) return;
    setLoading(true);
    try {
      const [{ data: dataMes, error: errMes }, { data: somaAnt, error: errAnt }] = await Promise.all([
        supabase
          .from("movimentos_financeiros")
          .select("id,data,tipo,valor,descricao,conferido")
          .eq("conta_id", contaId)
          .gte("data", dataInicio)
          .lte("data", dataFim)
          .order("data", { ascending: true }),
        supabase.rpc("saldo_conta_ate", {
          p_conta_id: contaId,
          p_data: dataInicio,
        }),
      ]);
      if (errMes) throw errMes;
      if (errAnt) throw errAnt;

      const arr: Movimento[] = (dataMes ?? []).map((m) => ({
        id: m.id as string,
        data: m.data as string,
        tipo: m.tipo as "ENTRADA" | "SAIDA",
        valor: Number(m.valor),
        descricao: (m.descricao as string) ?? null,
        conferido: Boolean((m as Record<string, unknown>).conferido),
      }));
      setMovimentos(arr);
      setMovimentosAnterioresSoma(Number(somaAnt ?? 0));
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível carregar os lançamentos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkPdfExists = async () => {
    if (!user || !pdfFolder) {
      setPdfExists(false);
      setPdfUrl(null);
      return;
    }
    setPdfBusy(true);
    try {
      const { data } = await supabase.storage.from("Comprovantes").list(pdfFolder, { limit: 200 });
      const ok = (data || []).some((f) => f.name === pdfName);
      setPdfExists(ok);
      if (ok && pdfPath) {
        const { data: signed } = await supabase.storage.from("Comprovantes").createSignedUrl(pdfPath, 3600);
        setPdfUrl(signed?.signedUrl ?? null);
      } else {
        setPdfUrl(null);
      }
    } catch {
      setPdfExists(false);
      setPdfUrl(null);
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    if (contaId) {
      carregarMovimentos();
      checkPdfExists();
      setSaldoFinalExtrato("");
      setDiasExpandidos(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaId, dataInicio, dataFim]);

  // Filtros / lista renderizada
  const movimentosFiltrados = useMemo(() => {
    if (filtro === "TODOS") return movimentos;
    if (filtro === "PENDENTES") return movimentos.filter((m) => !m.conferido);
    return movimentos.filter((m) => m.conferido);
  }, [movimentos, filtro]);

  // Resumo
  const resumo = useMemo(() => {
    const total = movimentos.length;
    const conferidos = movimentos.filter((m) => m.conferido).length;
    const pendentes = total - conferidos;
    const totalEntradas = movimentos
      .filter((m) => m.tipo === "ENTRADA")
      .reduce((s, m) => s + Number(m.valor || 0), 0);
    const totalSaidas = movimentos
      .filter((m) => m.tipo === "SAIDA")
      .reduce((s, m) => s + Number(m.valor || 0), 0);
    const variacaoMes = totalEntradas - totalSaidas;
    const baseSaldoInicial = Number(contaSel?.saldo_inicial ?? 0);
    const saldoInicialMes = baseSaldoInicial + movimentosAnterioresSoma;
    const saldoFinalMes = saldoInicialMes + variacaoMes;
    return {
      total,
      conferidos,
      pendentes,
      totalEntradas,
      totalSaidas,
      variacaoMes,
      saldoInicialMes,
      saldoFinalMes,
    };
  }, [movimentos, contaSel, movimentosAnterioresSoma]);

  // Diferença com o extrato (se informado)
  const diferenca = useMemo(() => {
    const txt = saldoFinalExtrato.trim().replace(/\./g, "").replace(",", ".");
    if (!txt) return null;
    const v = Number(txt);
    if (!Number.isFinite(v)) return null;
    return v - resumo.saldoFinalMes;
  }, [saldoFinalExtrato, resumo.saldoFinalMes]);

  // Movimentos agrupados por dia, com saldo acumulado calculado sobre TODOS do mês
  type DiaTabela = {
    data: string;
    saldo: number;
    totalDia: number;
    conferidosDia: number;
    entradasDia: number;
    saidasDia: number;
    movimentos: (Movimento & { saldoApos: number })[];
  };
  const diasParaRender = useMemo<DiaTabela[]>(() => {
    const ordenados = [...movimentos].sort((a, b) =>
      a.data === b.data ? a.id.localeCompare(b.id) : a.data.localeCompare(b.data),
    );
    let acumulado = resumo.saldoInicialMes;
    const comSaldo = ordenados.map((m) => {
      acumulado += (m.tipo === "ENTRADA" ? 1 : -1) * Number(m.valor || 0);
      return { ...m, saldoApos: acumulado };
    });

    const passaFiltro = (m: Movimento) =>
      filtro === "TODOS" ? true : filtro === "PENDENTES" ? !m.conferido : m.conferido;

    const diasOrdenados = Array.from(new Set(comSaldo.map((m) => m.data))).sort();
    const out: DiaTabela[] = [];
    for (const dia of diasOrdenados) {
      const doDia = comSaldo.filter((m) => m.data === dia);
      const visiveis = doDia.filter(passaFiltro);
      if (visiveis.length === 0) continue;
      const saldo = doDia[doDia.length - 1].saldoApos;
      const entradasDia = doDia
        .filter((m) => m.tipo === "ENTRADA")
        .reduce((s, m) => s + Number(m.valor || 0), 0);
      const saidasDia = doDia
        .filter((m) => m.tipo === "SAIDA")
        .reduce((s, m) => s + Number(m.valor || 0), 0);
      out.push({
        data: dia,
        saldo,
        totalDia: doDia.length,
        conferidosDia: doDia.filter((m) => m.conferido).length,
        entradasDia,
        saidasDia,
        movimentos: visiveis,
      });
    }
    return out;
  }, [movimentos, resumo.saldoInicialMes, filtro]);

  const toggleDia = (data: string) => {
    setDiasExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(data)) next.delete(data);
      else next.add(data);
      return next;
    });
  };
  const expandirTodos = () => setDiasExpandidos(new Set(diasParaRender.map((d) => d.data)));
  const colapsarTodos = () => setDiasExpandidos(new Set());

  // Toggle conferido (auto-save no banco)
  const toggleConferido = async (mov: Movimento) => {
    const novo = !mov.conferido;
    // optimistic
    setMovimentos((prev) => prev.map((x) => (x.id === mov.id ? { ...x, conferido: novo } : x)));
    try {
      const { error } = await supabase
        .from("movimentos_financeiros")
        .update({
          conferido: novo,
          conferido_em: novo ? new Date().toISOString() : null,
        })
        .eq("id", mov.id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      // rollback
      setMovimentos((prev) => prev.map((x) => (x.id === mov.id ? { ...x, conferido: !novo } : x)));
      toast({ title: "Erro", description: "Não foi possível salvar a conferência.", variant: "destructive" });
    }
  };

  const marcarTodosVisiveis = async (valor: boolean) => {
    const alvos = movimentosFiltrados.filter((m) => m.conferido !== valor);
    if (alvos.length === 0) return;
    if (!confirm(`${valor ? "Marcar" : "Desmarcar"} ${alvos.length} lançamento(s) visível(is)?`)) return;
    setLoading(true);
    // optimistic
    const ids = new Set(alvos.map((a) => a.id));
    setMovimentos((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, conferido: valor } : m)));
    try {
      const { error } = await supabase
        .from("movimentos_financeiros")
        .update({
          conferido: valor,
          conferido_em: valor ? new Date().toISOString() : null,
        })
        .in("id", Array.from(ids));
      if (error) throw error;
      toast({ title: "Sucesso", description: `${alvos.length} lançamento(s) atualizado(s).` });
    } catch (err) {
      console.error(err);
      // rollback
      setMovimentos((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, conferido: !valor } : m)));
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Upload PDF
  const onUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !pdfPath) return;
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Selecione um PDF.", variant: "destructive" });
      return;
    }
    setPdfBusy(true);
    try {
      const { error } = await supabase.storage.from("Comprovantes").upload(pdfPath, f, {
        upsert: true,
        cacheControl: "3600",
        contentType: "application/pdf",
      });
      if (error) throw error;
      toast({ title: "PDF enviado", description: "Extrato carregado." });
      await checkPdfExists();
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao enviar PDF.",
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const removerPdf = async () => {
    if (!pdfPath) return;
    if (!confirm("Remover o PDF do extrato deste mês?")) return;
    setPdfBusy(true);
    try {
      const { error } = await supabase.storage.from("Comprovantes").remove([pdfPath]);
      if (error) throw error;
      setPdfExists(false);
      setPdfUrl(null);
      toast({ title: "PDF removido" });
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao remover PDF.",
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  // Novo lançamento
  const abrirNovo = () => {
    setNovoData(`${ano}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(hoje.getDate(), 28)).padStart(2, "0")}`);
    setNovoTipo("SAIDA");
    setNovoValor("");
    setNovoDescricao("");
    setNovoCategoriaId("");
    setNovoBenefId("");
    setNovoOpen(true);
  };

  const confirmarNovo = async () => {
    if (!user || !contaId) return;
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
        conta_id: contaId,
        data: novoData,
        tipo: novoTipo,
        valor,
        descricao: novoDescricao.trim() || null,
        categoria_id: novoCategoriaId || null,
        beneficiario_id: novoBenefId || null,
        origem: "EXTRATO",
        conferido: true,
        conferido_em: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Sucesso", description: "Lançamento criado e conferido." });
      setNovoOpen(false);
      await carregarMovimentos();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível criar o lançamento.", variant: "destructive" });
    } finally {
      setNovoSalvando(false);
    }
  };

  const categoriasFiltradas = useMemo(() => {
    const alvo = novoTipo === "ENTRADA" ? "RECEITA" : "DESPESA";
    return categorias.filter((c) => !c.tipo || c.tipo === alvo || c.tipo === "TRANSFERENCIA");
  }, [categorias, novoTipo]);

  const anos = useMemo(() => {
    const y = hoje.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [hoje]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="w-6 h-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Conferência de Extrato</h1>
      </div>

      {/* Filtros do período */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{cap(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!contaId && (
            <p className="text-xs text-muted-foreground mt-2">Selecione uma conta para começar.</p>
          )}
        </CardContent>
      </Card>

      {contaId && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Saldo inicial do mês</div>
                <div className="text-lg font-semibold">{fmtMoney(resumo.saldoInicialMes)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total de entradas</div>
                <div className="text-lg font-semibold text-green-700">{fmtMoney(resumo.totalEntradas)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total de saídas</div>
                <div className="text-lg font-semibold text-red-700">{fmtMoney(resumo.totalSaidas)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Saldo final calculado</div>
                <div className="text-lg font-semibold">{fmtMoney(resumo.saldoFinalMes)}</div>
              </div>
            </div>

            {contaSel?.saldo_inicial_em && (
              <p className="text-xs text-muted-foreground">
                Saldo inicial calculado a partir de {fmtMoney(contaSel.saldo_inicial)} em {fmtData(contaSel.saldo_inicial_em)} + movimentos até {fmtData(dataInicio)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conteúdo lado a lado: PDF + Lançamentos */}
      {contaId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* PDF */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Extrato do banco — {cap(meses[mes])} {ano}</CardTitle>
                <div className="flex items-center gap-2">
                  {pdfExists && pdfUrl && (
                    <Button size="sm" variant="outline" onClick={() => window.open(pdfUrl, "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Abrir
                    </Button>
                  )}
                  {pdfExists && (
                    <Button size="sm" variant="outline" onClick={removerPdf} disabled={pdfBusy}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remover
                    </Button>
                  )}
                  <Label className="inline-flex items-center cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={onUploadPdf}
                      disabled={pdfBusy}
                    />
                    <span className="inline-flex items-center text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                      <Upload className="w-4 h-4 mr-1" />
                      {pdfExists ? "Substituir" : "Enviar PDF"}
                    </span>
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {pdfBusy && !pdfUrl ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Carregando PDF...</div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-[75vh] border-t bg-white"
                  title="Extrato em PDF"
                />
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum PDF enviado para este mês. Use o botão "Enviar PDF" acima.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lançamentos */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Lançamentos no sistema</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filtro} onValueChange={(v: Filtro) => setFiltro(v)}>
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTES">Só pendentes</SelectItem>
                      <SelectItem value="CONFERIDOS">Só conferidos</SelectItem>
                      <SelectItem value="TODOS">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={abrirNovo}>
                    <Plus className="w-4 h-4 mr-1" />
                    Novo
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs pt-2 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => marcarTodosVisiveis(true)}
                  disabled={loading || movimentosFiltrados.length === 0}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Marcar todos
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => marcarTodosVisiveis(false)}
                  disabled={loading || movimentosFiltrados.length === 0}
                >
                  Desmarcar todos
                </Button>
                <span className="mx-1 text-muted-foreground">|</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={expandirTodos}
                  disabled={diasParaRender.length === 0}
                >
                  Expandir todos
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={colapsarTodos}
                  disabled={diasParaRender.length === 0}
                >
                  Colapsar todos
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {loading ? (
                <div className="p-6 text-center text-sm">Carregando...</div>
              ) : diasParaRender.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {movimentos.length === 0
                    ? "Nenhum lançamento neste mês."
                    : `Nenhum lançamento ${filtro === "PENDENTES" ? "pendente" : filtro === "CONFERIDOS" ? "conferido" : ""}.`}
                </div>
              ) : (
                <div className="overflow-auto max-h-[75vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-center p-2 w-10"></th>
                        <th className="text-left p-2 w-24">Data</th>
                        <th className="text-left p-2">Descrição</th>
                        <th className="text-right p-2 w-28">Valor</th>
                        <th className="text-right p-2 w-28">Saldo do dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasParaRender.map((d) => {
                        const expandido = diasExpandidos.has(d.data);
                        return (
                          <Fragment key={d.data}>
                            {expandido &&
                              d.movimentos.map((m) => (
                                <tr
                                  key={m.id}
                                  className={`border-b cursor-pointer hover:bg-muted/30 ${m.conferido ? "bg-green-50" : ""}`}
                                  onClick={() => toggleConferido(m)}
                                >
                                  <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                      checked={m.conferido}
                                      onCheckedChange={() => toggleConferido(m)}
                                    />
                                  </td>
                                  <td className="p-2 whitespace-nowrap pl-6">{fmtData(m.data)}</td>
                                  <td className="p-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={m.tipo === "ENTRADA" ? "default" : "secondary"} className="text-[10px]">
                                        {m.tipo === "ENTRADA" ? "E" : "S"}
                                      </Badge>
                                      <span className="truncate" title={m.descricao ?? ""}>{m.descricao ?? "(sem descrição)"}</span>
                                    </div>
                                  </td>
                                  <td className={`p-2 text-right whitespace-nowrap font-medium ${m.tipo === "ENTRADA" ? "text-green-700" : "text-red-700"}`}>
                                    {fmtMoney(m.valor)}
                                  </td>
                                  <td className="p-2"></td>
                                </tr>
                              ))}
                            <tr
                              className="bg-muted/40 hover:bg-muted/60 font-semibold border-b-2 border-muted cursor-pointer"
                              onClick={() => toggleDia(d.data)}
                            >
                              <td className="p-2 text-center">
                                {expandido ? (
                                  <ChevronDown className="w-4 h-4 mx-auto" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 mx-auto" />
                                )}
                              </td>
                              <td className="p-2 whitespace-nowrap" colSpan={2}>
                                Saldo em {fmtData(d.data)}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                  ({d.totalDia} {d.totalDia === 1 ? "lançamento" : "lançamentos"}
                                  {d.conferidosDia > 0 ? `, ${d.conferidosDia} conferido${d.conferidosDia === 1 ? "" : "s"}` : ""})
                                </span>
                              </td>
                              <td className="p-2 text-right whitespace-nowrap text-xs font-normal">
                                {d.entradasDia > 0 ? (
                                  <div className="text-green-700">+ {fmtMoney(d.entradasDia)}</div>
                                ) : null}
                                {d.saidasDia > 0 ? (
                                  <div className="text-red-700">− {fmtMoney(d.saidasDia)}</div>
                                ) : null}
                              </td>
                              <td className="p-2 text-right whitespace-nowrap">{fmtMoney(d.saldo)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: Novo lançamento */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lançamento (já conferido)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={novoTipo} onValueChange={(v: "ENTRADA" | "SAIDA") => setNovoTipo(v)}>
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
            <Separator />
            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              <Select value={novoCategoriaId} onValueChange={setNovoCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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
                  {beneficiarios.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)} disabled={novoSalvando}>
              Cancelar
            </Button>
            <Button onClick={confirmarNovo} disabled={novoSalvando}>
              {novoSalvando ? "Salvando..." : "Criar e conferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
