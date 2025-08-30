-- Inserir role admin para o primeiro usuário cadastrado
-- (apenas se não houver nenhum admin ainda)
INSERT INTO public.user_roles (user_id, role) 
SELECT p.auth_user_id, 'ADMIN'::app_role 
FROM public.profiles p
WHERE p.auth_user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADMIN')
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;