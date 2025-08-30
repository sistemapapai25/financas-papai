import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';
import NovoBeneficiarioModal from './NovoBeneficiarioModal';
import NovaCategoriaModal from './NovaCategoriaModal';
import FileUpload from './FileUpload';

interface NovoLancamentoDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
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

const NovoLancamentoDialog = ({ onSuccess, trigger }: NovoLancamentoDialogProps) => {
  const [open, setOpen] = useState(false);
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
    status: 'EM_ABERTO' as 'EM_ABERTO' | 'PAGO',
    data_pagamento: '',
    valor_pago: '',
    boleto_url: '',
    comprovante_url: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      carregarDados();
    }
  }, [open, user]);

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
        .insert({
          user_id: user?.id,
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
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Lançamento criado com sucesso!",
      });

      setFormData({
        descricao: '',
        valor: '',
        vencimento: '',
        tipo: 'DESPESA',
        categoria_id: '',
        beneficiario_id: 'none',
        observacoes: '',
        status: 'EM_ABERTO',
        data_pagamento: '',
        valor_pago: '',
        boleto_url: '',
        comprovante_url: ''
      });

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar lançamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar lançamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4 mr-2" />
      Novo Lançamento
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
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
            >
              <SelectTrigger>
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
              <Label htmlFor="categoria">Categoria *</Label>
              <NovaCategoriaModal onSuccess={handleNovaCategoria} tipoFiltro={formData.tipo} />
            </div>
            <Select
              value={formData.categoria_id}
              onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                {categorias
                  .filter(cat => cat.tipo === formData.tipo)
                  .map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-2 gap-4">
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
              />
            </div>
          </div>

          {/* Vencimento e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'EM_ABERTO' | 'PAGO') => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos para quando status é PAGO */}
          {formData.status === 'PAGO' && (
            <div className="grid grid-cols-2 gap-4">
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

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoLancamentoDialog;