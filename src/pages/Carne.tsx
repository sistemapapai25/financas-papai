import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { makePublicUrl } from "@/lib/utils";

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
import { ExternalLink, Copy, Share2 } from "lucide-react";

type Desafio = {
  id: string;
  titulo: string;
  valor_mensal: number;
  qtd_parcelas: number;
  ativo: boolean;
};

type Participante = {
  id: string;
  token_link: string;
  status: string;
  pessoa: { id: string; nome: string; telefone: string | null } | null;
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

  const loadDesafios = async () => {
    setLoadingDesafios(true);
    const { data, error } = await supabase
      .from("desafios")
      .select("id,titulo,valor_mensal,qtd_parcelas,ativo")
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
      .select("id,token_link,status,pessoa:pessoas(id,nome,telefone)")
      .eq("desafio_id", dId)
      .order("created_at", { ascending: false });
    setLoadingParticipantes(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setParticipantes((data as unknown as Participante[]) ?? []);
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

  const copyLink = async (token: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado", description: "Link copiado para a área de transferência." });
    } catch {
      toast({ title: "Atenção", description: url });
    }
  };

  const openLink = (token: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareLink = async (token: string, nome: string) => {
    const url = makePublicUrl(`/carne/${token}`);
    try {
      const nav = navigator as unknown as { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (typeof nav.share === "function") {
        await nav.share({ title: `Carnê - ${nome}`, text: url, url });
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
          <CardTitle>Gestão de Carnês</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Acesso restrito para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  const desafioAtual = desafios.find((d) => d.id === desafioId);

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
                  Valor mensal: {Number(desafioAtual.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | 
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
                    <TableHead className="w-32 text-center">Carnê</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.pessoa?.nome ?? "-"}</TableCell>
                      <TableCell>{p.pessoa?.telefone ?? "-"}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openLink(p.token_link)}
                            title="Abrir carnê"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyLink(p.token_link)}
                            title="Copiar link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => shareLink(p.token_link, p.pessoa?.nome ?? "")}
                            title="Compartilhar"
                          >
                            <Share2 className="h-4 w-4" />
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
    </div>
  );
}
