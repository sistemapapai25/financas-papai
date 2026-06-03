drop policy if exists "contas_financeiras_select_all_users" on public.contas_financeiras;
create policy "contas_financeiras_select_all_users"
on public.contas_financeiras
for select
to authenticated
using (true);
