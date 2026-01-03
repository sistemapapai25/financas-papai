drop policy if exists "Authenticated read Assinaturas" on storage.objects;
create policy "Authenticated read Assinaturas" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'Assinaturas'
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "Authenticated upload Assinaturas" on storage.objects;
create policy "Authenticated upload Assinaturas" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'Assinaturas'
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "Authenticated update Assinaturas" on storage.objects;
create policy "Authenticated update Assinaturas" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'Assinaturas'
    and (owner = auth.uid() or public.is_admin())
  )
  with check (
    bucket_id = 'Assinaturas'
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "Authenticated delete Assinaturas" on storage.objects;
create policy "Authenticated delete Assinaturas" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'Assinaturas'
    and (owner = auth.uid() or public.is_admin())
  );
