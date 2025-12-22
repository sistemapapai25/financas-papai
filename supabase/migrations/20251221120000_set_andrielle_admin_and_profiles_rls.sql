DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth_user_id
  INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower('andrielle.alvess@gmail.com')
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'ADMIN'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING (auth.uid() = auth_user_id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
USING (auth.uid() = auth_user_id OR public.is_admin());

