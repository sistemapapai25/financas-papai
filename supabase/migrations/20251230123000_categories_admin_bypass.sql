do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_insert_admin'
  ) then
    create policy "categories_insert_admin"
    on public.categories
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
      and tablename = 'categories'
      and policyname = 'categories_update_admin'
  ) then
    create policy "categories_update_admin"
    on public.categories
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_delete_admin'
  ) then
    create policy "categories_delete_admin"
    on public.categories
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;

