import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { LineChart as LineIcon, TrendingUp, TrendingDown, Wallet, Scale } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, PieChart, Pie, AreaChart, Area, Line,
} from "recharts";

type MovRow = {
  data: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  categoria_nome: string | null;
  beneficiario_nome: string | null;
};
type Conta = { id: string; nome: string; logo: string | null; saldo_inicial: number; saldo_inicial_em: string | null };

const TRANSFER_CAT = "Transferência Interna";
const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CORES = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1000) return `${n < 0 ? "-" : ""}${(abs / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

const tooltipFmt = (v: number | string) => formatCurrency(Number(v));

export default function Graficos() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [movs, setMovs] = useState<MovRow[]>([]);
  const [saldoInicioAno, setSaldoInicioAno] = useState(0);
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [saldoPorConta, setSaldoPorConta] = useState<{ nome: string; saldo: number }[]>([]);

  const yearOptions = useMemo(() => {
    const atual = new Date().getFullYear();
    const ini = Math.min(atual - 6, ano - 3);
    const fim = Math.max(atual + 1, ano + 1);
    return Array.from({ length: fim - ini + 1 }, (_, i) => fim - i);
  }, [ano]);

  useEffect(() => {
    if (!user || roleLoading) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const periodStart = `${ano}-01-01`;
        const periodEnd = `${ano}-12-31`;
        const FUTURO = "2999-12-31";

        // Contas
        const { data: contasData, error: contasErr } = await supabase
          .from("contas_financeiras")
          .select("id,nome,logo,saldo_inicial,saldo_inicial_em")
          .eq("ativo", true)
          .order("nome");
        if (contasErr) throw contasErr;
        const contas: Conta[] = (contasData || []).map((c) => ({
          id: c.id, nome: c.nome, logo: c.logo ?? null,
          saldo_inicial: Number(c.saldo_inicial || 0), saldo_inicial_em: c.saldo_inicial_em ?? null,
        }));

        // Saldo no início do ano e saldo atual (por conta)
        const [rpcInicio, rpcAtual] = await Promise.all([
          Promise.all(contas.map((c) => supabase.rpc("saldo_conta_ate", { p_conta_id: c.id, p_data: periodStart }))),
          Promise.all(contas.map((c) => supabase.rpc("saldo_conta_ate", { p_conta_id: c.id, p_data: FUTURO }))),
        ]);
        const baseInicioAno = contas.reduce((s, c) => {
          const a = c.saldo_inicial_em;
          if (a && a > periodStart) return s;
          return s + c.saldo_inicial;
        }, 0);
        const netAntes = rpcInicio.reduce((s, r) => s + Number(r.data || 0), 0);
        const sInicioAno = baseInicioAno + netAntes;

        const baseTotal = contas.reduce((s, c) => s + c.saldo_inicial, 0);
        const netTotal = rpcAtual.reduce((s, r) => s + Number(r.data || 0), 0);
        const sAtual = baseTotal + netTotal;
        const porConta = contas.map((c, i) => ({
          nome: c.nome,
          saldo: c.saldo_inicial + Number(rpcAtual[i]?.data || 0),
        }));

        // Movimentos do ano (paginado p/ ultrapassar o limite de 1000)
        const pageSize = 1000;
        let from = 0;
        const todas: MovRow[] = [];
        for (;;) {
          let q = supabase
            .from("movimentos_financeiros")
            .select("data, valor, tipo, categoria:categories(name), beneficiario:beneficiaries(name)")
            .gte("data", periodStart).lte("data", periodEnd)
            .order("data", { ascending: true })
            .range(from, from + pageSize - 1);
          if (!isAdmin) q = q.eq("user_id", user.id);
          const { data, error } = await q;
          if (error) throw error;
          const lote = (data || []).map((r) => ({
            data: r.data,
            valor: Number(r.valor || 0),
            tipo: r.tipo as MovRow["tipo"],
            categoria_nome: r.categoria?.name ?? null,
            beneficiario_nome: r.beneficiario?.name ?? null,
          }));
          todas.push(...lote);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }

        if (cancel) return;
        setSaldoInicioAno(sInicioAno);
        setSaldoAtual(sAtual);
        setSaldoPorConta(porConta);
        setMovs(todas);
      } catch (e: unknown) {
        if (!cancel) toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao carregar gráficos", variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [user, ano, isAdmin, roleLoading, toast]);

  // Sem transferências internas para receitas/despesas
  const movsReais = useMemo(() => movs.filter((m) => m.categoria_nome !== TRANSFER_CAT), [movs]);

  const porMes = useMemo(() => {
    const arr = mesesAbrev.map((label) => ({ label, entradas: 0, saidas: 0, resultado: 0, saldo: 0 }));
    for (const m of movsReais) {
      const mi = Number(m.data.split("-")[1]) - 1;
      if (mi < 0 || mi > 11) continue;
      if (m.tipo === "ENTRADA") arr[mi].entradas += m.valor;
      else arr[mi].saidas += m.valor;
    }
    let acc = saldoInicioAno;
    for (const mb of arr) {
      mb.resultado = mb.entradas - mb.saidas;
      acc += mb.resultado;
      mb.saldo = acc;
    }
    return arr;
  }, [movsReais, saldoInicioAno]);

  const totalEntradas = useMemo(() => movsReais.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.valor, 0), [movsReais]);
  const totalSaidas = useMemo(() => movsReais.filter((m) => m.tipo === "SAIDA").reduce((s, m) => s + m.valor, 0), [movsReais]);
  const resultadoAno = totalEntradas - totalSaidas;

  const despesasPorCategoria = useMemo(() => topNComOutras(agrupar(movsReais.filter((m) => m.tipo === "SAIDA"), (m) => m.categoria_nome || "(sem categoria)")), [movsReais]);
  const receitasPorCategoria = useMemo(() => topNComOutras(agrupar(movsReais.filter((m) => m.tipo === "ENTRADA"), (m) => m.categoria_nome || "(sem categoria)")), [movsReais]);
  const topBeneficiarios = useMemo(() => {
    const arr = Array.from(agrupar(movsReais.filter((m) => m.tipo === "SAIDA"), (m) => m.beneficiario_nome || "(sem beneficiário)").entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return arr;
  }, [movsReais]);

  const taxaPoupanca = totalEntradas > 0 ? (resultadoAno / totalEntradas) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <LineIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Gráficos</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ano</span>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard titulo={`Receitas ${ano}`} valor={formatCurrency(totalEntradas)} cor="text-blue-600" icon={<TrendingUp className="w-5 h-5 text-blue-600" />} />
        <KpiCard titulo={`Despesas ${ano}`} valor={formatCurrency(totalSaidas)} cor="text-red-600" icon={<TrendingDown className="w-5 h-5 text-red-600" />} />
        <KpiCard
          titulo={resultadoAno >= 0 ? `Superávit ${ano}` : `Déficit ${ano}`}
          valor={formatCurrency(resultadoAno)}
          sub={`Taxa de poupança: ${taxaPoupanca.toFixed(0)}%`}
          cor={resultadoAno >= 0 ? "text-emerald-600" : "text-red-600"}
          icon={<Scale className={`w-5 h-5 ${resultadoAno >= 0 ? "text-emerald-600" : "text-red-600"}`} />}
        />
        <KpiCard titulo="Saldo atual (todas as contas)" valor={formatCurrency(saldoAtual)} cor={saldoAtual >= 0 ? "text-blue-600" : "text-red-600"} icon={<Wallet className="w-5 h-5 text-blue-600" />} />
      </div>

      {loading && <p className="text-sm text-muted-foreground mb-3">Carregando dados…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Receitas × Despesas por mês">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis tickFormatter={fmtCompact} fontSize={12} width={48} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Bar name="Receitas" dataKey="entradas" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar name="Despesas" dataKey="saidas" fill="#dc2626" radius={[3, 3, 0, 0]} />
              <Line name="Resultado" type="monotone" dataKey="resultado" stroke="#2563eb" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Evolução do saldo em ${ano}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis tickFormatter={fmtCompact} fontSize={12} width={48} />
              <Tooltip formatter={tooltipFmt} />
              <Area name="Saldo" type="monotone" dataKey="saldo" stroke="#2563eb" strokeWidth={2} fill="url(#gradSaldo)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Despesas por categoria">
          {despesasPorCategoria.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {despesasPorCategoria.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Receitas por categoria">
          {receitasPorCategoria.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={receitasPorCategoria} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {receitasPorCategoria.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 beneficiários (despesas)">
          {topBeneficiarios.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBeneficiarios} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtCompact} fontSize={12} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={tooltipFmt} />
                <Bar dataKey="value" name="Pago" fill="#dc2626" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Saldo atual por conta">
          {saldoPorConta.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={saldoPorConta} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtCompact} fontSize={12} />
                <YAxis type="category" dataKey="nome" width={120} fontSize={11} />
                <Tooltip formatter={tooltipFmt} />
                <Bar dataKey="saldo" name="Saldo" radius={[0, 3, 3, 0]}>
                  {saldoPorConta.map((s, i) => <Cell key={i} fill={s.saldo >= 0 ? "#2563eb" : "#dc2626"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({ titulo, valor, sub, cor, icon }: { titulo: string; valor: string; sub?: string; cor: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{titulo}</span>
          {icon}
        </div>
        <div className={`text-xl font-bold mt-1 ${cor}`}>{valor}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Vazio() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>;
}

function agrupar(rows: MovRow[], chave: (m: MovRow) => string) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(chave(r), (map.get(chave(r)) || 0) + r.valor);
  return map;
}
function topNComOutras(map: Map<string, number>, n = 6) {
  const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  if (arr.length <= n) return arr;
  const top = arr.slice(0, n);
  const outras = arr.slice(n).reduce((s, x) => s + x.value, 0);
  if (outras > 0) top.push({ name: "Outras", value: outras });
  return top;
}
