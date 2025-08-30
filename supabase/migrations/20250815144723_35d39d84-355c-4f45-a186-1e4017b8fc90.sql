-- Adicionar campo comprovante_url para armazenar o comprovante de pagamento
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- Adicionar comentários para documentar os campos
COMMENT ON COLUMN lancamentos.boleto_url IS 'URL do arquivo do boleto';
COMMENT ON COLUMN lancamentos.comprovante_url IS 'URL do arquivo do comprovante de pagamento';