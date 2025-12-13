-- Criar bucket "Comprovantes" se não existir
insert into storage.buckets (id, name, public)
select 'Comprovantes', 'Comprovantes', true
where not exists (
  select 1 from storage.buckets where id = 'Comprovantes'
);

-- Política: leitura pública do bucket Comprovantes
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read Comprovantes'
  ) then
    create policy "Public read Comprovantes" on storage.objects
      for select using (bucket_id = 'Comprovantes');
  end if;
end $$;

-- Política: usuários autenticados podem inserir arquivos no próprio bucket
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated upload Comprovantes'
  ) then
    create policy "Authenticated upload Comprovantes" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'Comprovantes' and owner = auth.uid());
  end if;
end $$;

-- Política: usuários autenticados podem atualizar seus próprios arquivos
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated update Comprovantes'
  ) then
    create policy "Authenticated update Comprovantes" on storage.objects
      for update to authenticated
      using (bucket_id = 'Comprovantes' and owner = auth.uid())
      with check (bucket_id = 'Comprovantes' and owner = auth.uid());
  end if;
end $$;

-- Política: usuários autenticados podem excluir seus próprios arquivos
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated delete Comprovantes'
  ) then
    create policy "Authenticated delete Comprovantes" on storage.objects
      for delete to authenticated
      using (bucket_id = 'Comprovantes' and owner = auth.uid());
  end if;
end $$;
