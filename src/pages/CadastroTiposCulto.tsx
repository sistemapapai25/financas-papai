// src/pages/CadastroTiposCulto.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type TipoCultoRow = Database["public"]["Tables"]["tipos_culto"]["Row"];
type TipoCultoInsert = Database["public"]["Tables"]["tipos_culto"]["Insert"];

export default function CadastroTiposCulto() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoCultoRow[]>([]);
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data, error } = await supabase
      .from("tipos_culto")
      .select("*")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar os tipos", variant: "destructive" });
      return;
    }
    setTipos(data ?? []);
  }

  async function adicionar() {
    if (!nome.trim()) {
      toast({ title: "Atenção", description: "Informe o nome do tipo de culto.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const payload: TipoCultoInsert = {
      nome: nome.trim(),
      ordem: ordem ? Number(ordem) : undefined, // usa default 0 se vazio
      ativo: true, // opcional (default true no banco)
    };

    const { error } = await supabase.from("tipos_culto").insert([payload]);
    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: error.code === "23505" ? "Já existe um tipo com esse nome." : "Não foi possível criar.",
        variant: "destructive",
      });
      return;
    }

    setNome("");
    setOrdem("");
    toast({ title: "Sucesso", description: "Tipo de culto criado!" });
    carregar();
  }

  async function alternarAtivo(id: string, ativoAtual: boolean) {
    const { error } = await supabase.from("tipos_culto").update({ ativo: !ativoAtual }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar o status.", variant: "destructive" });
      return;
    }
    carregar();
  }

  async function excluir(id: string, nomeItem: string) {
    if (!confirm(`Excluir "${nomeItem}"?`)) return;
    const { error } = await supabase.from("tipos_culto").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
      return;
    }
    toast({ title: "Sucesso", description: "Excluído com sucesso." });
    carregar();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Tipos de Culto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Formulário */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex.: Domingo Noite"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ordem">Ordem (opcional)</Label>
              <Input
                id="ordem"
                type="number"
                min={0}
                placeholder="0"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={adicionar} disabled={loading}>
              {loading ? "Salvando..." : "Adicionar"}
            </Button>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {tipos.length === 0 ? (
              <p className="text-muted-foreground">Nenhum tipo de culto cadastrado.</p>
            ) : (
              tipos.map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium break-words">{t.nome}</span>
                      <Badge variant={t.ativo ? "default" : "secondary"}>
                        {t.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ordem: {typeof t.ordem === "number" ? t.ordem : 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => alternarAtivo(t.id, t.ativo)}
                    >
                      {t.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => excluir(t.id, t.nome)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
