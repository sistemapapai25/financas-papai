import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Desafio = {
  id: string;
  titulo: string;
  valor_mensal: number;
  qtd_parcelas: number;
  ativo: boolean;
};

type Participante = {
  id: string;
  status: string;
  valor_personalizado: number | null;
  pessoa: { id: string; nome: string; telefone: string | null } | null;
};

type Parcela = {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  pago_em: string | null;
  pago_valor: number | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatCurrencyInput = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

const parseCurrencyInput = (value: string): number => {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "PAGO":
      return <Badge className="bg-green-500">Pago</Badge>;
    case "ABERTO":
      return <Badge variant="outline">Em Aberto</Badge>;
    case "VENCIDO":
      return <Badge variant="destructive">Vencido</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function Carne() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [desafioId, setDesafioId] = useState<string>("");
  const [loadingDesafios, setLoadingDesafios] = useState(true);

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  // Modal de parcelas
  const [selectedParticipante, setSelectedParticipante] = useState<Participante | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  // Modal de pagamento
  const [parcelaPagamento, setParcelaPagamento] = useState<Parcela | null>(null);
  const [parcelaIndex, setParcelaIndex] = useState<number>(0);
  const [valorPago, setValorPago] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // Edição de valor mensal
  const [editingValor, setEditingValor] = useState(false);
  const [novoValorMensal, setNovoValorMensal] = useState("");
  const [salvandoValor, setSalvandoValor] = useState(false);

  // Edição de parcela individual
  const [editingParcelaId, setEditingParcelaId] = useState<string | null>(null);
  const [novoValorParcela, setNovoValorParcela] = useState("");
  const [salvandoParcela, setSalvandoParcela] = useState(false);

  const loadDesafios = async () => {
    setLoadingDesafios(true);
    const { data, error } = await supabase
      .from("desafios")
      .select("id,titulo,valor_mensal,qtd_parcelas,ativo")
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    setLoadingDesafios(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    const list = (data as Desafio[]) ?? [];
    setDesafios(list);
    if (!desafioId && list.length > 0) setDesafioId(list[0].id);
  };

  const loadParticipantes = async (dId: string) => {
    if (!dId) {
      setParticipantes([]);
      return;
    }
    setLoadingParticipantes(true);
    const { data, error } = await supabase
      .from("desafio_participantes")
      .select("id,status,valor_personalizado,pessoa:pessoas(id,nome,telefone)")
      .eq("desafio_id", dId);
    
    setLoadingParticipantes(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    const list = (data as unknown as Participante[]) ?? [];

    // Ordenar por nome (ordem alfabética)
    list.sort((a, b) => {
      const nomeA = a.pessoa?.nome?.toLowerCase() ?? "";
      const nomeB = b.pessoa?.nome?.toLowerCase() ?? "";
      return nomeA.localeCompare(nomeB);
    });

    setParticipantes(list);
  };

  const loadParcelas = async (participanteId: string) => {
    setLoadingParcelas(true);
    const { data, error } = await supabase
      .from("desafio_parcelas")
      .select("id,competencia,vencimento,valor,status,pago_em,pago_valor")
      .eq("participante_id", participanteId)
      .order("vencimento", { ascending: true });
    setLoadingParcelas(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setParcelas((data as Parcela[]) ?? []);
  };

  const handleClickParticipante = (p: Participante) => {
    setSelectedParticipante(p);
    setEditingValor(false);
    setNovoValorMensal("");
    loadParcelas(p.id);
  };

  const closeModal = () => {
    setSelectedParticipante(null);
    setParcelas([]);
    setEditingValor(false);
    setEditingParcelaId(null);
  };

  const abrirModalPagamento = (parcela: Parcela, index: number) => {
    setParcelaPagamento(parcela);
    setParcelaIndex(index);
    setValorPago(formatCurrencyInput(parcela.valor));
    setDataPagamento(new Date().toISOString().split("T")[0]);
  };

  const fecharModalPagamento = () => {
    setParcelaPagamento(null);
    setValorPago("");
    setDataPagamento("");
  };

  const desfazerPagamento = async () => {
    if (!parcelaPagamento || !selectedParticipante) return;

    if (!confirm("Tem certeza que deseja desfazer este pagamento?")) return;

    setSalvandoPagamento(true);

    const { error } = await supabase
      .from("desafio_parcelas")
      .update({
        status: "ABERTO",
        pago_valor: null,
        pago_em: null,
      })
      .eq("id", parcelaPagamento.id);

    setSalvandoPagamento(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive", duration: 3000 });
      return;
    }

    toast({ title: "Sucesso", description: "Pagamento desfeito!", duration: 3000 });
    fecharModalPagamento();

    // Recarregar parcelas
    if (selectedParticipante) {
      loadParcelas(selectedParticipante.id);
    }
  };

  const handleUpdateValor = async () => {
    if (!selectedParticipante) return;
    const valor = parseCurrencyInput(novoValorMensal);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }

    setSalvandoValor(true);
    const { error } = await supabase.rpc("atualizar_valor_participante" as any, {
      _participante_id: selectedParticipante.id,
      _novo_valor: valor,
    });
    setSalvandoValor(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Valor atualizado e parcelas em aberto recalculadas." });
    setEditingValor(false);
    
    // Atualizar estado local
    const updatedParticipante = { ...selectedParticipante, valor_personalizado: valor };
    setSelectedParticipante(updatedParticipante);
    setParticipantes((prev) => prev.map((p) => (p.id === updatedParticipante.id ? updatedParticipante : p)));
    loadParcelas(updatedParticipante.id);
  };

  const handleUpdateParcela = async (parcelaId: string) => {
    const valor = parseCurrencyInput(novoValorParcela);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }

    setSalvandoParcela(true);
    const { error } = await supabase.rpc("atualizar_valor_parcela" as any, {
      _parcela_id: parcelaId,
      _novo_valor: valor,
    });
    setSalvandoParcela(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Valor da parcela atualizado." });
    setEditingParcelaId(null);
    
    // Atualizar estado local
    setParcelas((prev) => prev.map((p) => (p.id === parcelaId ? { ...p, valor } : p)));
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

  const confirmarPagamento = async () => {
    if (!parcelaPagamento || !selectedParticipante) return;

    const valor = parseCurrencyInput(valorPago);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido.", variant: "destructive" });
      return;
    }

    if (!dataPagamento) {
      toast({ title: "Atenção", description: "Informe a data de pagamento.", variant: "destructive" });
      return;
    }

    setSalvandoPagamento(true);

    const { error } = await supabase
      .from("desafio_parcelas")
      .update({
        status: "PAGO",
        pago_valor: valor,
        pago_em: new Date(dataPagamento + "T12:00:00").toISOString(),
      })
      .eq("id", parcelaPagamento.id);

    if (error) {
      setSalvandoPagamento(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Pagamento registrado!", duration: 3000 });

    // Enviar mensagem de agradecimento no WhatsApp
    const telefone = selectedParticipante.pessoa?.telefone;
    const nome = selectedParticipante.pessoa?.nome || "Irmão(ã)";
    const desafioAtual = desafios.find((d) => d.id === desafioId);
    const numeroParcela = `${parcelaIndex + 1}/${desafioAtual?.qtd_parcelas || "?"}`;

    if (telefone) {
      const mensagem = `Olá ${nome}! 🙏\n\nAgradecemos de coração pelo seu pagamento da *parcela ${numeroParcela}* no valor de ${formatCurrency(valor)} referente ao desafio *${desafioAtual?.titulo}*.\n\nSua fidelidade na aliança feita com Deus é inspiradora e abençoa a todos nós!\n\n"O Senhor é fiel em todas as suas promessas e bondoso em tudo o que faz." - Salmos 145:13\n\nQue Deus continue abençoando sua vida abundantemente! 🙌`;

      const enviado = await enviarWhatsApp(telefone, mensagem);
      if (enviado) {
        toast({ title: "WhatsApp enviado", description: `Mensagem de agradecimento enviada para ${nome}`, duration: 3000 });
      } else {
        toast({ title: "Aviso", description: "Pagamento registrado, mas não foi possível enviar WhatsApp.", variant: "destructive", duration: 4000 });
      }
    }

    setSalvandoPagamento(false);
    fecharModalPagamento();

    // Recarregar parcelas
    if (selectedParticipante) {
      loadParcelas(selectedParticipante.id);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadDesafios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => {
    if (desafioId) {
      loadParticipantes(desafioId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desafioId]);

  if (!user) return null;

  if (!roleLoading && !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Carnês</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Acesso restrito para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  const desafioAtual = desafios.find((d) => d.id === desafioId);

  // Calcular resumo das parcelas
  const totalParcelas = parcelas.length;
  const parcelasPagas = parcelas.filter((p) => p.status === "PAGO").length;
  const totalPago = parcelas.filter((p) => p.status === "PAGO").reduce((acc, p) => acc + (p.pago_valor || p.valor), 0);
  const totalPendente = parcelas.filter((p) => p.status !== "PAGO").reduce((acc, p) => acc + p.valor, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Carnês</h1>

      <Card>
        <CardHeader>
          <CardTitle>Selecione o Desafio</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDesafios ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : desafios.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum desafio cadastrado.</div>
          ) : (
            <div className="max-w-md space-y-4">
              <Select value={desafioId} onValueChange={setDesafioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um desafio" />
                </SelectTrigger>
                <SelectContent>
                  {desafios.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.titulo} {!d.ativo && "(Inativo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participantes ({participantes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingParticipantes ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : participantes.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum participante neste desafio.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantes.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleClickParticipante(p)}>
                      <TableCell className="font-medium text-primary underline">{p.pessoa?.nome ?? "-"}</TableCell>
                      <TableCell>{p.pessoa?.telefone ?? "-"}</TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Parcelas */}
      <Dialog open={!!selectedParticipante && !parcelaPagamento} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Carnê de {selectedParticipante?.pessoa?.nome ?? "Participante"} - {desafioAtual?.titulo}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              {!editingValor ? (
                <>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>
                      Valor mensal padrão:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(
                          selectedParticipante?.valor_personalizado ?? desafioAtual?.valor_mensal ?? 0
                        )}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        setNovoValorMensal(
                          formatCurrencyInput(
                            selectedParticipante?.valor_personalizado ?? desafioAtual?.valor_mensal ?? 0
                          )
                        );
                        setEditingValor(true);
                      }}
                      title="Alterar valor de todas as parcelas em aberto"
                    >
                      Alterar todas as parcelas
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 w-24 text-sm"
                    value={novoValorMensal}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const num = parseInt(raw || "0", 10) / 100;
                      setNovoValorMensal(formatCurrencyInput(num));
                    }}
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={handleUpdateValor} disabled={salvandoValor}>
                    {salvandoValor ? "..." : "Salvar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditingValor(false)}
                    disabled={salvandoValor}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {loadingParcelas ? (
            <div className="text-sm text-muted-foreground py-4">Carregando parcelas...</div>
          ) : parcelas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Nenhuma parcela encontrada.</div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Parcelas</div>
                  <div className="text-lg font-bold">{totalParcelas}</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Pagas</div>
                  <div className="text-lg font-bold text-green-600">{parcelasPagas}</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Pago</div>
                  <div className="text-lg font-bold text-green-600">{formatCurrency(totalPago)}</div>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Pendente</div>
                  <div className="text-lg font-bold text-orange-600">{formatCurrency(totalPendente)}</div>
                </div>
              </div>

              {/* Tabela de Parcelas */}
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead>Valor Pago</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelas.map((parcela, index) => (
                      <TableRow key={parcela.id}>
                        <TableCell className="font-medium">{index + 1}/{desafioAtual?.qtd_parcelas}</TableCell>
                        <TableCell>{formatDate(parcela.vencimento)}</TableCell>
                        <TableCell>
                          {editingParcelaId === parcela.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-7 w-20 text-sm p-1"
                                value={novoValorParcela}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^\d]/g, "");
                                  const num = parseInt(raw || "0", 10) / 100;
                                  setNovoValorParcela(formatCurrencyInput(num));
                                }}
                              />
                              <Button
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleUpdateParcela(parcela.id)}
                                disabled={salvandoParcela}
                              >
                                ✓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingParcelaId(null)}
                                disabled={salvandoParcela}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{formatCurrency(parcela.valor)}</span>
                              {parcela.status === "ABERTO" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                  onClick={() => {
                                    setNovoValorParcela(formatCurrencyInput(parcela.valor));
                                    setEditingParcelaId(parcela.id);
                                  }}
                                  title="Editar valor desta parcela"
                                >
                                  ✎
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(parcela.status)}</TableCell>
                        <TableCell>{parcela.pago_em ? new Date(parcela.pago_em).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{parcela.pago_valor ? formatCurrency(parcela.pago_valor) : "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant={parcela.status === "PAGO" ? "outline" : "default"} onClick={() => abrirModalPagamento(parcela, index)}>
                            {parcela.status === "PAGO" ? "Ver" : "Pagar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      <Dialog open={!!parcelaPagamento} onOpenChange={(open) => !open && fecharModalPagamento()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{parcelaPagamento?.status === "PAGO" ? "Detalhes do Pagamento" : "Registrar Pagamento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Parcela</div>
              <div className="text-xl font-bold">
                {parcelaIndex + 1}/{desafioAtual?.qtd_parcelas}
              </div>
              <div className="font-medium mt-2">
                Vencimento: {parcelaPagamento ? formatDate(parcelaPagamento.vencimento) : "-"}
              </div>
              <div className="font-medium">
                Valor: {parcelaPagamento ? formatCurrency(parcelaPagamento.valor) : "-"}
              </div>
              {parcelaPagamento?.status === "PAGO" && (
                <div className="mt-2 pt-2 border-t">
                  <div className="font-medium text-green-600">
                    Pago em: {parcelaPagamento.pago_em ? new Date(parcelaPagamento.pago_em).toLocaleDateString("pt-BR") : "-"}
                  </div>
                  <div className="font-medium text-green-600">
                    Valor Pago: {parcelaPagamento.pago_valor ? formatCurrency(parcelaPagamento.pago_valor) : "-"}
                  </div>
                </div>
              )}
            </div>

            {parcelaPagamento?.status !== "PAGO" && (
              <>
                <div className="space-y-2">
                  <Label>Valor Pago</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={valorPago}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const num = parseInt(raw || "0", 10) / 100;
                      setValorPago(formatCurrencyInput(num));
                    }}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {parcelaPagamento?.status === "PAGO" && (
              <Button variant="destructive" onClick={desfazerPagamento} disabled={salvandoPagamento} className="w-full sm:w-auto">
                {salvandoPagamento ? "Desfazendo..." : "Desfazer Pagamento"}
              </Button>
            )}
            <Button variant="outline" onClick={fecharModalPagamento} disabled={salvandoPagamento}>
              {parcelaPagamento?.status === "PAGO" ? "Fechar" : "Cancelar"}
            </Button>
            {parcelaPagamento?.status !== "PAGO" && (
              <Button onClick={confirmarPagamento} disabled={salvandoPagamento}>
                {salvandoPagamento ? "Salvando..." : "Confirmar Pagamento"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
