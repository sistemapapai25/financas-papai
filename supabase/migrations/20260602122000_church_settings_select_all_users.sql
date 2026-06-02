drop policy if exists "church_settings_select_own_or_admin" on public.church_settings;
drop policy if exists "church_settings_select_all" on public.church_settings;

create policy "church_settings_select_all"
on public.church_settings
for select
to authenticated
using (true);
