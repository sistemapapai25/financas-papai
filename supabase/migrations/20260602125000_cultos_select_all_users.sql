drop policy if exists "cultos_select_all_users" on public.cultos;
create policy "cultos_select_all_users"
on public.cultos
for select
to authenticated
using (true);

drop policy if exists "dizimos_select_all_users" on public.dizimos;
create policy "dizimos_select_all_users"
on public.dizimos
for select
to authenticated
using (true);

drop policy if exists "ofertas_select_all_users" on public.ofertas;
create policy "ofertas_select_all_users"
on public.ofertas
for select
to authenticated
using (true);

drop policy if exists "tipos_culto_select_all_users" on public.tipos_culto;
create policy "tipos_culto_select_all_users"
on public.tipos_culto
for select
to authenticated
using (true);
