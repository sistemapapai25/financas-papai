import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      .select("id,status,pessoa:pessoas(id,nome,telefone)")
      .eq("desafio_id", dId)
      .order("created_at", { ascending: false });
    setLoadingParticipantes(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setParticipantes((data as unknown as Participante[]) ?? []);
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
    loadParcelas(p.id);
  };

  const closeModal = () => {
    setSelectedParticipante(null);
    setParcelas([]);
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
              {desafioAtual && (
                <div className="text-sm text-muted-foreground">
                  Valor mensal: {formatCurrency(desafioAtual.valor_mensal)} | 
                  Parcelas: {desafioAtual.qtd_parcelas}
                </div>
              )}
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
      <Dialog open={!!selectedParticipante} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Carnê de {selectedParticipante?.pessoa?.nome ?? "Participante"} - {desafioAtual?.titulo}
            </DialogTitle>
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
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead>Valor Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelas.map((parcela) => (
                      <TableRow key={parcela.id}>
                        <TableCell>{formatDate(parcela.competencia)}</TableCell>
                        <TableCell>{formatDate(parcela.vencimento)}</TableCell>
                        <TableCell>{formatCurrency(parcela.valor)}</TableCell>
                        <TableCell>{getStatusBadge(parcela.status)}</TableCell>
                        <TableCell>{parcela.pago_em ? new Date(parcela.pago_em).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{parcela.pago_valor ? formatCurrency(parcela.pago_valor) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
