import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type ConfiguracaoMensagem = {
  id: string;
  tipo: string;
  titulo: string;
  template_mensagem: string;
  ativo: boolean;
};

export default function ConfiguracaoMensagens() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<ConfiguracaoMensagem>>({});

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["configuracao_mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracao_mensagens")
        .select("*")
        .order("titulo");
      
      if (error) throw error;
      return data as ConfiguracaoMensagem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<ConfiguracaoMensagem> & { id: string }) => {
      const { error } = await supabase
        .from("configuracao_mensagens")
        .update({
          template_mensagem: values.template_mensagem,
          ativo: values.ativo,
        })
        .eq("id", values.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao_mensagens"] });
      toast({ title: "Sucesso", description: "Configuração atualizada com sucesso." });
      setEditingId(null);
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro", description: "Falha ao atualizar configuração.", variant: "destructive" });
    },
  });

  const handleEdit = (msg: ConfiguracaoMensagem) => {
    setEditingId(msg.id);
    setFormValues(msg);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormValues({});
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, ...formValues });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração de Mensagens</h1>
        <p className="text-muted-foreground">
          Personalize os textos das mensagens automáticas enviadas pelo sistema.
        </p>
      </div>

      <div className="grid gap-6">
        {mensagens?.map((msg) => (
          <Card key={msg.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{msg.titulo}</CardTitle>
                  <CardDescription>{msg.tipo}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ativo-${msg.id}`}>Ativo</Label>
                  <Switch
                    id={`ativo-${msg.id}`}
                    checked={editingId === msg.id ? formValues.ativo : msg.ativo}
                    onCheckedChange={(checked) => {
                      if (editingId === msg.id) {
                        setFormValues({ ...formValues, ativo: checked });
                      } else {
                        updateMutation.mutate({ id: msg.id, ativo: checked });
                      }
                    }}
                    disabled={editingId !== msg.id && updateMutation.isPending}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingId === msg.id ? (
                <>
                  <div className="space-y-2">
                    <Label>Template da Mensagem</Label>
                    <Textarea
                      value={formValues.template_mensagem}
                      onChange={(e) => setFormValues({ ...formValues, template_mensagem: e.target.value })}
                      rows={8}
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Variáveis disponíveis:</p>
                      <ul className="list-disc pl-4 grid grid-cols-2 gap-x-4">
                        <li><strong>{`{nome}`}</strong>: Primeiro nome</li>
                        <li><strong>{`{nome_completo}`}</strong>: Nome completo</li>
                        <li><strong>{`{desafio}`}</strong>: Título do desafio</li>
                        <li><strong>{`{valor}`}</strong>: Valor formatado (R$)</li>
                        <li><strong>{`{vencimento}`}</strong>: Data de vencimento</li>
                        <li><strong>{`{dias_restantes}`}</strong>: Dias para vencer</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button onClick={() => handleSave(msg.id)} disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-muted p-4 rounded-md whitespace-pre-wrap text-sm">
                    {msg.template_mensagem}
                  </div>
                  <Button variant="outline" onClick={() => handleEdit(msg)}>
                    Editar Mensagem
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
