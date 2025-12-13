import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NovoBeneficiarioModal from './NovoBeneficiarioModal';
import NovaCategoriaModal from './NovaCategoriaModal';
import FileUpload from './FileUpload';
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EditarLancamentoDialogProps {
  lancamento: {
    id: string;
    descricao: string;
    valor: number;
    vencimento: string;
    tipo: 'DESPESA' | 'RECEITA';
    status: 'EM_ABERTO' | 'PAGO' | 'CANCELADO';
    observacoes?: string;
    categoria_id: string;
    beneficiario_id?: string;
    data_pagamento?: string;
    valor_pago?: number;
    boleto_url?: string;
    comprovante_url?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  restrictedEditing?: boolean;
}

interface Categoria {
  id: string;
  name: string;
  tipo: 'DESPESA' | 'RECEITA';
}

interface Beneficiario {
  id: string;
  name: string;
}

const EditarLancamentoDialog = ({ lancamento, open, onOpenChange, onSuccess, restrictedEditing = false }: EditarLancamentoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    vencimento: '',
    tipo: 'DESPESA' as 'DESPESA' | 'RECEITA',
    categoria_id: '',
    beneficiario_id: 'none',
    observacoes: '',
    status: 'EM_ABERTO' as 'EM_ABERTO' | 'PAGO' | 'CANCELADO',
    data_pagamento: '',
    valor_pago: '',
    boleto_url: '',
    comprovante_url: ''
  });
  const [openCategoria, setOpenCategoria] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      carregarDados();
    }
  }, [open, user]);

  useEffect(() => {
    // Preencher form com dados do lançamento após categorias e beneficiários serem carregados
    if (open && categorias.length > 0) {
      setFormData({
        descricao: lancamento.descricao,
        valor: lancamento.valor.toString(),
        vencimento: lancamento.vencimento,
        tipo: lancamento.tipo,
        categoria_id: lancamento.categoria_id,
        beneficiario_id: lancamento.beneficiario_id || 'none',
        observacoes: lancamento.observacoes || '',
        status: lancamento.status,
        data_pagamento: lancamento.data_pagamento || '',
        valor_pago: lancamento.valor_pago?.toString() || '',
        boleto_url: lancamento.boleto_url || '',
        comprovante_url: lancamento.comprovante_url || ''
      });
    }
  }, [open, categorias, beneficiarios, lancamento]);

  const carregarDados = async () => {
    try {
      // Carregar categorias
      const { data: categoriasData } = await supabase
        .from('categories')
        .select('id, name, tipo')
        .eq('user_id', user?.id)
        .order('name');

      setCategorias(categoriasData || []);

      // Carregar beneficiários
      const { data: beneficiariosData } = await supabase
        .from('beneficiaries')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name');

      setBeneficiarios(beneficiariosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleNovoBeneficiario = (novoBeneficiario: { id: string; name: string }) => {
    setBeneficiarios(prev => [...prev, novoBeneficiario]);
    setFormData({ ...formData, beneficiario_id: novoBeneficiario.id });
  };

  const handleNovaCategoria = (novaCategoria: { id: string; name: string; tipo: 'DESPESA' | 'RECEITA' }) => {
    setCategorias(prev => [...prev, novaCategoria]);
    setFormData({ ...formData, categoria_id: novaCategoria.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao || !formData.valor || !formData.vencimento || !formData.categoria_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (formData.status === 'PAGO' && (!formData.data_pagamento || !formData.valor_pago)) {
      toast({
        title: "Erro",
        description: "Para status pago, preencha a data de pagamento e valor pago",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('lancamentos')
        .update({
          categoria_id: formData.categoria_id,
          beneficiario_id: formData.beneficiario_id === 'none' ? null : formData.beneficiario_id,
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          vencimento: formData.vencimento,
          tipo: formData.tipo,
          observacoes: formData.observacoes || null,
          status: formData.status,
          data_pagamento: formData.status === 'PAGO' ? formData.data_pagamento : null,
          valor_pago: formData.status === 'PAGO' ? parseFloat(formData.valor_pago) : null,
          boleto_url: formData.boleto_url || null,
          comprovante_url: formData.comprovante_url || null
        })
        .eq('id', lancamento.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Lançamento atualizado com sucesso!",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao atualizar lançamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar lançamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo - Primeiro campo */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: 'DESPESA' | 'RECEITA') => {
                setFormData({ ...formData, tipo: value, categoria_id: '' });
              }}
              disabled={restrictedEditing}
            >
              <SelectTrigger disabled={restrictedEditing}>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESPESA">Despesa</SelectItem>
                <SelectItem value="RECEITA">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Beneficiário - Segundo campo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="beneficiario">Beneficiário</Label>
              <NovoBeneficiarioModal onSuccess={handleNovoBeneficiario} />
            </div>
            <Select
              value={formData.beneficiario_id}
              onValueChange={(value) => setFormData({ ...formData, beneficiario_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o beneficiário (opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="none">Sem beneficiário</SelectItem>
                {beneficiarios.map((beneficiario) => (
                  <SelectItem key={beneficiario.id} value={beneficiario.id}>
                    {beneficiario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria - Terceiro campo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria *</Label>
              <NovaCategoriaModal onSuccess={handleNovaCategoria} tipoFiltro={formData.tipo} />
            </div>
            <Popover open={openCategoria} onOpenChange={setOpenCategoria}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCategoria}
                  className="w-full justify-between"
                  disabled={restrictedEditing}
                >
                  {formData.categoria_id
                    ? categorias.find((categoria) => categoria.id === formData.categoria_id)?.name
                    : "Selecione uma categoria..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Buscar categoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {categorias
                        .filter(cat => cat.tipo === formData.tipo)
                        .map((categoria) => (
                          <CommandItem
                            key={categoria.id}
                            value={categoria.name}
                            onSelect={() => {
                              setFormData({ ...formData, categoria_id: categoria.id });
                              setOpenCategoria(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.categoria_id === categoria.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {categoria.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Conta de luz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                required
                disabled={restrictedEditing}
              />
            </div>
          </div>

          {/* Vencimento e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                required
                disabled={restrictedEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'EM_ABERTO' | 'PAGO' | 'CANCELADO') => setFormData({ ...formData, status: value })}
                disabled={restrictedEditing}
              >
                <SelectTrigger disabled={restrictedEditing}>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos para quando status é PAGO */}
          {formData.status === 'PAGO' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_pagamento">Data de Pagamento *</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_pago">Valor Pago *</Label>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_pago}
                  onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          {/* Upload de Arquivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUpload
              label="Boleto"
              value={formData.boleto_url}
              onChange={(url) => setFormData({ ...formData, boleto_url: url || '' })}
              bucket="boletos"
              folder="boletos"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <FileUpload
              label="Comprovante"
              value={formData.comprovante_url}
              onChange={(url) => setFormData({ ...formData, comprovante_url: url || '' })}
              bucket="Comprovantes"
              folder="comprovantes"
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditarLancamentoDialog;
