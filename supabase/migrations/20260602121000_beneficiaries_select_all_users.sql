drop policy if exists "ben_select_own" on public.beneficiaries;
drop policy if exists "ben_select_all" on public.beneficiaries;

create policy "ben_select_all"
on public.beneficiaries
for select
to authenticated
using (true);
