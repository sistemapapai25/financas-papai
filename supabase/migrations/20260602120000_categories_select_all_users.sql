drop policy if exists "cat_select_own" on public.categories;
drop policy if exists "cat_select_all" on public.categories;

create policy "cat_select_all"
on public.categories
for select
to authenticated
using (true);
