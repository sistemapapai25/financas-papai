-- Criar bucket "Assinaturas" se não existir
insert into storage.buckets (id, name, public)
select 'Assinaturas', 'Assinaturas', false
where not exists (
  select 1 from storage.buckets where id = 'Assinaturas'
);

-- Política: leitura autenticada apenas do próprio objeto
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated read Assinaturas'
  ) then
    create policy "Authenticated read Assinaturas" on storage.objects
      for select to authenticated
      using (bucket_id = 'Assinaturas' and owner = auth.uid());
  end if;
end $$;

-- Política: usuários autenticados podem inserir no bucket Assinaturas
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated upload Assinaturas'
  ) then
    create policy "Authenticated upload Assinaturas" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'Assinaturas' and owner = auth.uid());
  end if;
end $$;

-- Política: usuários autenticados podem atualizar seus próprios arquivos
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated update Assinaturas'
  ) then
    create policy "Authenticated update Assinaturas" on storage.objects
      for update to authenticated
      using (bucket_id = 'Assinaturas' and owner = auth.uid())
      with check (bucket_id = 'Assinaturas' and owner = auth.uid());
  end if;
end $$;

-- Política: usuários autenticados podem deletar seus próprios arquivos
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated delete Assinaturas'
  ) then
    create policy "Authenticated delete Assinaturas" on storage.objects
      for delete to authenticated
      using (bucket_id = 'Assinaturas' and owner = auth.uid());
  end if;
end $$;

