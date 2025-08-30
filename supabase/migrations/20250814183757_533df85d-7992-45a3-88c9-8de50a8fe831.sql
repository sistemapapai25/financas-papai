-- Allow users to delete their own lancamentos
DROP POLICY IF EXISTS "Apenas admins podem deletar lançamentos" ON public.lancamentos;

CREATE POLICY "Usuários podem deletar seus próprios lançamentos" 
ON public.lancamentos 
FOR DELETE 
USING (user_id = auth.uid());