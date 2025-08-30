-- Agora que as políticas RLS foram atualizadas, remover a coluna role da tabela profiles
-- O role deve ficar apenas na tabela user_roles que usa o enum app_role

-- Primeiro, remover a constraint check
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Remover a coluna role da tabela profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;