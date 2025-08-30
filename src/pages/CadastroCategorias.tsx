import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Edit2, Trash2, Search, Plus } from 'lucide-react';

interface Categoria {
  id: string;
  name: string;
  tipo: 'DESPESA' | 'RECEITA';
  created_at: string;
}

const CadastroCategorias = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'DESPESA' | 'RECEITA'>('ALL');
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tipo: 'DESPESA' as 'DESPESA' | 'RECEITA'
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadCategorias();
    }
  }, [user]);

  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (editingCategoria) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            tipo: formData.tipo
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            user_id: user?.id,
            name: formData.name.trim(),
            tipo: formData.tipo
          });

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso!",
        });
      }

      resetForm();
      loadCategorias();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      name: categoria.name,
      tipo: categoria.tipo
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso!",
      });
      
      loadCategorias();
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', tipo: 'DESPESA' });
    setEditingCategoria(null);
    setIsDialogOpen(false);
  };

  const filteredCategorias = categorias.filter(categoria => {
    const matchesSearch = categoria.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterTipo === 'ALL' || categoria.tipo === filterTipo;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Categorias</h1>
          <p className="text-muted-foreground">Organize suas receitas e despesas por categoria</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px] mx-4">
            <DialogHeader>
              <DialogTitle>
                {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  onValueChange={(value: 'DESPESA' | 'RECEITA') => setFormData({ ...formData, tipo: value })}
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

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTipo} onValueChange={(value: 'ALL' | 'DESPESA' | 'RECEITA') => setFilterTipo(value)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="DESPESA">Despesas</SelectItem>
            <SelectItem value="RECEITA">Receitas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Categorias */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-lg">Carregando...</div>
        </div>
      ) : filteredCategorias.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Tag className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterTipo !== 'ALL' 
                ? 'Nenhuma categoria encontrada' 
                : 'Nenhuma categoria cadastrada'
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterTipo !== 'ALL'
                ? 'Tente ajustar sua busca ou filtros'
                : 'Comece criando sua primeira categoria'
              }
            </p>
            {!searchTerm && filterTipo === 'ALL' && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Categoria
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium">Nome</th>
                    <th className="text-left p-4 font-medium">Tipo</th>
                    <th className="text-left p-4 font-medium">Criado em</th>
                    <th className="text-center p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategorias.map((categoria, index) => (
                    <tr key={categoria.id} className={`border-b hover:bg-muted/50 transition-colors ${index % 2 === 0 ? '' : 'bg-muted/25'}`}>
                      <td className="p-4 font-medium">{categoria.name}</td>
                      <td className="p-4">
                        <Badge 
                          variant={categoria.tipo === 'DESPESA' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {categoria.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(categoria.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(categoria)}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(categoria.id, categoria.name)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CadastroCategorias;
