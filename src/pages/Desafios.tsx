import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { makePublicUrl } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

type DesafioRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  valor_mensal: number;
  qtd_parcelas: number;
  data_inicio: string;
  dia_vencimento: number;
  ativo: boolean;
  created_at: string;
};

type PessoaOpt = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  auth_user_id: string | null;
};

type ParticipanteRow = {
  id: string;
  pessoa_id: string;
  status: string;
  token_link: string;
  token_expires_at: string | null;
  pessoas: { nome: string; email: string | null; telefone: string | null; ativo: boolean } | null;
};

export default function Desafios() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const canManage = useMemo(() => !!user && !roleLoading && isAdmin, [user, roleLoading, isAdmin]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DesafioRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorMensal, setValorMensal] = useState("50");
  const [qtdParcelas, setQtdParcelas] = useState("12");
  const [dataInicio, setDataInicio] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");
  const [ativo, setAtivo] = useState(true);

  const [pessoas, setPessoas] = useState<PessoaOpt[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
  const [pessoaSel, setPessoaSel] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setValorMensal("50");
    setQtdParcelas("12");
    setDataInicio("");
    setDiaVenc("10");
    setAtivo(true);
  };

  const loadDesafios = async () => {
    if (!user) return;
    if (!canManage) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("desafios")
      .select("id,titulo,descricao,valor_mensal,qtd_parcelas,data_inicio,dia_vencimento,ativo,created_at")
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    const list = (data as unknown as DesafioRow[]) ?? [];
    setRows(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    if (selectedId && !list.some((d) => d.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  };

  const loadPessoas = async () => {
    if (!canManage) return;
    const { data, error } = await supabase
      .from("pessoas")
      .select("id,nome,email,telefone,ativo,auth_user_id")
      .order("nome", { ascending: true });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setPessoas((data as unknown as PessoaOpt[]) ?? []);
  };

  const loadParticipantes = async (desafioId: string) => {
    if (!canManage) return;
    const { data, error } = await supabase
      .from("desafio_participantes")
      .select("id,pessoa_id,status,token_link,token_expires_at,pessoas(nome,email,telefone,ativo)")
      .eq("desafio_id", desafioId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setParticipantes((data as unknown as ParticipanteRow[]) ?? []);
  };

  useEffect(() => {
    loadDesafios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canManage]);

  useEffect(() => {
    if (!canManage) return;
    loadPessoas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    if (!selectedId || !canManage) {
      setParticipantes([]);
      return;
    }
    loadParticipantes(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, canManage]);

  const handleCreate = async () => {
    if (!canManage) return;
    if (!titulo.trim()) {
      toast({ title: "Atenção", description: "Informe o título.", variant: "destructive" });
      return;
    }
    if (!dataInicio) {
      toast({ title: "Atenção", description: "Informe a data de início.", variant: "destructive" });
      return;
    }

    const valor = Number(valorMensal);
    const qtd = Number(qtdParcelas);
    const dia = Number(diaVenc);

    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: "Atenção", description: "Valor mensal inválido.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(qtd) || qtd < 1) {
      toast({ title: "Atenção", description: "Quantidade de parcelas inválida.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(dia) || dia < 1 || dia > 31) {
      toast({ title: "Atenção", description: "Dia de vencimento inválido.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("desafios")
      .insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() ? descricao.trim() : null,
        valor_mensal: valor,
        qtd_parcelas: qtd,
        data_inicio: dataInicio,
        dia_vencimento: dia,
        ativo,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Desafio criado." });
    setOpen(false);
    resetForm();
    await loadDesafios();
    if (data?.id) setSelectedId(data.id);
  };

  const enviarWhatsApp = async (numero: string, mensagem: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: { numero, mensagem },
      });
      if (error) {
        console.error("Erro ao enviar WhatsApp:", error);
        return false;
      }
      console.log("WhatsApp enviado:", data);
      return true;
    } catch (e) {
      console.error("Erro ao enviar WhatsApp:", e);
      return false;
    }
  };

  const addParticipante = async () => {
    if (!canManage) return;
    if (!selectedId) return;
    if (!pessoaSel) {
      toast({ title: "Atenção", description: "Selecione uma pessoa.", variant: "destructive" });
      return;
    }

    const pessoa = pessoas.find((p) => p.id === pessoaSel) ?? null;
    setAdding(true);

    // Inserir participante
    const { data: insertData, error } = await supabase
      .from("desafio_participantes")
      .insert({
        desafio_id: selectedId,
        pessoa_id: pessoaSel,
        status: "ATIVO",
        participant_user_id: pessoa?.auth_user_id ?? null,
      })
      .select("token_link")
      .maybeSingle();

    if (error) {
      setAdding(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Participante adicionado e carnê gerado." });

    // Enviar mensagem WhatsApp se a pessoa tiver telefone
    if (pessoa?.telefone && selected) {
      const link = makePublicUrl(`/carne/${insertData?.token_link}`);
      const mensagem = `Olá ${pessoa.nome}! 🎉\n\nVocê foi adicionado ao desafio *${selected.titulo}*.\n\n💰 Valor mensal: ${formatCurrency(selected.valor_mensal)}\n📅 Parcelas: ${selected.qtd_parcelas}x\n📆 Vencimento: dia ${selected.dia_vencimento}\n\nAcesse seu carnê pelo link:\n${link}\n\nDeus abençoe!`;

      const enviado = await enviarWhatsApp(pessoa.telefone, mensagem);
      if (enviado) {
        toast({ title: "WhatsApp enviado", description: `Mensagem enviada para ${pessoa.nome}` });
      } else {
        toast({ title: "Aviso", description: "Não foi possível enviar WhatsApp, mas o participante foi adicionado.", variant: "destructive" });
      }
    }

    setAdding(false);
    setPessoaSel("");
    loadParticipantes(selectedId);
  };

  const toggleDesafioAtivo = async (row: DesafioRow) => {
    if (!canManage) return;
    const { error } = await supabase.from("desafios").update({ ativo: !row.ativo }).eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ativo: !r.ativo } : r)));
  };

  const copyLink = async (token: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado", description: "Link copiado." });
    } catch {
      toast({ title: "Atenção", description: url });
    }
  };

  const openLink = (token: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareLink = async (token: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    try {
      const nav = navigator as unknown as { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (typeof nav.share === "function") {
        await nav.share({ title: "Carnê", text: url, url });
        toast({ title: "Compartilhado", description: "Link compartilhado." });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado", description: "Link copiado." });
    } catch {
      toast({ title: "Atenção", description: url });
    }
  };

  if (!user) return null;

  if (!roleLoading && !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Desafios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Acesso restrito para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Desafios</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo desafio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Desafio 2026" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor mensal</Label>
                  <Input value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input value={qtdParcelas} onChange={(e) => setQtdParcelas(e.target.value)} inputMode="numeric" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de início</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Dia do vencimento</Label>
                  <Input value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)} inputMode="numeric" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lista</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum desafio cadastrado.</div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-24">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className={r.id === selectedId ? "bg-muted/40" : ""}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <TableCell className="font-medium">{r.titulo}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Switch checked={r.ativo} onCheckedChange={() => toggleDesafioAtivo(r)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">Selecione um desafio.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adicionar pessoa</Label>
                    <Select value={pessoaSel} onValueChange={setPessoaSel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {pessoas
                          .filter((p) => p.ativo)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addParticipante} disabled={adding || !pessoaSel} className="w-full">
                      Adicionar e gerar carnê
                    </Button>
                  </div>
                </div>

                {participantes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum participante.</div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead className="w-40">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participantes.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.pessoas?.nome ?? p.pessoa_id}
                              <div className="text-xs text-muted-foreground">
                                {p.pessoas?.telefone ?? "-"} • {p.pessoas?.email ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => openLink(p.token_link)}>
                                  Abrir
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => shareLink(p.token_link)}>
                                  Compartilhar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
