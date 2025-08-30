import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

interface NovoBeneficiarioModalProps {
  onSuccess?: (beneficiario: { id: string; name: string }) => void;
  trigger?: React.ReactNode;
}

const NovoBeneficiarioModal = ({ onSuccess, trigger }: NovoBeneficiarioModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    documento: '',
    phone: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome do beneficiário é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('beneficiaries')
        .insert({
          user_id: user?.id,
          name: formData.name.trim(),
          documento: formData.documento.trim() || null,
          phone: formData.phone.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Beneficiário criado com sucesso!",
      });

      setFormData({
        name: '',
        documento: '',
        phone: ''
      });

      setOpen(false);
      onSuccess?.(data);
    } catch (error) {
      console.error('Erro ao criar beneficiário:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar beneficiário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
    >
      <Plus className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Novo Beneficiário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do beneficiário"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="documento">Documento</Label>
            <Input
              id="documento"
              value={formData.documento}
              onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
              placeholder="CPF/CNPJ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 99999-9999"
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

export default NovoBeneficiarioModal;