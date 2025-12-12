-- Políticas de storage para o bucket Logos

-- Permitir leitura pública (bucket já é público)
CREATE POLICY "Logos são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'Logos');

-- Permitir upload por usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload de logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'Logos' 
  AND auth.role() = 'authenticated'
);

-- Permitir atualização do próprio arquivo
CREATE POLICY "Usuários podem atualizar seus logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'Logos' 
  AND auth.role() = 'authenticated'
);

-- Permitir exclusão do próprio arquivo
CREATE POLICY "Usuários podem deletar seus logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'Logos' 
  AND auth.role() = 'authenticated'
);