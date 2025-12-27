import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ymdToBr } from "@/utils/date";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type Participacao = {
  id: string;
  desafio_id: string;
  token_link: string;
  desafio: { id: string; titulo: string; valor_mensal: number; qtd_parcelas: number; data_inicio: string; dia_vencimento: number } | null;
};

type Parcela = {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  pago_em: string | null;
  pago_valor: number | null;
  pago_obs: string | null;
};

export default function Carne() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);
  const [participacaoId, setParticipacaoId] = useState<string>("");
  const current = useMemo(() => participacoes.find((p) => p.id === participacaoId) ?? null, [participacoes, participacaoId]);

  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  const loadParticipacoes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("desafio_participantes")
      .select("id,desafio_id,token_link,desafio:desafios(id,titulo,valor_mensal,qtd_parcelas,data_inicio,dia_vencimento)")
      .eq("participant_user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    const list = (data as unknown as Participacao[]) ?? [];
    setParticipacoes(list);
    if (!participacaoId && list.length > 0) setParticipacaoId(list[0].id);
    if (participacaoId && !list.some((p) => p.id === participacaoId)) setParticipacaoId(list[0]?.id ?? "");
  };

  const loadParcelas = async (pid: string) => {
    setLoadingParcelas(true);
    const { data, error } = await supabase
      .from("desafio_parcelas")
      .select("id,competencia,vencimento,valor,status,pago_em,pago_valor,pago_obs")
      .eq("participante_id", pid)
      .order("competencia", { ascending: true });
    setLoadingParcelas(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setParcelas((data as unknown as Parcela[]) ?? []);
  };

  useEffect(() => {
    loadParticipacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!participacaoId) {
      setParcelas([]);
      return;
    }
    loadParcelas(participacaoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participacaoId]);

  const copyMyLink = async () => {
    if (!current) return;
    const url = `${window.location.origin}/carne/${current.token_link}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado", description: "Link copiado." });
    } catch {
      toast({ title: "Atenção", description: url });
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Meu carnê</h1>
        {current ? (
          <Button variant="outline" onClick={copyMyLink}>
            Copiar link
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desafio</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : participacoes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum carnê vinculado ao seu usuário ainda.
            </div>
          ) : (
            <div className="max-w-md">
              <Select value={participacaoId} onValueChange={setParticipacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {participacoes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.desafio?.titulo ?? p.desafio_id}
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
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingParcelas ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : parcelas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem parcelas.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{ymdToBr(r.competencia)}</TableCell>
                      <TableCell>{ymdToBr(r.vencimento)}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>{r.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

