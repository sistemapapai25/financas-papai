// src/pages/CadastroContasFinanceiras.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { Banknote, Plus, Edit2, Trash2, Search } from "lucide-react";

type ContaFinanceira = Tables<"contas_financeiras">;
type TipoConta = ContaFinanceira["tipo"]; // "CAIXA" | "BANCO"

export default function CadastroContasFinanceiras() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"ALL" | TipoConta>("ALL");

  // modal + edição
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContaFinanceira | null>(null);

  // formulário
  const [form, setForm] = useState<{
    nome: string;
    tipo: TipoConta;
    instituicao: string;
    agencia: string;
    numero: string;
    saldo_inicial: string; // como string para o input
  }>({
    nome: "",
    tipo: "CAIXA",
    instituicao: "",
    agencia: "",
    numero: "",
    saldo_inicial: "",
  });

  useEffect(() => {
    if (user) fetchContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("id, user_id, nome, tipo, instituicao, agencia, numero, saldo_inicial, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContas(data ?? []);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível carregar as contas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      nome: "",
      tipo: "CAIXA",
      instituicao: "",
      agencia: "",
      numero: "",
      saldo_inicial: "",
    });
  };

  const abrirNovo = () => {
    resetForm();
    setOpen(true);
  };

  const abrirEditar = (c: ContaFinanceira) => {
    setEditing(c);
    setForm({
      nome: c.nome ?? "",
      tipo: c.tipo,
      instituicao: c.instituicao ?? "",
      agencia: c.agencia ?? "",
      numero: c.numero ?? "",
      saldo_inicial: (c.saldo_inicial ?? 0).toString(),
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    if (!form.nome.trim()) {
      toast({ title: "Atenção", description: "Informe o nome da conta.", variant: "destructive" });
      return;
    }

    const saldo = Number(form.saldo_inicial || 0);
    if (Number.isNaN(saldo) || saldo < 0) {
      toast({ title: "Atenção", description: "Saldo inicial inválido.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      if (editing) {
        const { error } = await supabase
          .from("contas_financeiras")
          .update({
            nome: form.nome.trim(),
            tipo: form.tipo,
            instituicao: form.tipo === "BANCO" ? form.instituicao.trim() || null : null,
            agencia: form.tipo === "BANCO" ? form.agencia.trim() || null : null,
            numero: form.tipo === "BANCO" ? form.numero.trim() || null : null,
            saldo_inicial: saldo,
          })
          .eq("id", editing.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Conta atualizada com sucesso!" });
      } else {
        const { error } = await supabase.from("contas_financeiras").insert({
          user_id: user.id,
          nome: form.nome.trim(),
          tipo: form.tipo,
          instituicao: form.tipo === "BANCO" ? form.instituicao.trim() || null : null,
          agencia: form.tipo === "BANCO" ? form.agencia.trim() || null : null,
          numero: form.tipo === "BANCO" ? form.numero.trim() || null : null,
          saldo_inicial: saldo,
        });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Conta criada com sucesso!" });
      }

      setOpen(false);
      resetForm();
      fetchContas();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível salvar a conta.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const excluirConta = async (c: ContaFinanceira) => {
    if (!confirm(`Excluir a conta "${c.nome}"?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.from("contas_financeiras").delete().eq("id", c.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Conta excluída." });
      fetchContas();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const contasFiltradas = useMemo(() => {
    return contas.filter((c) => {
      const matchTipo = filtroTipo === "ALL" ? true : c.tipo === filtroTipo;
      const q = busca.trim().toLowerCase();
      const matchBusca =
        !q ||
        c.nome?.toLowerCase().includes(q) ||
        c.instituicao?.toLowerCase().includes(q) ||
        c.agencia?.toLowerCase().includes(q) ||
        c.numero?.toLowerCase().includes(q);
      return matchTipo && matchBusca;
    });
  }, [contas, filtroTipo, busca]);

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-6 h-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Contas Financeiras</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                    placeholder="Ex: Caixa Igreja, Banco Santander"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v: TipoConta) => setForm((s) => ({ ...s, tipo: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAIXA">Caixa</SelectItem>
                      <SelectItem value="BANCO">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campos de banco (somente quando tipo = BANCO) */}
              {form.tipo === "BANCO" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Instituição</Label>
                    <Input
                      value={form.instituicao}
                      onChange={(e) => setForm((s) => ({ ...s, instituicao: e.target.value }))}
                      placeholder="Ex: Santander, Cora"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input
                      value={form.agencia}
                      onChange={(e) => setForm((s) => ({ ...s, agencia: e.target.value }))}
                      placeholder="0001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número da conta</Label>
                    <Input
                      value={form.numero}
                      onChange={(e) => setForm((s) => ({ ...s, numero: e.target.value }))}
                      placeholder="123456-7"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Saldo inicial</Label>
                  <Input
                    inputMode="decimal"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={form.saldo_inicial}
                    onChange={(e) => setForm((s) => ({ ...s, saldo_inicial: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, banco, agência, número..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div>
              <Label className="sr-only">Tipo</Label>
              <Select value={filtroTipo} onValueChange={(v: "ALL" | TipoConta) => setFiltroTipo(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="CAIXA">Caixa</SelectItem>
                  <SelectItem value="BANCO">Banco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle>Minhas Contas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">Carregando...</div>
          ) : contasFiltradas.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma conta encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-left p-3 font-medium">Banco</th>
                    <th className="text-left p-3 font-medium">Agência</th>
                    <th className="text-left p-3 font-medium">Número</th>
                    <th className="text-right p-3 font-medium">Saldo inicial</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasFiltradas.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={`border-b ${idx % 2 ? "bg-muted/20" : ""}`}
                    >
                      <td className="p-3">{c.nome}</td>
                      <td className="p-3">
                        <Badge variant={c.tipo === "BANCO" ? "default" : "secondary"}>
                          {c.tipo === "BANCO" ? "Banco" : "Caixa"}
                        </Badge>
                      </td>
                      <td className="p-3">{c.instituicao ?? "-"}</td>
                      <td className="p-3">{c.agencia ?? "-"}</td>
                      <td className="p-3">{c.numero ?? "-"}</td>
                      <td className="p-3 text-right">{formatMoney(c.saldo_inicial || 0)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>
                            <Edit2 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => excluirConta(c)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <div className="text-xs text-muted-foreground">
        Dica: crie uma conta do tipo <strong>CAIXA</strong> para registrar entradas de cultos, e contas do tipo <strong>BANCO</strong> (ex.: Santander, Cora) para conciliação bancária.
      </div>
    </div>
  );
}
