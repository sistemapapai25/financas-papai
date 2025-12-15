import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserPlus, Edit2, Trash2, Search, MoreVertical } from 'lucide-react';

interface Beneficiario {
  id: string;
  name: string;
  documento?: string;
  phone?: string;
  email?: string;
  observacoes?: string;
  assinatura_path?: string | null;
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
    observacoes: '',
    assinatura_path: '' as string | null,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  function formatCPF(s: string) {
    const d = String(s).replace(/\D+/g, '');
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '-' + p4;
    return out;
  }
  function formatCNPJ(s: string) {
    const d = String(s).replace(/\D+/g, '');
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 5);
    const p3 = d.slice(5, 8);
    const p4 = d.slice(8, 12);
    const p5 = d.slice(12, 14);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '/' + p4;
    if (p5) out += '-' + p5;
    return out;
  }
  function formatDoc(s: string) {
    const d = String(s).replace(/\D+/g, '');
    return d.length >= 12 ? formatCNPJ(s) : formatCPF(s);
  }
  function formatPhone(s: string) {
    const d = String(s).replace(/\D+/g, '');
    const isCel = d.length >= 11;
    const p1 = d.slice(0, 2);
    const p2 = isCel ? d.slice(2, 7) : d.slice(2, 6);
    const p3 = isCel ? d.slice(7, 11) : d.slice(6, 10);
    let out = '';
    if (p1) out += '(' + p1 + ') ';
    if (p2) out += p2;
    if (p3) out += '-' + p3;
    return out || s;
  }

  useEffect(() => {
    if (user) loadBeneficiarios();
  }, [user]);

  const loadBeneficiarios = async () => {
    try {
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('user_id', user!.id)
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
            observacoes: formData.observacoes.trim() || null,
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
          observacoes: formData.observacoes.trim() || null,
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
      documento: beneficiario.documento ? formatDoc(beneficiario.documento) : '',
      phone: beneficiario.phone ? formatPhone(beneficiario.phone) : '',
      email: beneficiario.email || '',
      observacoes: beneficiario.observacoes || '',
      assinatura_path: beneficiario.assinatura_path || '',
    });
    if (beneficiario.assinatura_path) {
      supabase.storage.from('Assinaturas').createSignedUrl(beneficiario.assinatura_path, 600).then(({ data }) => setPreviewUrl(data?.signedUrl ?? null));
    } else {
      if (user) {
        const folder = `assinaturas/${user.id}/beneficiarios`;
        supabase.storage.from('Assinaturas').list(folder, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } }).then(({ data }) => {
          const match = (data || []).find(f => f.name.startsWith(`${beneficiario.id}-`));
          if (match) {
            const path = `${folder}/${match.name}`;
            setFormData(prev => ({ ...prev, assinatura_path: path }));
            supabase.storage.from('Assinaturas').createSignedUrl(path, 600).then(({ data }) => setPreviewUrl(data?.signedUrl ?? null));
            return;
          }
          setPreviewUrl(null);
        });
      } else {
        setPreviewUrl(null);
      }
    }
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
    setFormData({ name: '', documento: '', phone: '', email: '', observacoes: '', assinatura_path: '' });
    setPreviewUrl(null);
    setEditingBeneficiario(null);
    setIsDialogOpen(false);
  };

  const uploadAssinatura = async (file: File) => {
    if (!user) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const baseId = editingBeneficiario?.id || 'novo';
      const path = `assinaturas/${user.id}/beneficiarios/${baseId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('Assinaturas').upload(path, file, { contentType: file.type || 'image/png', upsert: false });
      if (upErr) throw upErr;
      setFormData(prev => ({ ...prev, assinatura_path: path }));
      const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(path, 600);
      setPreviewUrl(signed?.signedUrl ?? null);
      toast({ title: 'Assinatura', description: 'Imagem enviada com sucesso' });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha no upload', variant: 'destructive' });
    }
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
                  onChange={(e) => setFormData({ ...formData, documento: formatDoc(e.target.value) })}
                  placeholder="CPF/CNPJ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
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

              <div className="space-y-2">
                <Label>Assinatura (PNG/JPG)</Label>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAssinatura(f); }} />
                      Enviar Imagem
                    </label>
                  </Button>
                  {previewUrl && (
                    <Button type="button" variant="outline" onClick={() => window.open(previewUrl!, '_blank')}>Visualizar</Button>
                  )}
                </div>
                {formData.assinatura_path ? (
                  <div className="text-xs text-muted-foreground">Armazenado em: {formData.assinatura_path}</div>
                ) : null}
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
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar beneficiários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <span className="sr-only">Limpar</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        )}
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
                      <td className="p-4 text-muted-foreground">{b.documento ? formatDoc(b.documento) : '-'}</td>
                      <td className="p-4 text-muted-foreground">{b.phone ? formatPhone(b.phone) : '-'}</td>
                      <td className="p-4 text-muted-foreground">{b.email || '-'}</td>
                      <td className="p-4 text-muted-foreground max-w-xs truncate">{b.observacoes || '-'}</td>

                      <td className="p-4">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(b)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(b.id, b.name)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
