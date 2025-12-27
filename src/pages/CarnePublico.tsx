import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ymdToBr } from "@/utils/date";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiParcela = {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  pago_em: string | null;
  pago_valor: number | null;
  pago_obs: string | null;
};

type ApiPayload = {
  participante: {
    id: string;
    status: string;
    desafio: { id: string; titulo: string } | null;
    pessoa: { id: string; nome: string; telefone: string | null; email: string | null; ativo: boolean } | null;
  };
  parcelas: ApiParcela[];
};

export default function CarnePublico() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);

  const titulo = useMemo(() => payload?.participante?.desafio?.titulo ?? "Carnê", [payload]);
  const nome = useMemo(() => payload?.participante?.pessoa?.nome ?? "-", [payload]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setError("Token ausente.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke("carne-por-token", {
        body: { token },
      });
      if (!active) return;
      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }
      setPayload(data as ApiPayload);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">{titulo}</h1>

        <Card>
          <CardHeader>
            <CardTitle>Participante</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <div className="text-sm">
                <div className="font-medium">{nome}</div>
                <div className="text-muted-foreground">
                  {payload?.participante?.pessoa?.telefone ?? "-"} • {payload?.participante?.pessoa?.email ?? "-"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : error ? (
              <div className="text-sm text-muted-foreground">—</div>
            ) : payload?.parcelas?.length ? (
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
                    {payload.parcelas.map((r) => (
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
            ) : (
              <div className="text-sm text-muted-foreground">Sem parcelas.</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

