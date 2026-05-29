alter table public.movimentos_financeiros enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'movimentos_financeiros'
      and policyname = 'movimentos_financeiros_update_admin'
  ) then
    create policy "movimentos_financeiros_update_admin"
    on public.movimentos_financeiros
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;
