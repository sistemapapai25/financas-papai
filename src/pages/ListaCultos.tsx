// src/pages/ListaCultos.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, Calendar, Users, DollarSign, Church, Plus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface TipoCulto {
  id: string;
  nome: string;
}

interface Culto {
  id: string;
  data: string;
  tipo_id: string;
  pregador: string | null;
  adultos: number;
  criancas: number;
  created_at: string;
  tipo_culto?: TipoCulto;
  total_dizimos?: number;
  total_ofertas?: number;
  total_geral?: number;
}

interface DizimoItem {
  id?: string;
  nome: string;
  valor: number;
}

interface OfertaItem {
  id?: string;
  valor_dinheiro: number;
  valor_moedas: number;
  valor: number;
}

export default function ListaCultos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  
  // Estados para edição
  const [editandoCulto, setEditandoCulto] = useState<Culto | null>(null);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [tiposCulto, setTiposCulto] = useState<TipoCulto[]>([]);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  
  // Estados do formulário de edição
  const [formData, setFormData] = useState({
    data: "",
    tipo_id: "",
    pregador: "",
    adultos: 0,
    criancas: 0,
  });
  const [dizimos, setDizimos] = useState<DizimoItem[]>([]);
  const [ofertas, setOfertas] = useState<OfertaItem[]>([{ valor_dinheiro: 0, valor_moedas: 0, valor: 0 }]);

  // Função para formatar moeda
  const moeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  // Função para formatar data com dia da semana
  const formatarData = (data: string) => {
    const date = new Date(data + "T00:00:00");
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = diasSemana[date.getDay()];
    const dataFormatada = date.toLocaleDateString("pt-BR");
    return `${dataFormatada} - ${diaSemana}`;
  };

  // Carregar tipos de culto
  const carregarTiposCulto = async () => {
    try {
      const { data, error } = await supabase
        .from("tipos_culto")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;
      setTiposCulto(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar tipos de culto:", error);
    }
  };

  // Preparar edição de culto
  const prepararEdicao = async (culto: Culto) => {
    try {
      setEditandoCulto(culto);
      setFormData({
        data: culto.data,
        tipo_id: culto.tipo_id || "",
        pregador: culto.pregador || "",
        adultos: culto.adultos,
        criancas: culto.criancas,
      });

      // Carregar dízimos
      const { data: dizimosData } = await supabase
        .from("dizimos")
        .select("*")
        .eq("culto_id", culto.id);

      setDizimos(dizimosData || []);

      // Carregar ofertas
      const { data: ofertasData } = await supabase
        .from("ofertas")
        .select("*")
        .eq("culto_id", culto.id);

      if (ofertasData && ofertasData.length > 0) {
        setOfertas(ofertasData.map(o => ({
          id: o.id,
          valor_dinheiro: o.valor_dinheiro || 0,
          valor_moedas: o.valor_moedas || 0,
          valor: o.valor || (o.valor_dinheiro + o.valor_moedas),
        })));
      } else {
        setOfertas([{ valor_dinheiro: 0, valor_moedas: 0, valor: 0 }]);
      }

      setModalEdicaoAberto(true);
    } catch (error: unknown) {
      console.error("Erro ao preparar edição:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados para edição.",
        variant: "destructive",
      });
    }
  };

  // Carregar cultos
  const carregarCultos = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar cultos com tipos de culto
      const { data: cultosData, error: cultosError } = await supabase
        .from("cultos")
        .select(`
          *,
          tipo_culto:tipos_culto(id, nome)
        `)
        .eq("user_id", user.id)
        .order("data", { ascending: false });

      if (cultosError) throw cultosError;

      // Para cada culto, calcular totais de dízimos e ofertas
      const cultosComTotais = await Promise.all(
        (cultosData || []).map(async (culto) => {
          // Buscar dízimos
          const { data: dizimos } = await supabase
            .from("dizimos")
            .select("valor")
            .eq("culto_id", culto.id);

          // Buscar ofertas
          const { data: ofertas } = await supabase
            .from("ofertas")
            .select("valor")
            .eq("culto_id", culto.id);

          const totalDizimos = (dizimos || []).reduce((sum, d) => sum + d.valor, 0);
          const totalOfertas = (ofertas || []).reduce((sum, o) => sum + o.valor, 0);
          const totalGeral = totalDizimos + totalOfertas;

          return {
            ...culto,
            total_dizimos: totalDizimos,
            total_ofertas: totalOfertas,
            total_geral: totalGeral,
          };
        })
      );

      setCultos(cultosComTotais);
    } catch (error: unknown) {
      console.error("Erro ao carregar cultos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cultos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Excluir culto
  const excluirCulto = async (cultoId: string) => {
    try {
      setExcluindo(cultoId);

      // Excluir dízimos relacionados
      const { error: dizimosError } = await supabase
        .from("dizimos")
        .delete()
        .eq("culto_id", cultoId);

      if (dizimosError) throw dizimosError;

      // Excluir ofertas relacionadas
      const { error: ofertasError } = await supabase
        .from("ofertas")
        .delete()
        .eq("culto_id", cultoId);

      if (ofertasError) throw ofertasError;

      // Excluir culto
      const { error: cultoError } = await supabase
        .from("cultos")
        .delete()
        .eq("id", cultoId);

      if (cultoError) throw cultoError;

      toast({
        title: "Sucesso",
        description: "Culto excluído com sucesso!",
      });

      // Recarregar lista
      carregarCultos();
    } catch (error: unknown) {
      console.error("Erro ao excluir culto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o culto.",
        variant: "destructive",
      });
    } finally {
      setExcluindo(null);
    }
  };

  // Funções para manipular dízimos
  const adicionarDizimo = () => {
    setDizimos([...dizimos, { nome: "", valor: 0 }]);
  };

  const removerDizimo = (index: number) => {
    setDizimos(dizimos.filter((_, i) => i !== index));
  };

  const atualizarDizimo = (index: number, campo: keyof DizimoItem, valor: string | number) => {
    const novosDizimos = [...dizimos];
    novosDizimos[index] = { ...novosDizimos[index], [campo]: valor };
    setDizimos(novosDizimos);
  };

  // Funções para manipular ofertas
  const atualizarOferta = (index: number, campo: keyof OfertaItem, valor: number) => {
    const novasOfertas = [...ofertas];
    novasOfertas[index] = { ...novasOfertas[index], [campo]: valor };
    
    // Recalcular valor total
    if (campo === "valor_dinheiro" || campo === "valor_moedas") {
      novasOfertas[index].valor = novasOfertas[index].valor_dinheiro + novasOfertas[index].valor_moedas;
    }
    
    setOfertas(novasOfertas);
  };

  // Salvar edição
  const salvarEdicao = async () => {
    if (!editandoCulto) return;

    try {
      setSalvandoEdicao(true);

      // Atualizar dados básicos do culto
      const { error: cultoError } = await supabase
        .from("cultos")
        .update({
          data: formData.data,
          tipo_id: formData.tipo_id || null,
          pregador: formData.pregador || null,
          adultos: formData.adultos,
          criancas: formData.criancas,
        })
        .eq("id", editandoCulto.id);

      if (cultoError) throw cultoError;

      // Excluir dízimos existentes
      await supabase.from("dizimos").delete().eq("culto_id", editandoCulto.id);

      // Inserir novos dízimos
      if (dizimos.length > 0) {
        const dizimosParaInserir = dizimos
          .filter(d => d.nome.trim() && d.valor > 0)
          .map(d => ({
            culto_id: editandoCulto.id,
            nome: d.nome.trim(),
            valor: d.valor,
          }));

        if (dizimosParaInserir.length > 0) {
          const { error: dizimosError } = await supabase
            .from("dizimos")
            .insert(dizimosParaInserir);

          if (dizimosError) throw dizimosError;
        }
      }

      // Excluir ofertas existentes
      await supabase.from("ofertas").delete().eq("culto_id", editandoCulto.id);

      // Inserir novas ofertas
      const ofertasParaInserir = ofertas
        .filter(o => o.valor > 0)
        .map(o => ({
          culto_id: editandoCulto.id,
          valor_dinheiro: o.valor_dinheiro,
          valor_moedas: o.valor_moedas,
          valor: o.valor,
        }));

      if (ofertasParaInserir.length > 0) {
        const { error: ofertasError } = await supabase
          .from("ofertas")
          .insert(ofertasParaInserir);

        if (ofertasError) throw ofertasError;
      }

      toast({
        title: "Sucesso",
        description: "Culto atualizado com sucesso!",
      });

      setModalEdicaoAberto(false);
      carregarCultos();
    } catch (error: unknown) {
      console.error("Erro ao salvar edição:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  useEffect(() => {
    carregarCultos();
    carregarTiposCulto();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando cultos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Cultos</h1>
          <p className="text-muted-foreground mt-2">
            Visualize, edite e exclua os lançamentos de cultos
          </p>
        </div>
      </div>

      {cultos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Church className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum culto encontrado</h3>
            <p className="text-muted-foreground text-center">
              Ainda não há cultos cadastrados. Vá para a tela de Entradas de Culto para adicionar o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cultos.map((culto) => (
            <Card key={culto.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">
                        {formatarData(culto.data)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {culto.tipo_culto?.nome || "Tipo não definido"}
                        </Badge>
                        {culto.pregador && (
                          <span className="text-sm text-muted-foreground">
                            Pregador: {culto.pregador}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => prepararEdicao(culto)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={excluindo === culto.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {excluindo === culto.id ? "Excluindo..." : "Excluir"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir este culto? Esta ação não pode ser desfeita.
                            Todos os dízimos e ofertas relacionados também serão excluídos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => excluirCulto(culto.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Presença</p>
                      <p className="text-sm text-muted-foreground">
                        {culto.adultos} adultos, {culto.criancas} crianças
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Dízimos</p>
                      <p className="text-sm text-muted-foreground">
                        {moeda(culto.total_dizimos || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium">Ofertas</p>
                      <p className="text-sm text-muted-foreground">
                        {moeda(culto.total_ofertas || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Total Geral</p>
                      <p className="text-lg font-bold text-green-600">
                        {moeda(culto.total_geral || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Edição */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Culto</DialogTitle>
            <DialogDescription>
              Altere as informações do culto de {editandoCulto && formatarData(editandoCulto.data)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-data">Data do Culto</Label>
                  <Input
                    id="edit-data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tipo">Tipo de Culto</Label>
                  <Select
                    value={formData.tipo_id}
                    onValueChange={(value) => setFormData({ ...formData, tipo_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposCulto.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pregador">Pregador</Label>
                  <Input
                    id="edit-pregador"
                    value={formData.pregador}
                    onChange={(e) => setFormData({ ...formData, pregador: e.target.value })}
                    placeholder="Nome do pregador"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-adultos">Adultos</Label>
                  <Input
                    id="edit-adultos"
                    type="number"
                    min="0"
                    value={formData.adultos}
                    onChange={(e) => setFormData({ ...formData, adultos: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-criancas">Crianças</Label>
                  <Input
                    id="edit-criancas"
                    type="number"
                    min="0"
                    value={formData.criancas}
                    onChange={(e) => setFormData({ ...formData, criancas: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Dízimos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Dízimos</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarDizimo}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Dízimo
                </Button>
              </div>
              {dizimos.map((dizimo, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={dizimo.nome}
                      onChange={(e) => atualizarDizimo(index, "nome", e.target.value)}
                      placeholder="Nome do dizimista"
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dizimo.valor}
                      onChange={(e) => atualizarDizimo(index, "valor", parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removerDizimo(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Ofertas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Ofertas</h3>
              {ofertas.map((oferta, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label>Dinheiro (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={oferta.valor_dinheiro}
                      onChange={(e) => atualizarOferta(index, "valor_dinheiro", parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moedas (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={oferta.valor_moedas}
                      onChange={(e) => atualizarOferta(index, "valor_moedas", parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input
                      type="text"
                      value={moeda(oferta.valor)}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalEdicaoAberto(false)}
              disabled={salvandoEdicao}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarEdicao}
              disabled={salvandoEdicao}
            >
              {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
