import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Lanc = {
  id: string;
  tipo: "DESPESA" | "RECEITA";
  valor: number;
  vencimento: string;
};

export default function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dataRef, setDataRef] = useState(() => new Date());
  const [rows, setRows] = useState<Lanc[]>([]);

  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth();
  const inicio = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const fim = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
  const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s);

  useEffect(() => {
    if (!supabase || !user) return;

    const fetchData = async () => {
      // Get Transferência Interna IDs to exclude
      const { data: catTransf } = await supabase.from('categories').select('id').eq('name', 'Transferência Interna');
      const transfIds = catTransf?.map(c => c.id) || [];

      let query = supabase
        .from("lancamentos")
        .select("id, tipo, valor, vencimento, categoria_id")
        .eq("user_id", user.id)
        .gte("vencimento", inicio)
        .lte("vencimento", fim)
        .order("vencimento");

      if (transfIds.length > 0) {
        query = query.not('categoria_id', 'in', `(${transfIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      type RowBasic = { id: string; tipo: string; valor: number; vencimento: string };
      const arr: Lanc[] = (data || []).map((r: RowBasic) => ({
        id: r.id,
        tipo: r.tipo as Lanc["tipo"],
        valor: r.valor,
        vencimento: r.vencimento,
      }));
      setRows(arr);
    };

    fetchData();
  }, [user, inicio, fim]);

  const tituloMes = useMemo(() => {
    const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${capitalize(nomes[mes])} de ${ano}`;
  }, [mes, ano]);

  const diasDoMes = useMemo(() => {
    const first = new Date(Date.UTC(ano, mes, 1));
    const last = new Date(Date.UTC(ano, mes + 1, 0));
    const total = last.getUTCDate();
    const startWeekday = first.getUTCDay();
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < (startWeekday === 0 ? 6 : startWeekday - 1); i++) cells.push({ date: null });
    for (let d = 1; d <= total; d++) {
      const iso = new Date(Date.UTC(ano, mes, d)).toISOString().slice(0, 10);
      cells.push({ date: iso });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [ano, mes]);

  const totaisPorDia = useMemo(() => {
    const map: Record<string, { receitas: number; despesas: number }> = {};
    for (const r of rows) {
      const k = r.vencimento;
      if (!map[k]) map[k] = { receitas: 0, despesas: 0 };
      if (r.tipo === "RECEITA") map[k].receitas += r.valor;
      else map[k].despesas += r.valor;
    }
    return map;
  }, [rows]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Agenda Financeira</h1>

        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="font-semibold w-40 text-center">{tituloMes}</div>
          <Button variant="ghost" onClick={() => setDataRef(new Date(ano, mes + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground mb-2">
          <div className="p-2 text-center">Seg</div>
          <div className="p-2 text-center">Ter</div>
          <div className="p-2 text-center">Qua</div>
          <div className="p-2 text-center">Qui</div>
          <div className="p-2 text-center">Sex</div>
          <div className="p-2 text-center">Sáb</div>
          <div className="p-2 text-center">Dom</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {diasDoMes.map((cell, idx) => {
            const totals = cell.date ? totaisPorDia[cell.date] : undefined;
            const dayNum = cell.date ? Number(cell.date.slice(-2)) : null;
            return (
              <Card key={idx} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                e.preventDefault();
                const payload = e.dataTransfer.getData("text/plain");
                if (cell.date && payload) toast({ title: "Mover lançamento", description: `Soltar em ${cell.date} não está implementado` });
              }}>
                <CardContent className="p-3 h-24 flex flex-col">
                  <div className="text-xs text-muted-foreground">{dayNum ?? ""}</div>
                  <div className="mt-1 text-[11px]">Receitas: <span className="font-semibold text-blue-600">R$ {(totals?.receitas ?? 0).toFixed(2)}</span></div>
                  <div className="text-[11px]">Despesas: <span className="font-semibold text-red-600">R$ {(totals?.despesas ?? 0).toFixed(2)}</span></div>
                  {!cell.date && <div className="flex-1" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
