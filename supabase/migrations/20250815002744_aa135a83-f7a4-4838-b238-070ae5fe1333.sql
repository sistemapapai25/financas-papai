-- Atualizar políticas RLS para permitir que todos os usuários autenticados vejam todos os dados
-- mas mantenham as restrições de inserção/edição por usuário

-- Políticas para lançamentos
DROP POLICY IF EXISTS "Usuários podem ver seus próprios lançamentos" ON public.lancamentos;
CREATE POLICY "Usuários podem ver todos os lançamentos"
ON public.lancamentos
FOR SELECT
TO authenticated
USING (true);

-- Políticas para beneficiários
DROP POLICY IF EXISTS "ben_select_own" ON public.beneficiaries;
CREATE POLICY "ben_select_all"
ON public.beneficiaries
FOR SELECT
TO authenticated
USING (true);

-- Políticas para categorias
DROP POLICY IF EXISTS "cat_select_own" ON public.categories;
CREATE POLICY "cat_select_all"
ON public.categories
FOR SELECT
TO authenticated
USING (true);

-- Manter as outras políticas de inserção/edição/exclusão inalteradas
-- para que cada usuário só possa criar/editar seus próprios dados