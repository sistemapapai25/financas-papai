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
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw error;
        }

        const role = data?.role || 'USER';
        setUserRole(role as 'USER' | 'ADMIN');
        setIsAdmin(role === 'ADMIN');
      } catch (error) {
        console.error('Erro ao carregar role do usuário:', error);
        setUserRole('USER');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    loadUserRole();
  }, [user]);

  return { userRole, isAdmin, loading };
};