-- Atualizar políticas RLS para usar a função is_admin() ao invés do campo role da tabela profiles

-- Política para lançamentos - SELECT
DROP POLICY IF EXISTS "Usuários podem ver seus próprios lançamentos" ON public.lancamentos;
CREATE POLICY "Usuários podem ver seus próprios lançamentos" 
ON public.lancamentos 
FOR SELECT 
USING (user_id = auth.uid() OR is_admin());

-- Política para lançamentos - UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios lançamentos" ON public.lancamentos;
CREATE POLICY "Usuários podem atualizar seus próprios lançamentos" 
ON public.lancamentos 
FOR UPDATE 
USING (user_id = auth.uid() OR is_admin());

-- Política para auditoria - SELECT
DROP POLICY IF EXISTS "Usuários podem ver auditoria de seus registros" ON public.auditoria;
CREATE POLICY "Usuários podem ver auditoria de seus registros" 
ON public.auditoria 
FOR SELECT 
USING (user_id = auth.uid() OR is_admin());