import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Conta = { id: string; nome: string; tipo: string };

type CaixaItem = {
  ref_id: string;
  origem: "OFERTA" | "DIZIMO";
  data: string;
  tipo: string;
  descricao: string;
  valor: number;
  importado: boolean;
};

const mesesPt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function toMonthValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${yStr}-${mStr}-01`;
  const endDate = new Date(y, m, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) return String((err as any).message);
  return "Falha ao buscar dados";
}

function formatDateBrDash(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return iso;
  const [, yyyy, mm, dd] = m;
  return `${dd}-${mm}-${yyyy}`;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

export default function ImportarCaixa() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mes, setMes] = useState(() => toMonthValue(new Date()));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaId, setContaId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [itens, setItens] = useState<CaixaItem[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("contas_financeiras")
      .select("id,nome,tipo")
      .eq("user_id", user.id)
      .order("nome")
      .then(({ data, error }) => {
        if (error) return;
        const list = ((data ?? []) as Conta[]).filter((c) => c.tipo === "CAIXA");
        setContas(list);
        if (!contaId && list.length > 0) setContaId(list[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const buscar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { start, end } = monthRange(mes);

      let ofertas: unknown[] = [];
      let ofertasHasTipo = false;
      let ofertasHasImportado = false;
      for (const cols of [
        "id,tipo,valor,valor_dinheiro,valor_moedas,importado,cultos!inner(data)",
        "id,valor,valor_dinheiro,valor_moedas,importado,cultos!inner(data)",
        "id,valor,valor_dinheiro,valor_moedas,cultos!inner(data)",
      ]) {
        const { data, error } = await supabase
          .from("ofertas")
          .select(cols)
          .eq("cultos.user_id", user.id)
          .gte("cultos.data", start)
          .lt("cultos.data", end)
          .order("data", { ascending: true, foreignTable: "cultos" });

        if (!error) {
          ofertas = (data as unknown[]) ?? [];
          ofertasHasTipo = cols.includes("tipo");
          ofertasHasImportado = cols.includes("importado");
          break;
        }

        if (cols === "id,valor,valor_dinheiro,valor_moedas,cultos!inner(data)") {
          throw new Error(`Ofertas: ${error.message}`);
        }
      }

      let dizimos: unknown[] = [];
      let dizimosHasTipo = false;
      let dizimosHasImportado = false;
      for (const cols of ["id,tipo,nome,valor,importado,cultos!inner(data)", "id,nome,valor,importado,cultos!inner(data)", "id,nome,valor,cultos!inner(data)"]) {
        const { data, error } = await supabase
          .from("dizimos")
          .select(cols)
          .eq("cultos.user_id", user.id)
          .gte("cultos.data", start)
          .lt("cultos.data", end)
          .order("data", { ascending: true, foreignTable: "cultos" });

        if (!error) {
          dizimos = (data as unknown[]) ?? [];
          dizimosHasTipo = cols.includes("tipo");
          dizimosHasImportado = cols.includes("importado");
          break;
        }

        if (cols === "id,nome,valor,cultos!inner(data)") {
          throw new Error(`Dízimos: ${error.message}`);
        }
      }

      const merged: CaixaItem[] = [];
      for (const o of (ofertas as any[]) ?? []) {
        const data = o?.cultos?.data as string | undefined;
        const id = o?.id as string | undefined;
        const valor = Number(o?.valor || 0);
        if (!id || !data || !Number.isFinite(valor)) continue;
        const tipo = ofertasHasTipo ? String(o?.tipo ?? "").trim() : "";
        const dinheiro = Number(o?.valor_dinheiro || 0);
        const moedas = Number(o?.valor_moedas || 0);
        const extra = dinheiro || moedas ? ` (Dinheiro: ${formatCurrency(dinheiro)} / Moedas: ${formatCurrency(moedas)})` : "";
        const descBase = tipo || "Oferta";
        merged.push({
          ref_id: id,
          origem: "OFERTA",
          data,
          tipo: descBase,
          descricao: `${descBase}${extra}`,
          valor,
          importado: ofertasHasImportado ? Boolean(o?.importado) : false,
        });
      }

      for (const d of (dizimos as any[]) ?? []) {
        const data = d?.cultos?.data as string | undefined;
        const id = d?.id as string | undefined;
        const valor = Number(d?.valor || 0);
        if (!id || !data || !Number.isFinite(valor)) continue;
        const nome = String(d?.nome ?? "").trim();
        const tipo = dizimosHasTipo ? String(d?.tipo ?? "").trim() : "";
        const descBase = tipo || "Dízimo";
        merged.push({
          ref_id: id,
          origem: "DIZIMO",
          data,
          tipo: descBase,
          descricao: nome ? `${descBase} - ${nome}` : descBase,
          valor,
          importado: dizimosHasImportado ? Boolean(d?.importado) : false,
        });
      }

      merged.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ref_id.localeCompare(b.ref_id)));

      const refIds = merged.map((x) => x.ref_id);
      const existentes = new Set<string>();
      for (const batch of chunk(refIds, 200)) {
        const { data: existingRows, error: existErr } = await supabase
          .from("movimentos_financeiros")
          .select("ref_id")
          .eq("origem", "CULTO")
          .in("ref_id", batch);
        if (existErr) throw new Error(`Movimentos: ${existErr.message}`);
        for (const r of (existingRows as any[]) ?? []) {
          if (typeof r?.ref_id === "string") existentes.add(r.ref_id);
        }
      }

      setItens(merged.map((x) => ({ ...x, importado: x.importado || existentes.has(x.ref_id) })));
    } catch (e: unknown) {
      toast({ title: "Erro ao buscar dados", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [mes, toast, user]);

  useEffect(() => {
    if (!user || !contaId) return;
    void buscar();
  }, [buscar, contaId, user]);

  const resumo = useMemo(() => {
    const totalOfertas = itens.filter((i) => i.origem === "OFERTA").reduce((s, i) => s + (i.valor || 0), 0);
    const totalDizimos = itens.filter((i) => i.origem === "DIZIMO").reduce((s, i) => s + (i.valor || 0), 0);
    return { totalOfertas, totalDizimos, totalGeral: totalOfertas + totalDizimos };
  }, [itens]);

  const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s);
  const [anoStr, mesStr] = mes.split("-");
  const ano = Number(anoStr);
  const mesIdx = Number(mesStr) - 1;
  const tituloMes = Number.isFinite(ano) && mesIdx >= 0 && mesIdx <= 11 ? `${capitalize(mesesPt[mesIdx])} de ${ano}` : mes;
  const setMesFromDate = (d: Date) => setMes(toMonthValue(d));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Importar Caixa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const base = Number.isFinite(ano) && mesIdx >= 0 && mesIdx <= 11 ? new Date(ano, mesIdx, 1) : new Date();
                    setMesFromDate(new Date(base.getFullYear(), base.getMonth() - 1, 1));
                  }}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="font-semibold w-44">
                      {tituloMes}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="grid grid-cols-3 gap-1">
                      {mesesPt.map((nomeMes, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant={idx === mesIdx ? "default" : "ghost"}
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
                            setMes(`${y}-${String(idx + 1).padStart(2, "0")}`);
                            setMonthPickerOpen(false);
                          }}
                        >
                          {capitalize(nomeMes).substring(0, 3)}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const base = Number.isFinite(ano) && mesIdx >= 0 && mesIdx <= 11 ? new Date(ano, mesIdx, 1) : new Date();
                    setMesFromDate(new Date(base.getFullYear(), base.getMonth() + 1, 1));
                  }}
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta Caixa</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contas.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nenhuma conta do tipo Caixa encontrada. Cadastre em Cadastros &gt; Contas Financeiras.
                </div>
              ) : null}
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={buscar} disabled={loading || !user}>
                {loading ? "Buscando..." : "Buscar dados"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prévia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-muted-foreground">Total ofertas</span>
              <span className="font-semibold">{formatCurrency(resumo.totalOfertas)}</span>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-muted-foreground">Total dízimos</span>
              <span className="font-semibold">{formatCurrency(resumo.totalDizimos)}</span>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-muted-foreground">Total geral</span>
              <span className="font-semibold">{formatCurrency(resumo.totalGeral)}</span>
            </div>
          </div>

          {itens.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum dado carregado.</div>
          ) : (
            <div className="overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-36 text-right">Valor</TableHead>
                    <TableHead className="w-28 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.ref_id}>
                      <TableCell>{formatDateBrDash(i.data)}</TableCell>
                      <TableCell>{i.origem === "OFERTA" ? "Oferta" : "Dízimo"}</TableCell>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell className="text-right">{formatCurrency(i.valor)}</TableCell>
                      <TableCell className="text-center">{i.importado ? "Já importado" : "Novo"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button
              onClick={async () => {
                if (!user) return;
                if (!contaId) {
                  toast({ title: "Conta Caixa", description: "Selecione a conta.", variant: "destructive" });
                  return;
                }
                const novos = itens.filter((i) => !i.importado);
                if (novos.length === 0) {
                  toast({ title: "Importação", description: "Nenhum registro novo para importar." });
                  return;
                }
                setImportando(true);
                try {
                  const payload = novos.map((i) => ({
                    user_id: user.id,
                    conta_id: contaId,
                    data: i.data,
                    tipo: "ENTRADA",
                    valor: i.valor,
                    descricao: i.tipo,
                    origem: "CULTO",
                    ref_id: i.ref_id,
                  }));
                  for (const batch of chunk(payload, 200)) {
                    const { error } = await supabase.from("movimentos_financeiros").insert(batch);
                    if (error) throw error;
                  }

                  const ofertaIds = novos.filter((i) => i.origem === "OFERTA").map((i) => i.ref_id);
                  const dizimoIds = novos.filter((i) => i.origem === "DIZIMO").map((i) => i.ref_id);

                  for (const batch of chunk(ofertaIds, 200)) {
                    const { error } = await supabase.from("ofertas").update({ importado: true }).in("id", batch);
                    if (error) throw error;
                  }
                  for (const batch of chunk(dizimoIds, 200)) {
                    const { error } = await supabase.from("dizimos").update({ importado: true }).in("id", batch);
                    if (error) throw error;
                  }

                  toast({ title: "Sucesso", description: `Importados ${novos.length} registro(s) no caixa.` });
                  await buscar();
                } catch (e: unknown) {
                  toast({
                    title: "Erro",
                    description: e instanceof Error ? e.message : "Falha ao importar dados",
                    variant: "destructive",
                  });
                } finally {
                  setImportando(false);
                }
              }}
              disabled={importando || loading || itens.length === 0}
            >
              {importando ? "Importando..." : "Importar dados"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
