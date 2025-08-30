-- Criar função RPC para atualizar saldo da conta
-- Esta função registra um movimento financeiro de entrada quando um culto é salvo

CREATE OR REPLACE FUNCTION atualizar_saldo_conta(
  conta_id UUID,
  valor NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir movimento financeiro de entrada
  INSERT INTO movimentos_financeiros (
    user_id,
    conta_id,
    data,
    tipo,
    valor,
    descricao,
    origem
  )
  VALUES (
    auth.uid(),
    conta_id,
    CURRENT_DATE,
    'ENTRADA',
    valor,
    'Entrada de culto',
    'CULTO'
  );
END;
$$;

-- Conceder permissões para usuários autenticados
GRANT EXECUTE ON FUNCTION atualizar_saldo_conta(UUID, NUMERIC) TO authenticated;