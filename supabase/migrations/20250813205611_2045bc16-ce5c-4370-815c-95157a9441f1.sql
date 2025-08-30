-- Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Criar tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário tem role específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- Trigger para criar role padrão quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.auth_user_id, 'user'::app_role);
  RETURN NEW;
END;
$$;

-- Aplicar trigger na tabela profiles
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();

-- Políticas RLS para user_roles
CREATE POLICY "Usuários podem ver próprios roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todos os roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins podem inserir roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins podem atualizar roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_admin());

CREATE POLICY "Admins podem deletar roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_admin());

-- Inserir role admin para o primeiro usuário (opcional - você pode fazer isso manualmente depois)
-- INSERT INTO public.user_roles (user_id, role) 
-- SELECT auth_user_id, 'admin'::app_role 
-- FROM public.profiles 
-- WHERE email = 'seu-email@exemplo.com' 
-- ON CONFLICT (user_id, role) DO NOTHING;