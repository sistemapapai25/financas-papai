import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ymdToBr, brToYmd } from "@/utils/date";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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

import { Plus, Minus, Save, Users, DollarSign, Calendar, User, Trash2, CheckCircle, AlertCircle } from "lucide-react";

// --- Tipos ---
type TipoCultoRow = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
};

type ContaFinanceira = {
  id: string;
  user_id: string;
  tipo: "CAIXA" | "BANCO";
  nome: string;
  instituicao?: string | null;
  agencia?: string | null;
  numero?: string | null;
  saldo_inicial: number;
  created_at: string;
};

// Tipo para os itens de dízimo
type DizimoItem = {
  id: string; // id temporário (frontend)
  nome: string;
  valor: string; // string para facilitar input com vírgula/ponto
};

export default function EntradasCulto() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [dataCulto, setDataCulto] = useState(""); // YYYY-MM-DD
  const [dataCultoBr, setDataCultoBr] = useState(""); // DD/MM/YYYY
  const [tipoCultoId, setTipoCultoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [pregador, setPregador] = useState("");
  const [adultos, setAdultos] = useState("");
  const [criancas, setCriancas] = useState("");
  const [ofertaDinheiro, setOfertaDinheiro] = useState("");
  const [ofertaMoedas, setOfertaMoedas] = useState("");
  const [dizimos, setDizimos] = useState<DizimoItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Estados para dados auxiliares
  const [tiposCulto, setTiposCulto] = useState<TipoCultoRow[]>([]);
  const [contasCaixa, setContasCaixa] = useState<ContaFinanceira[]>([]);

  // Carregar dados iniciais
  useEffect(() => {
    carregarTiposCulto();
    carregarContasCaixa();
  }, []);

  async function carregarTiposCulto() {
    const { data, error } = await supabase
      .from("tipos_culto")
      .select("*")
      .eq("ativo", true)
      .order("ordem");

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os tipos de culto.",
        variant: "destructive",
      });
      return;
    }

    setTiposCulto(data ?? []);
    if ((data ?? []).length > 0 && !tipoCultoId) {
      setTipoCultoId((data ?? [])[0].id);
    }
  }

  async function carregarContasCaixa() {
    const { data, error } = await supabase
      .from("contas_financeiras")
      .select("*")
      .eq("tipo", "CAIXA")
      .order("nome");

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as contas de caixa.",
        variant: "destructive",
      });
      return;
    }

    setContasCaixa((data ?? []).map(c => ({ ...c, tipo: c.tipo as "BANCO" | "CAIXA" })));
    if ((data ?? []).length > 0 && !contaId) {
      setContaId((data ?? [])[0].id);
    }
  }

  // --- Utilitários de formatação ---
  const moeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarMoedaInput = (valor: string): string => {
    // Remove tudo que não é dígito
    const numeros = valor.replace(/\D/g, '');
    
    if (!numeros) return '';
    
    // Converte para centavos e depois para reais
    const valorEmCentavos = parseInt(numeros);
    const valorEmReais = valorEmCentavos / 100;
    
    return valorEmReais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const converterMoedaParaNumero = (valorFormatado: string): number => {
    if (!valorFormatado) return 0;
    
    // Remove pontos de milhares e substitui vírgula por ponto
    const numeroLimpo = valorFormatado
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(numeroLimpo) || 0;
  };

  const handleMoedaChange = (valor: string, setter: (v: string) => void) => {
    const valorFormatado = formatarMoedaInput(valor);
    setter(valorFormatado);
  };

  // --- Cálculos ---
  const totalPessoas = useMemo(() => {
    const numAdultos = parseInt(adultos) || 0;
    const numCriancas = parseInt(criancas) || 0;
    return numAdultos + numCriancas;
  }, [adultos, criancas]);

  const totalDizimos = useMemo(() => {
    return dizimos.reduce((acc, d) => {
      return acc + converterMoedaParaNumero(d.valor);
    }, 0);
  }, [dizimos]);

  const totalOfertasDinheiro = useMemo(() => {
    return converterMoedaParaNumero(ofertaDinheiro);
  }, [ofertaDinheiro]);

  const totalOfertasMoedas = useMemo(() => {
    return converterMoedaParaNumero(ofertaMoedas);
  }, [ofertaMoedas]);

  const totalOfertas = useMemo(() => totalOfertasDinheiro + totalOfertasMoedas, [totalOfertasDinheiro, totalOfertasMoedas]);
  const totalGeral = useMemo(() => totalDizimos + totalOfertas, [totalDizimos, totalOfertas]);

  // --- Handlers para dízimos ---
  function addDizimo() {
    setDizimos([...dizimos, { id: Date.now().toString(), nome: "", valor: "" }]);
  }

  function removeDizimo(id: string) {
    setDizimos(dizimos.filter((d) => d.id !== id));
  }

  function updateDizimo(id: string, field: "nome" | "valor", value: string) {
    setDizimos(
      dizimos.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      )
    );
  }

  // --- Validações ---
  const validarCamposObrigatorios = () => {
    const erros: string[] = [];
    
    if (!dataCulto) erros.push("Data do Culto");
    if (!tipoCultoId) erros.push("Tipo de Culto");
    if (!contaId) erros.push("Conta de Destino");
    
    return erros;
  };

  const camposObrigatoriosValidos = useMemo(() => {
    return validarCamposObrigatorios().length === 0;
  }, [dataCulto, tipoCultoId, contaId]);

  const temValoresFinanceiros = useMemo(() => {
    return totalGeral > 0;
  }, [totalGeral]);

  // --- Salvar ---
  async function salvarCulto() {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    const errosValidacao = validarCamposObrigatorios();
    if (errosValidacao.length > 0) {
      toast({
        title: "Campos obrigatórios não preenchidos",
        description: `Por favor, preencha: ${errosValidacao.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (!temValoresFinanceiros) {
      toast({
        title: "Valores financeiros obrigatórios",
        description: "É necessário informar pelo menos um valor de dízimo ou oferta.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    setShowConfirmDialog(false);

    try {
      // Preparar dados dos dízimos válidos
      const dizimosValidos = dizimos
        .filter((d) => d.nome.trim() && converterMoedaParaNumero(d.valor) > 0)
        .map((d) => ({
          nome: d.nome.trim(),
          valor: converterMoedaParaNumero(d.valor),
        }));

      const ofertaDinheiroNum = converterMoedaParaNumero(ofertaDinheiro);
      const ofertaMoedasNum = converterMoedaParaNumero(ofertaMoedas);
      const totalGeralNum = totalGeral;

      if (totalGeralNum <= 0) {
        toast({
          title: "Erro",
          description: "O total geral deve ser maior que zero.",
          variant: "destructive",
        });
        return;
      }

      // 1. Inserir o culto
      const { data: cultoInserted, error: cultoErr } = await supabase
        .from("cultos")
        .insert({
          user_id: user.id,
          data: dataCulto,
          tipo_id: tipoCultoId,
          pregador: pregador.trim() || null,
          adultos: parseInt(adultos) || 0,
          criancas: parseInt(criancas) || 0,
        })
        .select()
        .single();

      if (cultoErr || !cultoInserted?.id) {
        throw new Error(cultoErr?.message || "Erro ao inserir culto");
      }

      // 2. Inserir dízimos se houver
      if (dizimosValidos.length > 0) {
        const { error: dizimosErr } = await supabase.from("dizimos").insert(
          dizimosValidos.map((d) => ({
            culto_id: cultoInserted.id,
            nome: d.nome,
            valor: d.valor,
          }))
        );
        if (dizimosErr) throw new Error(dizimosErr.message);
      }

      // 3. Inserir ofertas se houver
      if (ofertaDinheiroNum > 0 || ofertaMoedasNum > 0) {
        const { error: ofertasErr } = await supabase.from("ofertas").insert({
          culto_id: cultoInserted.id,
          valor_dinheiro: ofertaDinheiroNum,
          valor_moedas: ofertaMoedasNum,
          valor: ofertaDinheiroNum + ofertaMoedasNum,
        });
        if (ofertasErr) throw new Error(ofertasErr.message);
      }

      // 4. Saldo atualizado via movimentos financeiros (não precisa de RPC separada)

      toast({
        title: "Sucesso!",
        description: `Culto salvo com sucesso! Total: ${moeda(totalGeralNum)}`,
        variant: "default",
      });

      resetForm();
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  }

  // --- Reset ---
  function resetForm() {
    setDataCulto("");
    setDataCultoBr("");
    setTipoCultoId(tiposCulto.length > 0 ? tiposCulto[0].id : "");
    setContaId(contasCaixa.length > 0 ? contasCaixa[0].id : "");
    setPregador("");
    setAdultos("");
    setCriancas("");
    setOfertaDinheiro("");
    setOfertaMoedas("");
    setDizimos([]);
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Card className="shadow-lg">
        <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Calendar className="w-7 h-7 text-blue-600" />
            Entrada de Culto
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Registre as informações financeiras e de participação do culto
          </p>
        </CardHeader>

        <CardContent className="space-y-8 p-6">
          {/* Seção: Informações Básicas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Informações Básicas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Data do Culto
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={dataCultoBr}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    let formatted = digits;
                    if (digits.length > 2 && digits.length <= 4) {
                      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                    } else if (digits.length > 4) {
                      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                    }
                    setDataCultoBr(formatted);
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
                      setDataCulto(brToYmd(formatted));
                    } else {
                      setDataCulto("");
                    }
                  }}
                  className={`h-11 transition-colors ${
                    !dataCulto ? 'border-red-300 focus:border-red-500' : 'border-green-300 focus:border-green-500'
                  }`}
                />
                {!dataCulto && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Campo obrigatório
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <User className="w-4 h-4 text-blue-600" />
                  Tipo de Culto
                  <span className="text-red-500">*</span>
                </Label>
                <Select value={tipoCultoId} onValueChange={setTipoCultoId}>
                  <SelectTrigger className={`h-11 transition-colors ${
                    !tipoCultoId ? 'border-red-300 focus:border-red-500' : 'border-green-300 focus:border-green-500'
                  }`}>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposCulto.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!tipoCultoId && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Campo obrigatório
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  Conta de Destino
                  <span className="text-red-500">*</span>
                </Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className={`h-11 transition-colors ${
                    !contaId ? 'border-red-300 focus:border-red-500' : 'border-green-300 focus:border-green-500'
                  }`}>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasCaixa.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!contaId && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Campo obrigatório
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção: Participação */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Participação</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2 font-medium">
                  <User className="w-4 h-4 text-blue-600" />
                  Pregador
                </Label>
                <Input
                  value={pregador}
                  onChange={(e) => setPregador(e.target.value)}
                  placeholder="Nome do pregador"
                  className={`h-11 transition-colors ${
                    pregador ? 'border-green-300 focus:border-green-500' : ''
                  }`}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Users className="w-4 h-4 text-blue-600" />
                  Adultos
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={adultos}
                  onChange={(e) => setAdultos(e.target.value)}
                  placeholder="0"
                  className={`h-11 transition-colors ${
                    adultos ? 'border-green-300 focus:border-green-500' : ''
                  }`}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Users className="w-4 h-4 text-blue-600" />
                  Crianças
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={criancas}
                  onChange={(e) => setCriancas(e.target.value)}
                  placeholder="0"
                  className={`h-11 transition-colors ${
                    criancas ? 'border-green-300 focus:border-green-500' : ''
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <Users className="w-4 h-4 mr-2" />
                Total de Pessoas: {totalPessoas}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Seção: Dízimos */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-800">Dízimos</h3>
              </div>
              <Button
                onClick={addDizimo}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-purple-50"
              >
                <Plus className="w-4 h-4" />
                Adicionar Dízimo
              </Button>
            </div>
            
            <div className="space-y-4">
              {dizimos.map((d, idx) => (
                <Card key={d.id} className="p-4 bg-gray-50 border-l-4 border-l-purple-400">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-7 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600" />
                        Nome do Dizimista
                      </Label>
                      <Input
                        value={d.nome}
                        onChange={(e) => updateDizimo(d.id, "nome", e.target.value)}
                        placeholder="Nome completo"
                        className={`h-10 bg-white transition-colors ${
                          d.nome ? 'border-green-300 focus:border-green-500' : ''
                        }`}
                      />
                    </div>
                    
                    <div className="md:col-span-4 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-purple-600" />
                        Valor
                      </Label>
                      <Input
                        value={d.valor}
                        onChange={(e) => {
                          const valorFormatado = formatarMoedaInput(e.target.value);
                          updateDizimo(d.id, "valor", valorFormatado);
                        }}
                        placeholder="0,00"
                        className={`h-10 bg-white font-mono transition-colors ${
                          converterMoedaParaNumero(d.valor) > 0 ? 'border-green-300 focus:border-green-500' : ''
                        }`}
                      />
                    </div>
                    
                    <div className="md:col-span-1 flex justify-center">
                      <Button
                        onClick={() => removeDizimo(d.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="text-sm text-purple-700 font-medium">
                  Total de Dízimos: 
                  <span className="text-lg font-bold ml-2">{moeda(totalDizimos)}</span>
                </div>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Seção: Ofertas */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-800">Ofertas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Oferta em Dinheiro
                  </Label>
                  <Input
                    value={ofertaDinheiro}
                    onChange={(e) => handleMoedaChange(e.target.value, setOfertaDinheiro)}
                    placeholder="0,00"
                    className={`h-12 text-lg font-mono bg-white transition-colors ${
                      converterMoedaParaNumero(ofertaDinheiro) > 0 ? 'border-green-300 focus:border-green-500' : ''
                    }`}
                  />
                </div>
              </Card>
              
              <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-600" />
                    Oferta em Moedas
                  </Label>
                  <Input
                    value={ofertaMoedas}
                    onChange={(e) => handleMoedaChange(e.target.value, setOfertaMoedas)}
                    placeholder="0,00"
                    className={`h-12 text-lg font-mono bg-white transition-colors ${
                      converterMoedaParaNumero(ofertaMoedas) > 0 ? 'border-green-300 focus:border-green-500' : ''
                    }`}
                  />
                </div>
              </Card>
            </div>

            <div className="flex justify-end">
              <Card className="p-4 bg-orange-50 border-orange-200">
                <div className="text-sm text-orange-700 font-medium">
                  Total de Ofertas: 
                  <span className="text-lg font-bold ml-2">{moeda(totalOfertas)}</span>
                </div>
              </Card>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Seção: Resumo dos Totais */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Resumo Financeiro</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-sm text-purple-700 font-medium mb-1">Total Dízimos</div>
                  <div className="text-2xl font-bold text-purple-800">{moeda(totalDizimos)}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="text-sm text-orange-700 font-medium mb-1">Total Ofertas</div>
                  <div className="text-2xl font-bold text-orange-800">{moeda(totalOfertas)}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-sm text-green-700 font-medium mb-1">Total Geral</div>
                  <div className="text-3xl font-bold text-green-800">{moeda(totalGeral)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={resetForm}
              className="flex items-center gap-2 hover:bg-gray-50"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Formulário
            </Button>
            
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={salvando || !camposObrigatoriosValidos || !temValoresFinanceiros}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg disabled:bg-gray-400 transition-all"
                >
                  {salvando ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Salvar Culto
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    Confirmar Salvamento
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <div>Você está prestes a salvar as seguintes informações:</div>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                      <div><strong>Data:</strong> {ymdToBr(dataCulto)}</div>
                      <div><strong>Tipo:</strong> {tiposCulto.find(t => t.id === tipoCultoId)?.nome}</div>
                      <div><strong>Total de Dízimos:</strong> {moeda(totalDizimos)}</div>
                      <div><strong>Total de Ofertas:</strong> {moeda(totalOfertas)}</div>
                      <div><strong>Total Geral:</strong> {moeda(totalGeral)}</div>
                    </div>
                    <div>Esta ação não pode ser desfeita. Deseja continuar?</div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={salvarCulto} className="bg-blue-600 hover:bg-blue-700">
                    Confirmar e Salvar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
