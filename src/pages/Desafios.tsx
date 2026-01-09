import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  lembrete_dias_antes?: number[];
  ativo: boolean;
  created_at: string;
  participantes_count?: number;
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
  valor_personalizado: number | null;
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
  const [editingDesafioId, setEditingDesafioId] = useState<string | null>(null);
  const [supportsLembreteDias, setSupportsLembreteDias] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorMensal, setValorMensal] = useState("50");
  const [qtdParcelas, setQtdParcelas] = useState("12");
  const [dataInicio, setDataInicio] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");
  const [lembreteDiasAntes, setLembreteDiasAntes] = useState("0,1");
  const [ativo, setAtivo] = useState(true);

  const [pessoas, setPessoas] = useState<PessoaOpt[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
  const [pessoaSel, setPessoaSel] = useState<string>("");
  const [valorPersonalizado, setValorPersonalizado] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingDesafio, setDeletingDesafio] = useState<string | null>(null);

  const [mensagem, setMensagem] = useState("");
  const [destinatario, setDestinatario] = useState<string>("__all__");
  const [sendingMensagem, setSendingMensagem] = useState(false);

  const sortedParticipantes = useMemo(() => {
    const getNome = (p: ParticipanteRow) => (p.pessoas?.nome ?? p.pessoa_id ?? "").trim();
    return [...participantes].sort((a, b) => {
      const na = getNome(a);
      const nb = getNome(b);
      const cmp = na.localeCompare(nb, "pt-BR", { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });
  }, [participantes]);

  const resetForm = () => {
    setEditingDesafioId(null);
    setTitulo("");
    setDescricao("");
    setValorMensal("50");
    setQtdParcelas("12");
    setDataInicio("");
    setDiaVenc("10");
    setLembreteDiasAntes("0,1");
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
    const selectBase =
      "id,titulo,descricao,valor_mensal,qtd_parcelas,data_inicio,dia_vencimento,ativo,created_at,desafio_participantes(count)";
    const selectWithLembrete = `${selectBase},lembrete_dias_antes`;

    let data: unknown[] | null = null;
    let error: { message: string } | null = null;

    const withRes = await supabase.from("desafios").select(selectWithLembrete).order("created_at", { ascending: false });
    if (!withRes.error) {
      data = withRes.data as unknown[];
      setSupportsLembreteDias(true);
    } else if (String(withRes.error.message || "").includes("lembrete_dias_antes") && String(withRes.error.message || "").includes("does not exist")) {
      const withoutRes = await supabase.from("desafios").select(selectBase).order("created_at", { ascending: false });
      data = (withoutRes.data as unknown[]) ?? null;
      error = (withoutRes.error as any) ?? null;
      setSupportsLembreteDias(false);
      toast({
        title: "Atenção",
        description: "Seu banco ainda não tem a coluna de lembretes. Usando padrão 0,1 por enquanto.",
        variant: "destructive",
      });
    } else {
      data = (withRes.data as unknown[]) ?? null;
      error = withRes.error as any;
      setSupportsLembreteDias(true);
    }
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    const list = ((data ?? []) as unknown as (DesafioRow & { desafio_participantes: { count: number }[] })[]).map((d) => ({
      ...d,
      lembrete_dias_antes: Array.isArray(d.lembrete_dias_antes) ? d.lembrete_dias_antes : [0, 1],
      participantes_count: d.desafio_participantes?.[0]?.count ?? 0,
    }));
    setRows(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    if (selectedId && !list.some((d) => d.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  };

  useEffect(() => {
    if (selected) {
      setValorPersonalizado(String(selected.valor_mensal));
    }
  }, [selected]);

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
      .select("id,pessoa_id,status,token_link,token_expires_at,valor_personalizado,pessoas(nome,email,telefone,ativo)")
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

  const handleSaveDesafio = async () => {
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

    const diasRaw = lembreteDiasAntes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));
    const diasInvalidos = diasRaw.some((n) => !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 365);
    if (diasRaw.length === 0 || diasInvalidos) {
      toast({
        title: "Atenção",
        description: "Dias de lembrete inválidos. Ex.: 0,1,3",
        variant: "destructive",
      });
      return;
    }
    const diasLembrete = Array.from(new Set(diasRaw)).sort((a, b) => a - b);

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
    const payloadBase = {
      titulo: titulo.trim(),
      descricao: descricao.trim() ? descricao.trim() : null,
      valor_mensal: valor,
      qtd_parcelas: qtd,
      data_inicio: dataInicio,
      dia_vencimento: dia,
      ativo,
    };
    const payload = supportsLembreteDias ? { ...payloadBase, lembrete_dias_antes: diasLembrete } : payloadBase;

    let result: { data: any; error: any } = editingDesafioId
      ? await supabase.from("desafios").update(payload).eq("id", editingDesafioId).select("id").maybeSingle()
      : await supabase.from("desafios").insert(payload).select("id").maybeSingle();

    if (
      result.error &&
      supportsLembreteDias &&
      String(result.error.message || "").includes("lembrete_dias_antes") &&
      String(result.error.message || "").includes("does not exist")
    ) {
      setSupportsLembreteDias(false);
      toast({
        title: "Atenção",
        description: "Seu banco ainda não tem a coluna de lembretes. Salvando sem essa configuração por enquanto.",
        variant: "destructive",
      });
      result = editingDesafioId
        ? await supabase.from("desafios").update(payloadBase).eq("id", editingDesafioId).select("id").maybeSingle()
        : await supabase.from("desafios").insert(payloadBase).select("id").maybeSingle();
    }
    setSaving(false);

    if (result.error) {
      toast({ title: "Erro", description: result.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: editingDesafioId ? "Desafio atualizado." : "Desafio criado." });
    setOpen(false);
    resetForm();
    await loadDesafios();
    if (result.data?.id) setSelectedId(result.data.id);
  };

  const abrirEditarDesafio = (row: DesafioRow) => {
    setEditingDesafioId(row.id);
    setTitulo(row.titulo ?? "");
    setDescricao(row.descricao ?? "");
    setValorMensal(String(row.valor_mensal ?? 0));
    setQtdParcelas(String(row.qtd_parcelas ?? 12));
    setDataInicio(row.data_inicio ?? "");
    setDiaVenc(String(row.dia_vencimento ?? 10));
    setLembreteDiasAntes((row.lembrete_dias_antes ?? [0, 1]).join(","));
    setAtivo(!!row.ativo);
    setOpen(true);
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

    const valor = Number(valorPersonalizado);
    const valorFinal = Number.isFinite(valor) && valor > 0 && valor !== selected.valor_mensal ? valor : null;

    // Inserir participante
    const { data: insertData, error } = await supabase
      .from("desafio_participantes")
      .insert({
        desafio_id: selectedId,
        pessoa_id: pessoaSel,
        status: "ATIVO",
        participant_user_id: pessoa?.auth_user_id ?? null,
        valor_personalizado: valorFinal,
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
      const valorMsg = valorFinal ?? selected.valor_mensal;
      const mensagem = `Olá, ${pessoa.nome}! 🙌\n\nVocê foi adicionado ao ${selected.titulo}.\n\n📌 Informações do voto\n• Parcelamento: ${selected.qtd_parcelas}x\n• Vencimento: dia ${selected.dia_vencimento}\n\n🔑 Chave PIX: 44582345000176\n🏛 Em nome de: Igreja Apostólica e Profética Águas Purificadoras\n\nObrigado pela sua fidelidade! Deus abençoe sua vida e sua casa! 🙏`;

      const enviado = await enviarWhatsApp(pessoa.telefone, mensagem);
      if (enviado) {
        toast({ title: "WhatsApp enviado", description: `Mensagem enviada para ${pessoa.nome}` });
      } else {
        toast({ title: "Aviso", description: "Não foi possível enviar WhatsApp, mas o participante foi adicionado.", variant: "destructive" });
      }
    }

    setAdding(false);
    setPessoaSel("");
    if (selected) setValorPersonalizado(String(selected.valor_mensal));
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

  const excluirDesafio = async (row: DesafioRow) => {
    if (!canManage) return;
    if (!confirm(`Excluir o desafio "${row.titulo}"? Todos os participantes e parcelas serão removidos.`)) return;

    setDeletingDesafio(row.id);
    try {
      // Buscar participantes do desafio
      const { data: parts } = await supabase
        .from("desafio_participantes")
        .select("id")
        .eq("desafio_id", row.id);

      // Excluir parcelas de todos os participantes
      if (parts && parts.length > 0) {
        const partIds = parts.map((p) => p.id);
        await supabase.from("desafio_parcelas").delete().in("participante_id", partIds);
      }

      // Excluir participantes
      await supabase.from("desafio_participantes").delete().eq("desafio_id", row.id);

      // Excluir desafio
      const { error } = await supabase.from("desafios").delete().eq("id", row.id);
      if (error) throw error;

      toast({ title: "Excluído", description: `Desafio "${row.titulo}" removido.` });
      
      // Atualizar lista
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      if (selectedId === row.id) {
        setSelectedId(rows.find((r) => r.id !== row.id)?.id ?? null);
      }
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao excluir", variant: "destructive" });
    } finally {
      setDeletingDesafio(null);
    }
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

  const excluirParticipante = async (p: ParticipanteRow) => {
    if (!canManage || !selectedId) return;
    const nome = p.pessoas?.nome || "participante";
    if (!confirm(`Excluir ${nome} deste desafio? As parcelas também serão removidas.`)) return;

    setDeleting(p.id);
    try {
      // Primeiro excluir as parcelas
      const { error: parcelasError } = await supabase
        .from("desafio_parcelas")
        .delete()
        .eq("participante_id", p.id);

      if (parcelasError) throw parcelasError;

      // Depois excluir o participante
      const { error } = await supabase
        .from("desafio_participantes")
        .delete()
        .eq("id", p.id);

      if (error) throw error;

      toast({ title: "Excluído", description: `${nome} removido do desafio.` });
      loadParticipantes(selectedId);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao excluir", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const enviarMensagem = async () => {
    if (!canManage) return;
    if (!selectedId || !selected) {
      toast({ title: "Atenção", description: "Selecione um desafio.", variant: "destructive" });
      return;
    }

    const msg = mensagem.trim();
    if (!msg) {
      toast({ title: "Atenção", description: "Digite uma mensagem.", variant: "destructive" });
      return;
    }

    const lista =
      destinatario === "__all__"
        ? sortedParticipantes
            .map((p) => ({
              id: p.id,
              nome: p.pessoas?.nome ?? "Participante",
              telefone: p.pessoas?.telefone ?? null,
              token: p.token_link,
              valor: p.valor_personalizado ?? selected.valor_mensal,
            }))
            .filter((p) => !!p.telefone)
        : (() => {
            const p = sortedParticipantes.find((x) => x.id === destinatario);
            if (!p) return [];
            return [
              {
                id: p.id,
                nome: p.pessoas?.nome ?? "Participante",
                telefone: p.pessoas?.telefone ?? null,
                token: p.token_link,
                valor: p.valor_personalizado ?? selected.valor_mensal,
              },
            ].filter((x) => !!x.telefone);
          })();

    if (lista.length === 0) {
      toast({ title: "Atenção", description: "Nenhum participante com telefone para enviar.", variant: "destructive" });
      return;
    }

    setSendingMensagem(true);
    let enviados = 0;
    let falhas = 0;

    const pixKey = "44582345000176";

    for (const item of lista) {
      let textoFinal = msg;
      
      // Substituição de variáveis
      const primeiroNome = item.nome.split(" ")[0];
      const valorFormatado = formatCurrency(item.valor);

      textoFinal = textoFinal.replace(/{nome}/gi, primeiroNome);
      textoFinal = textoFinal.replace(/{nome_completo}/gi, item.nome);
      textoFinal = textoFinal.replace(/{desafio}/gi, selected.titulo);
      textoFinal = textoFinal.replace(/{valor}/gi, valorFormatado);
      textoFinal = textoFinal.replace(/{pix}/gi, pixKey);

      const ok = await enviarWhatsApp(item.telefone as string, textoFinal);
      if (ok) enviados++;
      else falhas++;
      // Intervalo de 5 segundos para evitar bloqueios no WhatsApp
      await new Promise((r) => setTimeout(r, 5000));
    }

    setSendingMensagem(false);

    if (falhas > 0) {
      toast({
        title: "Envio concluído",
        description: `Enviados: ${enviados}. Falhas: ${falhas}.`,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Envio concluído", description: `Mensagem enviada para ${enviados} participante(s).` });
    setMensagem("");
  };

  if (!user) return null;

  if (!roleLoading && !isAdmin) {
    return (
      <Card>
        <CardHeader>
            <CardTitle>Desafios Cadastrados</CardTitle>
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
        <h1 className="text-2xl font-bold">Gestão de Desafios</h1>
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
              <DialogTitle>{editingDesafioId ? "Editar desafio" : "Novo desafio"}</DialogTitle>
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
              <div className="space-y-2">
                <Label>Quando enviar os lembretes</Label>
                <Input
                  value={lembreteDiasAntes}
                  onChange={(e) => setLembreteDiasAntes(e.target.value)}
                  placeholder="Ex.: 0,1,3"
                  inputMode="text"
                />
                <div className="text-xs text-muted-foreground">
                  Digite números separados por vírgula. Ex.: 0,1 ou 0,1,3. 0 = no dia do vencimento. 1 = 1 dia antes. 2 = 2 dias antes.
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveDesafio} disabled={saving}>
                {editingDesafioId ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Desafios</CardTitle>
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
                      <TableHead className="w-28 text-center">Participantes</TableHead>
                      <TableHead className="w-24">Ativo</TableHead>
                      <TableHead className="w-52">Ações</TableHead>
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
                        <TableCell className="text-center">{r.participantes_count ?? 0}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Switch checked={r.ativo} onCheckedChange={() => toggleDesafioAtivo(r)} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => abrirEditarDesafio(r)}>
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingDesafio === r.id}
                              onClick={() => excluirDesafio(r)}
                            >
                              {deletingDesafio === r.id ? "..." : "Excluir"}
                            </Button>
                          </div>
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
            <CardTitle>Participantes do Desafio: {selected?.titulo ?? "Nenhum selecionado"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">Selecione um desafio.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Adicionar pessoa</Label>
                    <Select value={pessoaSel} onValueChange={(val) => setPessoaSel(val ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(pessoas ?? [])
                          .filter((p) => p.ativo && p.id)
                          .map((p) => (
                            <SelectItem key={`pessoa-${p.id}`} value={p.id}>
                              {p.nome ?? "(sem nome)"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Mensal</Label>
                    <Input
                      value={valorPersonalizado}
                      onChange={(e) => setValorPersonalizado(e.target.value)}
                      inputMode="decimal"
                      placeholder={formatCurrency(selected.valor_mensal)}
                    />
                  </div>
                  <div>
                    <Button onClick={addParticipante} disabled={adding || !pessoaSel} className="w-full">
                      Adicionar
                    </Button>
                  </div>
                </div>

                {participantes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum participante.</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead className="w-40">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedParticipantes.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.pessoas?.nome ?? p.pessoa_id}
                              <div className="text-xs text-muted-foreground">
                                {p.pessoas?.telefone ?? "-"} • {p.pessoas?.email ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => excluirParticipante(p)}
                                disabled={deleting === p.id}
                              >
                                {deleting === p.id ? "..." : "Excluir"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="space-y-2 flex-1">
                      <Label>Enviar para</Label>
                      <Select value={destinatario} onValueChange={setDestinatario}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos os participantes</SelectItem>
                          {sortedParticipantes.map((p) => (
                            <SelectItem key={`dest-${p.id}`} value={p.id}>
                              {p.pessoas?.nome ?? p.pessoa_id}
                              {!p.pessoas?.telefone ? " (sem telefone)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:w-40">
                      <Button
                        className="w-full"
                        onClick={enviarMensagem}
                        disabled={sendingMensagem || !mensagem.trim() || participantes.length === 0}
                      >
                        {sendingMensagem ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Digite a mensagem para os participantes..."
                      rows={4}
                    />
                    <div className="text-xs text-muted-foreground">
                      Códigos disponíveis: <strong>{`{nome}`}</strong> (primeiro nome), <strong>{`{nome_completo}`}</strong>, <strong>{`{desafio}`}</strong> (título do desafio), <strong>{`{valor}`}</strong> (valor mensal), <strong>{`{pix}`}</strong> (chave pix).
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
