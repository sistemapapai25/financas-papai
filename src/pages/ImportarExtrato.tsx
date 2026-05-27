import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseExtratoFile, type LinhaExtrato } from "@/lib/parseExtrato";

type LinhaPreview = LinhaExtrato & { selecionado: boolean };

export default function ImportarExtrato() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaPreview[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contaId, setContaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [permitirDuplicados, setPermitirDuplicados] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("contas_financeiras")
      .select("id,nome")
      .eq("ativo", true)
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
  }, [user]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setLinhas([]);
    if (!f) return;
    const res = await parseExtratoFile(f);
    if (!res.ok) {
      toast({ title: "Arquivo inválido", description: res.erro, variant: "destructive" });
      return;
    }
    setLinhas(res.linhas.map((l) => ({ ...l, selecionado: l.valido })));
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
    let vinculados = 0;

    // Vinculação anti-duplicação: pra cada linha do extrato, se já existe
    // movimento com mesma data+valor+tipo+conta e origem=LANCAMENTO (criado
    // pela tela Contas a Pagar/Pagas) e ainda não conferido, marca esse
    // lançamento como conferido e pula a importação (não cria duplicado).
    if (selecionadas.length > 0) {
      const datasOrdenadas = selecionadas.map(l => l.data!).sort();
      const minData = datasOrdenadas[0];
      const maxData = datasOrdenadas[datasOrdenadas.length - 1];
      const { data: lancExistentes } = await supabase
        .from('movimentos_financeiros')
        .select('id,data,valor,tipo,conferido')
        .eq('conta_id', contaId)
        .eq('origem', 'LANCAMENTO')
        .gte('data', minData)
        .lte('data', maxData);

      const candidatos = new Map<string, string[]>();
      for (const r of (lancExistentes ?? [])) {
        const obj = r as Record<string, unknown>;
        if (obj.conferido === true) continue; // já vinculado antes
        const key = `${String(obj.data)}|${Number(obj.valor).toFixed(2)}|${String(obj.tipo)}`;
        const arr = candidatos.get(key) ?? [];
        arr.push(String(obj.id));
        candidatos.set(key, arr);
      }

      const idsParaConferir: string[] = [];
      const filtradas: typeof selecionadas = [];
      for (const l of selecionadas) {
        const key = `${l.data}|${(l.valor || 0).toFixed(2)}|${l.tipo}`;
        const ids = candidatos.get(key) ?? [];
        const id = ids.shift();
        if (id) {
          idsParaConferir.push(id);
          vinculados++;
        } else {
          filtradas.push(l);
        }
      }
      selecionadas = filtradas;

      if (idsParaConferir.length > 0) {
        await supabase
          .from('movimentos_financeiros')
          .update({ conferido: true, conferido_em: new Date().toISOString() })
          .in('id', idsParaConferir);
      }
    }

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
    if (registros.length === 0 && vinculados === 0) { toast({ title: "Nada para importar" }); return; }
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
      toast({
        title: "Importação concluída",
        description: `${inseridos} novos. ${vinculados} vinculados a Contas a Pagar. ${duplicados} duplicados ignorados.`,
      });
      setLinhas([]);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Importar Extrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label>Arquivo Excel ou CSV (.xlsx, .csv)</Label>
              <Input type="file" accept=".xlsx,.csv" onChange={onFileChange} />
            </div>
            <div>
              <Label>Conta financeira</Label>
              <select className="w-full border rounded-md h-10 px-3" value={contaId} onChange={e => setContaId(e.target.value)}>
                <option value="">Selecione...</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
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
