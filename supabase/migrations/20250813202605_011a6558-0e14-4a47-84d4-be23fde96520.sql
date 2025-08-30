-- Corrigir warnings de segurança: definir search_path nas funções

-- Recriar função update_updated_at_column com search_path seguro
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recriar função log_lancamento_changes com search_path seguro
CREATE OR REPLACE FUNCTION log_lancamento_changes()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    acao_tipo acao_auditoria;
BEGIN
    -- Determinar o tipo de ação
    IF TG_OP = 'INSERT' THEN
        acao_tipo := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            acao_tipo := 'STATUS_CHANGE';
        ELSE
            acao_tipo := 'UPDATE';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        acao_tipo := 'DELETE';
    END IF;
    
    -- Inserir log de auditoria
    IF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (entidade_id, acao, antes, user_id)
        VALUES (OLD.id, acao_tipo, to_jsonb(OLD), OLD.user_id);
        RETURN OLD;
    ELSE
        INSERT INTO auditoria (entidade_id, acao, antes, depois, user_id)
        VALUES (
            NEW.id, 
            acao_tipo, 
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW), 
            NEW.user_id
        );
        RETURN NEW;
    END IF;
END;
$$;

-- Recriar função set_user_id com search_path seguro
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;