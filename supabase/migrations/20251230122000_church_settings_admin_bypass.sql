alter table public.church_settings enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_settings'
      and policyname = 'church_settings_select_own_or_admin'
  ) then
    create policy "church_settings_select_own_or_admin"
    on public.church_settings
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_settings'
      and policyname = 'church_settings_insert_own_or_admin'
  ) then
    create policy "church_settings_insert_own_or_admin"
    on public.church_settings
    for insert
    to authenticated
    with check (user_id = auth.uid() or public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_settings'
      and policyname = 'church_settings_update_own_or_admin'
  ) then
    create policy "church_settings_update_own_or_admin"
    on public.church_settings
    for update
    to authenticated
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_settings'
      and policyname = 'church_settings_delete_own_or_admin'
  ) then
    create policy "church_settings_delete_own_or_admin"
    on public.church_settings
    for delete
    to authenticated
    using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;
