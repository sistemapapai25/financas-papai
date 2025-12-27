import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type MovAno = {
  data: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  conta_id: string;
  categoria_id: string | null;
};

const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function ResumoAnual() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [contas, setContas] = useState<{ id: string; nome: string; logo?: string | null }[]>([]);
  const [contaSel, setContaSel] = useState<string>("ALL");
  const [incluiTransferencias, setIncluiTransferencias] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MovAno[]>([]);
  const [transfIds, setTransfIds] = useState<string[]>([]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

  const start = `${ano}-01-01`;
  const endExclusivo = `${ano + 1}-01-01`;
  const startNoPad = `${ano}-1-1`;
  const endExclusivoNoPad = `${ano + 1}-1-1`;
  const filtroAno = `and(data.gte.${start},data.lt.${endExclusivo}),and(data.gte.${startNoPad},data.lt.${endExclusivoNoPad})`;

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("contas_financeiras")
      .select("id,nome,logo")
      .order("nome")
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
          return;
        }
        const arr = (data || []).map((c: { id: string; nome: string; logo?: string | null }) => ({ id: c.id, nome: c.nome, logo: c.logo ?? null }));
        setContas(arr);
      });
  }, [user, toast]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "Transferência Interna")
      .then(({ data, error }) => {
        if (error) return;
        setTransfIds((data || []).map((r: { id: string }) => r.id).filter(Boolean));
      });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("movimentos_financeiros")
          .select("data,valor,tipo,conta_id,categoria_id")
          .eq("user_id", user.id)
          .or(filtroAno)
          .order("data");
        if (contaSel !== "ALL") q = q.eq("conta_id", contaSel);
        const { data, error } = await q;
        if (cancelled) return;
        if (error) throw error;
        const arr: MovAno[] = (data || []).map((r) => ({
          data: (r as { data: string }).data,
          valor: Number((r as { valor: number }).valor || 0),
          tipo: (r as { tipo: "ENTRADA" | "SAIDA" }).tipo,
          conta_id: (r as { conta_id: string }).conta_id,
          categoria_id: ((r as { categoria_id?: string | null }).categoria_id ?? null) as string | null,
        }));
        setRows(arr);
      } catch (e: unknown) {
        toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao buscar movimentos", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, toast, filtroAno, contaSel]);

  const porMes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, idx) => ({ mes: idx, entradas: 0, saidas: 0, saldo: 0 }));
    const isTransfer = (categoriaId: string | null) => !!categoriaId && transfIds.includes(categoriaId);

    for (const r of rows) {
      const parts = String(r.data || "").split("-");
      const mm = Number(parts[1]);
      if (!Number.isFinite(mm) || mm < 1 || mm > 12) continue;
      if (!incluiTransferencias && isTransfer(r.categoria_id)) continue;
      const idx = mm - 1;
      if (r.tipo === "ENTRADA") base[idx].entradas += Number(r.valor || 0);
      else base[idx].saidas += Number(r.valor || 0);
    }
    for (const item of base) item.saldo = item.entradas - item.saidas;
    return base;
  }, [rows, incluiTransferencias, transfIds]);

  const totais = useMemo(() => {
    const entradas = porMes.reduce((s, m) => s + m.entradas, 0);
    const saidas = porMes.reduce((s, m) => s + m.saidas, 0);
    const saldo = entradas - saidas;
    return { entradas, saidas, saldo };
  }, [porMes]);

  const porMesComAcumulado = useMemo(() => {
    let acc = 0;
    return porMes.map((m) => {
      acc += m.saldo;
      return { ...m, acumulado: acc };
    });
  }, [porMes]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Resumo Anual</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[120px] text-center font-semibold">{ano}</div>
            <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={contaSel} onValueChange={setContaSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas Contas e Cartões</SelectItem>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="flex items-center gap-2">
                  <Checkbox checked={incluiTransferencias} onCheckedChange={(v) => setIncluiTransferencias(Boolean(v))} />
                  <Label>Incluir transferências internas</Label>
                </div>
              </div>

              <div className="flex items-end justify-end text-sm text-muted-foreground">
                {loading ? "Carregando..." : `${rows.length} movimento(s) no ano`}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Entradas</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(totais.entradas)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Saídas</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totais.saidas)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Saldo do Ano</span>
                  <span className={`font-semibold ${totais.saldo >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatCurrency(totais.saldo)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="overflow-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="p-2 text-left">Mês</th>
                <th className="p-2 text-right">Entradas</th>
                <th className="p-2 text-right">Saídas</th>
                <th className="p-2 text-right">Saldo</th>
                <th className="p-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {porMesComAcumulado.map((m) => (
                <tr key={m.mes} className="border-t">
                  <td className="p-2">{mesesPt[m.mes][0].toUpperCase() + mesesPt[m.mes].slice(1)}</td>
                  <td className="p-2 text-right text-blue-700">{formatCurrency(m.entradas)}</td>
                  <td className="p-2 text-right text-red-700">{formatCurrency(m.saidas)}</td>
                  <td className={`p-2 text-right font-medium ${m.saldo >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(m.saldo)}</td>
                  <td className={`p-2 text-right font-semibold ${m.acumulado >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(m.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
