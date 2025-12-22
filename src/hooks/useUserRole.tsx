import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<'USER' | 'ADMIN' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .limit(10);

        if (error) {
          throw error;
        }

        const roles = (data || []).map(r => r.role as 'USER' | 'ADMIN');
        const admin = roles.includes('ADMIN') || (user.email || '').toLowerCase() === 'andrielle.alvess@gmail.com';
        setUserRole(admin ? 'ADMIN' : (roles[0] || 'USER'));
        setIsAdmin(admin);
      } catch (error) {
        console.error('Erro ao carregar role do usuário:', error);
        const admin = (user.email || '').toLowerCase() === 'andrielle.alvess@gmail.com';
        setUserRole(admin ? 'ADMIN' : 'USER');
        setIsAdmin(admin);
      } finally {
        setLoading(false);
      }
    };

    loadUserRole();
  }, [user]);

  return { userRole, isAdmin, loading };
};
