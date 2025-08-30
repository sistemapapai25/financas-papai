import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Edit2, Trash2, Search } from 'lucide-react';

interface Beneficiario {
  id: string;
  name: string;
  documento?: string;
  phone?: string;
  email?: string;
  observacoes?: string;
  created_at: string;
}

const CadastroBeneficiarios = () => {
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBeneficiario, setEditingBeneficiario] = useState<Beneficiario | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    documento: '',
    phone: '',
    email: '',
    observacoes: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadBeneficiarios();
  }, [user]);

  const loadBeneficiarios = async () => {
    try {
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setBeneficiarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar beneficiários:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar beneficiários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);

      if (editingBeneficiario) {
        const { error } = await supabase
          .from('beneficiaries')
          .update({
            name: formData.name.trim(),
            documento: formData.documento.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            observacoes: formData.observacoes.trim() || null
          })
          .eq('id', editingBeneficiario.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Beneficiário atualizado com sucesso!' });
      } else {
        const { error } = await supabase.from('beneficiaries').insert({
          user_id: user?.id,
          name: formData.name.trim(),
          documento: formData.documento.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          observacoes: formData.observacoes.trim() || null
        });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Beneficiário criado com sucesso!' });
      }

      resetForm();
      loadBeneficiarios();
    } catch (error) {
      console.error('Erro ao salvar beneficiário:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar beneficiário', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (beneficiario: Beneficiario) => {
    setEditingBeneficiario(beneficiario);
    setFormData({
      name: beneficiario.name,
      documento: beneficiario.documento || '',
      phone: beneficiario.phone || '',
      email: beneficiario.email || '',
      observacoes: beneficiario.observacoes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o beneficiário "${name}"?`)) return;

    try {
      const { error } = await supabase.from('beneficiaries').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Beneficiário excluído com sucesso!' });
      loadBeneficiarios();
    } catch (error) {
      console.error('Erro ao excluir beneficiário:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir beneficiário', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', documento: '', phone: '', email: '', observacoes: '' });
    setEditingBeneficiario(null);
    setIsDialogOpen(false);
  };

  const filteredBeneficiarios = beneficiarios.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.documento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Beneficiários</h1>
          <p className="text-muted-foreground">Gerencie os beneficiários dos seus lançamentos</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Beneficiário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] mx-4">
            <DialogHeader>
              <DialogTitle>{editingBeneficiario ? 'Editar Beneficiário' : 'Novo Beneficiário'}</DialogTitle>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais"
                />
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

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar beneficiários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-lg">Carregando...</div>
        </div>
      ) : filteredBeneficiarios.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserPlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'Nenhum beneficiário encontrado' : 'Nenhum beneficiário cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando seu primeiro beneficiário'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Primeiro Beneficiário
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
                    <th className="text-left p-4 font-medium">Documento</th>
                    <th className="text-left p-4 font-medium">Telefone</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Observações</th>
                    <th className="text-left p-4 font-medium">Criado em</th>
                    <th className="text-center p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBeneficiarios.map((b, i) => (
                    <tr
                      key={b.id}
                      className={`border-b hover:bg-muted/50 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/25'}`}
                    >
                      <td className="p-4 font-medium">{b.name}</td>
                      <td className="p-4 text-muted-foreground">{b.documento || '-'}</td>
                      <td className="p-4 text-muted-foreground">{b.phone || '-'}</td>
                      <td className="p-4 text-muted-foreground">{b.email || '-'}</td>
                      <td className="p-4 text-muted-foreground max-w-xs truncate">{b.observacoes || '-'}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(b)}>
                            <Edit2 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(b.id, b.name)}>
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

export default CadastroBeneficiarios;
