import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

interface NovaCategoriaModalProps {
  onSuccess?: (categoria: { id: string; name: string; tipo: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA' }) => void;
  trigger?: React.ReactNode;
  tipoFiltro?: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA';
}

const NovaCategoriaModal = ({ onSuccess, trigger, tipoFiltro }: NovaCategoriaModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tipo: tipoFiltro || ('DESPESA' as 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA')
  });
  const [mode, setMode] = useState<'ROOT' | 'CHILD'>('ROOT');
  const [parentId, setParentId] = useState<string | null>(null);
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();

  // carregar pais quando abrir ou tipo mudar
  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from('categories')
      .select('id,name,tipo')
      .eq('user_id', user.id)
      .eq('tipo', formData.tipo)
      .is('parent_id', null)
      .order('name')
      .then(({ data }) => {
        setParents((data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      });
  }, [open, user, formData.tipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const nome = formData.name.trim();

      // Primeiro, verificar se já existe categoria com este nome para o usuário
      const { data: existing } = await supabase
        .from('categories')
        .select('id, name, tipo, parent_id')
        .eq('user_id', user?.id as string)
        .eq('name', nome);

      let createdOrUpdated: { id: string; name: string; tipo: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA' } | null = null;

      if (existing && existing.length > 0) {
        const cat = existing[0] as { id: string; name: string; tipo: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA'; parent_id: string | null };
        // Se já existe, alinhar tipo e parent conforme seleção
        const desiredParent = mode === 'CHILD' ? parentId : null;
        if (cat.tipo !== formData.tipo || (cat.parent_id ?? null) !== (desiredParent ?? null)) {
          const { data: upd, error: updErr } = await supabase
            .from('categories')
            .update({ tipo: formData.tipo, parent_id: desiredParent })
            .eq('id', cat.id)
            .select('id, name, tipo')
            .single();
          if (updErr) throw updErr;
          createdOrUpdated = upd as any;
        } else {
          createdOrUpdated = { id: cat.id, name: cat.name, tipo: cat.tipo };
        }
      } else {
        // Não existe: inserir normalmente
        const { data, error } = await supabase
          .from('categories')
          .insert({
            user_id: user?.id,
            name: nome,
            tipo: formData.tipo,
            parent_id: mode === 'CHILD' ? parentId : null
          })
          .select('id, name, tipo')
          .single();
        if (error) throw error;
        createdOrUpdated = data as any;
      }

      toast({
        title: "Sucesso",
        description: existing && existing.length > 0 ? "Categoria atualizada/ajustada com sucesso!" : "Categoria criada com sucesso!",
      });

      setFormData({
        name: '',
        tipo: tipoFiltro || 'DESPESA'
      });
      setMode('ROOT');
      setParentId(null);

      setOpen(false);
      if (createdOrUpdated) onSuccess?.(createdOrUpdated);
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao criar/atualizar categoria. Tente novamente.",
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
          <DialogTitle>Nova Categoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de criação</Label>
            <RadioGroup value={mode} onValueChange={(v: 'ROOT'|'CHILD') => setMode(v)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ROOT" id="root" />
                <Label htmlFor="root">Categoria raiz</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CHILD" id="child" />
                <Label htmlFor="child">Subcategoria</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome da categoria"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA') => setFormData({ ...formData, tipo: value })}
              disabled={!!tipoFiltro}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESPESA">Despesa</SelectItem>
                <SelectItem value="RECEITA">Receita</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'CHILD' && (
            <div className="space-y-2">
              <Label htmlFor="parent">Categoria pai *</Label>
              <Select value={parentId ?? ''} onValueChange={(value) => setParentId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  {parents.filter(p=>p.id!==undefined).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

export default NovaCategoriaModal;
