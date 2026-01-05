import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Download, DollarSign } from "lucide-react";

interface PagamentoDesafio {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  pago_em: string;
  pago_valor: number;
  status: string;
  participante: {
    pessoa: {
      nome: string;
    } | null;
    desafio: {
      titulo: string;
    } | null;
  } | null;
}

export default function GestaoFinanceiraDesafios() {
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: pagamentos, isLoading, refetch } = useQuery({
    queryKey: ["gestao-financeira-desafios", dataInicio, dataFim],
    queryFn: async () => {
      // Ajustar datas para cobrir o dia inteiro (UTC handling pode variar, mas string ISO simples resolve a maioria dos casos locais se o banco assumir timezone corretamente ou se usarmos range inclusivo)
      // Para garantir, vamos pegar do inicio do dia ate o fim do dia
      const start = `${dataInicio}T00:00:00`;
      const end = `${dataFim}T23:59:59`;

      const { data, error } = await supabase
        .from("desafio_parcelas")
        .select(`
          id,
          competencia,
          vencimento,
          valor,
          pago_em,
          pago_valor,
          status,
          participante:desafio_participantes (
            pessoa:pessoas (nome),
            desafio:desafios (titulo)
          )
        `)
        .eq("status", "PAGO")
        .gte("pago_em", start)
        .lte("pago_em", end)
        .order("pago_em", { ascending: false });

      if (error) throw error;
      
      // Cast forçado pois o tipo retornado pelo supabase-js as vezes não infere deep joins perfeitamente
      return data as unknown as PagamentoDesafio[];
    },
  });

  const totalArrecadado = pagamentos?.reduce((acc, curr) => acc + (curr.pago_valor || 0), 0) || 0;

  const formatMoney = (v: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleSearch = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Gestão Financeira
          </h1>
          <p className="text-muted-foreground">
            Relatório de recebimentos dos Desafios Financeiros
          </p>
        </div>
      </div>

      {/* Filtros e Resumo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-end w-full lg:w-auto">
              <div className="space-y-2 w-full sm:w-auto">
                <Label>Data Início</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-9 w-full sm:w-[180px]"
                    value={dataInicio} 
                    onChange={e => setDataInicio(e.target.value)} 
                  />
                </div>
              </div>
              <div className="space-y-2 w-full sm:w-auto">
                <Label>Data Fim</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-9 w-full sm:w-[180px]"
                    value={dataFim} 
                    onChange={e => setDataFim(e.target.value)} 
                  />
                </div>
              </div>
              <Button onClick={handleSearch} className="w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>

            <div className="w-full lg:w-auto">
              <div className="bg-green-50/50 border border-green-200 rounded-lg p-4 min-w-[200px]">
                <div className="text-sm font-medium text-green-700 mb-1">Total Arrecadado</div>
                <div className="text-2xl font-bold text-green-700">{formatMoney(totalArrecadado)}</div>
                <p className="text-xs text-green-600 mt-1">
                  {pagamentos?.length || 0} pagamentos no período
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Pagamentos</CardTitle>
          <CardDescription>
            Lista de todas as parcelas baixadas como pagas no período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Desafio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Carregando dados...</TableCell>
                  </TableRow>
                ) : pagamentos?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento encontrado neste período.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagamentos?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {format(parseISO(p.pago_em), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.participante?.pessoa?.nome || "(Desconhecido)"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.participante?.desafio?.titulo || "(Sem Título)"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(p.competencia), "MMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatMoney(p.pago_valor || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
