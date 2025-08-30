import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown, User, Shield, ShieldCheck } from 'lucide-react';
import NovoUsuarioModal from '@/components/NovoUsuarioModal';

interface Usuario {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  roles: {
    id: string;
    role: 'USER' | 'ADMIN';
  }[];
}

const CadastroUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !roleLoading) {
      if (isAdmin) {
        loadUsuarios();
      } else {
        setLoading(false);
      }
    }
  }, [user, isAdmin, roleLoading]);

  const loadUsuarios = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usuariosFormatados = (profiles || []).map(profile => ({
        id: profile.auth_user_id || '',
        email: profile.email,
        name: profile.name,
        created_at: profile.created_at,
        roles: (roles || [])
          .filter(role => role.user_id === profile.auth_user_id)
          .map(role => ({ id: role.id, role: role.role as 'USER' | 'ADMIN' }))
      }));

      setUsuarios(usuariosFormatados);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'USER' | 'ADMIN') => {
    if (userId === user?.id && newRole === 'USER') {
      toast({
        title: "Erro",
        description: "Você não pode remover sua própria permissão de admin",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissão atualizada com sucesso!",
      });

      loadUsuarios();
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissão",
        variant: "destructive",
      });
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Verificando permissões...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
          <Shield className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold mb-4">Acesso Restrito</h1>
          <p className="text-muted-foreground text-lg mb-6">
            Esta página é exclusiva para administradores.
          </p>
          <p className="text-sm text-muted-foreground">
            Se você acredita que deveria ter acesso, entre em contato com um administrador.
          </p>
        </div>
      </div>
    );
  }

  const adminCount = usuarios.filter(u => u.roles.some(r => r.role === 'ADMIN')).length;
  const userCount = usuarios.length - adminCount;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-bold text-primary">Gerenciar Usuários</h1>
              </div>
              <p className="text-muted-foreground">Controle as permissões dos usuários do sistema</p>
            </div>
            <NovoUsuarioModal onUserCreated={loadUsuarios} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{usuarios.length}</div>
              <div className="text-sm text-muted-foreground">Total de Usuários</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{adminCount}</div>
              <div className="text-sm text-muted-foreground">Administradores</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{userCount}</div>
              <div className="text-sm text-muted-foreground">Usuários</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Usuários */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-lg">Carregando usuários...</div>
          </div>
        ) : usuarios.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
              <p className="text-muted-foreground">
                Os usuários aparecerão aqui conforme se cadastrarem no sistema.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {usuarios.map((usuario) => {
              const currentRole = usuario.roles[0]?.role || 'USER';
              const isCurrentUser = usuario.id === user?.id;
              
              return (
                <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {currentRole === 'ADMIN' ? (
                            <Crown className="w-5 h-5 text-orange-600" />
                          ) : (
                            <User className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{usuario.name || 'Usuário'}</h3>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">
                                Você
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground break-all">
                            {usuario.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cadastrado em: {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={currentRole === 'ADMIN' ? 'default' : 'secondary'}
                          className={currentRole === 'ADMIN' ? 'bg-orange-600 text-white' : ''}
                        >
                          {currentRole === 'ADMIN' ? 'Administrador' : 'Usuário'}
                        </Badge>

                        <Select
                          value={currentRole}
                          onValueChange={(value: 'USER' | 'ADMIN') => handleRoleChange(usuario.id, value)}
                          disabled={isCurrentUser}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">Usuário</SelectItem>
                            <SelectItem value="ADMIN">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isCurrentUser && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <Shield className="w-4 h-4 inline mr-1" />
                          Você não pode alterar suas próprias permissões por questões de segurança.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Informações sobre permissões */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Sobre as Permissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>Usuário:</strong> Pode gerenciar apenas seus próprios lançamentos, categorias e beneficiários.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Crown className="w-4 h-4 mt-0.5 text-orange-600" />
              <div>
                <strong>Administrador:</strong> Tem acesso total ao sistema, incluindo gerenciamento de usuários e permissões.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CadastroUsuarios;
