drop policy if exists "Authenticated read Assinaturas" on storage.objects;

create policy "Authenticated read Assinaturas" on storage.objects
for select
to authenticated
using (bucket_id = 'Assinaturas');
