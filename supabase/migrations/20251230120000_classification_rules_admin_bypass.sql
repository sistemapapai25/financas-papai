alter table public.classification_rules enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classification_rules'
      and policyname = 'classification_rules_select_admin'
  ) then
    create policy "classification_rules_select_admin"
    on public.classification_rules
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classification_rules'
      and policyname = 'classification_rules_insert_admin'
  ) then
    create policy "classification_rules_insert_admin"
    on public.classification_rules
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classification_rules'
      and policyname = 'classification_rules_update_admin'
  ) then
    create policy "classification_rules_update_admin"
    on public.classification_rules
    for update
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classification_rules'
      and policyname = 'classification_rules_delete_admin'
  ) then
    create policy "classification_rules_delete_admin"
    on public.classification_rules
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;
