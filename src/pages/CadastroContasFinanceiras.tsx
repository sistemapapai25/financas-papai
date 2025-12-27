// src/pages/CadastroContasFinanceiras.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
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

import { Banknote, Plus, Edit2, Trash2, Search, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ContaFinanceira = Tables<"contas_financeiras">;
type TipoConta = TablesInsert<"contas_financeiras">["tipo"]; // "CAIXA" | "BANCO"

export default function CadastroContasFinanceiras() {
  const { user } = useAuth();
  const { toast } = useToast();
  const LOGO_BUCKET = "Logos"; // Nome exato do bucket no Supabase

  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoBucketOk, setLogoBucketOk] = useState(true);
  const [logoBucketMsg, setLogoBucketMsg] = useState<string | null>(null);

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
    saldo_inicial_em: string;
    logo?: string;
  }>({
    nome: "",
    tipo: "CAIXA",
    instituicao: "",
    agencia: "",
    numero: "",
    saldo_inicial: "",
    saldo_inicial_em: "",
    logo: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const appKey = useMemo(() => (user?.id ? `app:applicationAccountId:${user.id}` : null), [user?.id]);
  const getAppAccountId = () => (appKey ? localStorage.getItem(appKey) : null);
  const [appAccountId, setAppAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    setAppAccountIdState(getAppAccountId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  const setAppAccountId = (id: string | null) => {
    if (!appKey) return;
    if (id) {
      localStorage.setItem(appKey, id);
      setAppAccountIdState(id);
      toast({ title: 'Configuração', description: 'Conta marcada como Aplicação.' });
    } else {
      localStorage.removeItem(appKey);
      setAppAccountIdState(null);
      toast({ title: 'Configuração', description: 'Conta de Aplicação desmarcada.' });
    }
  };

  useEffect(() => {
    if (user) {
      fetchContas();
      // valida bucket de logos
      (async () => {
        try {
          const { error } = await supabase.storage.from(LOGO_BUCKET).list("", { limit: 1 });
          if (error) {
            setLogoBucketOk(false);
            const msg = String(error.message || "Bucket inválido");
            setLogoBucketMsg(msg);
            toast({
              title: "Logo",
              description: `Bucket "${LOGO_BUCKET}" indisponível: ${msg}. Verifique no Supabase se o bucket existe e as permissões (public ou política para authenticated).`,
              variant: "destructive",
            });
          } else {
            setLogoBucketOk(true);
            setLogoBucketMsg(null);
          }
        } catch (err: unknown) {
          setLogoBucketOk(false);
          const msg = err instanceof Error ? err.message : String(err);
          setLogoBucketMsg(msg);
          toast({ title: "Logo", description: `Falha ao validar bucket "${LOGO_BUCKET}": ${msg}.`, variant: "destructive" });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("id, user_id, nome, tipo, instituicao, agencia, numero, saldo_inicial, saldo_inicial_em, logo, created_at")
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
      saldo_inicial_em: "",
      logo: "",
    });
    setLogoFile(null);
  };

  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const formatYmdBr = (ymd: string | null | undefined) => {
    if (!ymd) return "-";
    const [y, m, d] = ymd.split("-");
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
  };

  const abrirNovo = () => {
    resetForm();
    setForm((s) => ({ ...s, saldo_inicial_em: toYmd(new Date()) }));
    setOpen(true);
  };

  const abrirEditar = (c: ContaFinanceira) => {
    setEditing(c);
    setForm({
      nome: c.nome ?? "",
      tipo: c.tipo as TipoConta,
      instituicao: c.instituicao ?? "",
      agencia: c.agencia ?? "",
      numero: c.numero ?? "",
      saldo_inicial: (c.saldo_inicial ?? 0).toString(),
      saldo_inicial_em: c.saldo_inicial_em ?? "",
      logo: c.logo ?? "",
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

    const saldoEm = form.saldo_inicial_em.trim();
    const saldoInicialEm = saldoEm ? saldoEm : null;
    if (saldoInicialEm && !/^\d{4}-\d{2}-\d{2}$/.test(saldoInicialEm)) {
      toast({ title: "Atenção", description: "Data do saldo inicial inválida.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      if (editing) {
        let logoUrl: string | null = form.logo?.trim() ? form.logo!.trim() : null;
        if (logoFile) {
          if (!logoBucketOk) {
            toast({ title: "Logo", description: `Bucket "${LOGO_BUCKET}" não encontrado. ${logoBucketMsg ?? "Verifique no Supabase."} Salvando sem alterar a logo.`, variant: "destructive" });
          } else {
            try {
              const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
              const path = `${user.id}/${editing.id}-${Date.now()}.${ext}`;
              const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, logoFile, {
                upsert: true,
                contentType: logoFile.type || "image/*",
              });
              if (uploadError) throw uploadError;
              const pub = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
              logoUrl = pub.data.publicUrl || null;
            } catch (err: unknown) {
              console.error("Falha no upload da logo", err);
              const msg = err instanceof Error ? err.message : String(err);
              toast({ title: "Logo", description: `${msg} (bucket: ${LOGO_BUCKET}). Salvando sem alteração na logo.`, variant: "destructive" });
            }
          }
        }
        const { error } = await supabase
          .from("contas_financeiras")
          .update({
            nome: form.nome.trim(),
            tipo: form.tipo,
            instituicao: form.tipo === "BANCO" ? form.instituicao.trim() || null : null,
            agencia: form.tipo === "BANCO" ? form.agencia.trim() || null : null,
            numero: form.tipo === "BANCO" ? form.numero.trim() || null : null,
            saldo_inicial: saldo,
            saldo_inicial_em: saldoInicialEm,
            logo: logoUrl,
          })
          .eq("id", editing.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Conta atualizada com sucesso!" });
      } else {
        const { data: created, error } = await supabase.from("contas_financeiras").insert({
          user_id: user.id,
          nome: form.nome.trim(),
          tipo: form.tipo,
          instituicao: form.tipo === "BANCO" ? form.instituicao.trim() || null : null,
          agencia: form.tipo === "BANCO" ? form.agencia.trim() || null : null,
          numero: form.tipo === "BANCO" ? form.numero.trim() || null : null,
          saldo_inicial: saldo,
          saldo_inicial_em: saldoInicialEm,
        }).select("id").single();

        if (error) throw error;
        if (logoFile && created?.id) {
          if (!logoBucketOk) {
            toast({ title: "Logo", description: `Bucket "${LOGO_BUCKET}" não encontrado. ${logoBucketMsg ?? "Verifique no Supabase."} Conta criada sem logo.`, variant: "destructive" });
          } else {
            try {
              const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
              const path = `${user.id}/${created.id}-${Date.now()}.${ext}`;
              const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, logoFile, {
                upsert: true,
                contentType: logoFile.type || "image/*",
              });
              if (uploadError) throw uploadError;
              const pub = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
              const logoUrl = pub.data.publicUrl || null;
              if (logoUrl) {
                await supabase.from("contas_financeiras").update({ logo: logoUrl }).eq("id", created.id);
              }
            } catch (err: unknown) {
              console.error("Falha no upload da logo (criação)", err);
              const msg = err instanceof Error ? err.message : String(err);
              toast({ title: "Logo", description: `Conta criada, mas falhou o envio da logo: ${msg} (bucket: ${LOGO_BUCKET}).`, variant: "destructive" });
            }
          }
        }
        toast({ title: "Sucesso", description: "Conta criada com sucesso!" });
      }

      setOpen(false);
      resetForm();
      fetchContas();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Não foi possível salvar a conta.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
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

              <div className="space-y-2">
                <Label>Logo do Banco</Label>
                {form.logo ? (
                  <img src={form.logo} alt="Logo atual" className="h-10 object-contain" />
                ) : null}
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
              </div>

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
                <div className="space-y-2 sm:col-span-2">
                  <Label>Data do saldo inicial</Label>
                  <Input
                    type="date"
                    value={form.saldo_inicial_em}
                    onChange={(e) => setForm((s) => ({ ...s, saldo_inicial_em: e.target.value }))}
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
                className="pl-9 pr-10"
                placeholder="Buscar por nome, banco, agência, número..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <span className="sr-only">Limpar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              )}
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
                    <th className="text-left p-3 font-medium">Data saldo inicial</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasFiltradas.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={`border-b ${idx % 2 ? "bg-muted/20" : ""}`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{c.nome}</span>
                          {appAccountId === c.id ? (
                            <Badge variant="outline">Aplicação</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={c.tipo === "BANCO" ? "default" : "secondary"}>
                          {c.tipo === "BANCO" ? "Banco" : "Caixa"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {c.logo ? (
                            <img
                              src={c.logo}
                              alt="Logo"
                              className="h-6 w-6 object-contain"
                            />
                          ) : null}
                          <span>{c.instituicao ?? "-"}</span>
                        </div>
                      </td>
                      <td className="p-3">{c.agencia ?? "-"}</td>
                      <td className="p-3">{c.numero ?? "-"}</td>
                      <td className="p-3 text-right">{formatMoney(c.saldo_inicial || 0)}</td>
                      <td className="p-3">{formatYmdBr(c.saldo_inicial_em)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => abrirEditar(c)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {appAccountId === c.id ? (
                                <DropdownMenuItem onClick={() => setAppAccountId(null)}>
                                  <Banknote className="w-4 h-4 mr-2" />
                                  Desmarcar como Conta de Aplicação
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setAppAccountId(c.id)}>
                                  <Banknote className="w-4 h-4 mr-2" />
                                  Marcar como Conta de Aplicação
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => excluirConta(c)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
