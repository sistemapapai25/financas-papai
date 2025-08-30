-- Primeiro, vamos ajustar o schema existente para o modelo de dados completo do sistema de Contas a Pagar

-- Criar tipos enum necessários
CREATE TYPE app_role AS ENUM ('ADMIN', 'USER');
CREATE TYPE tipo_lancamento AS ENUM ('DESPESA', 'RECEITA');
CREATE TYPE status_lancamento AS ENUM ('EM_ABERTO', 'PAGO', 'CANCELADO');
CREATE TYPE forma_pagamento AS ENUM ('PIX', 'DINHEIRO', 'CARTAO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO');
CREATE TYPE tipo_categoria AS ENUM ('DESPESA', 'RECEITA');
CREATE TYPE acao_auditoria AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE');

-- Ajustar a tabela profiles para incluir role
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role app_role DEFAULT 'USER';

-- Ajustar a tabela beneficiaries para o modelo correto
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Ajustar a tabela categories para incluir tipo
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tipo tipo_categoria NOT NULL DEFAULT 'DESPESA';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Recriar a tabela transactions para o modelo de lancamentos
DROP TABLE IF EXISTS transactions;
CREATE TABLE lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo tipo_lancamento NOT NULL,
    beneficiario_id UUID REFERENCES beneficiaries(id) ON DELETE RESTRICT,
    categoria_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
    descricao TEXT,
    valor DECIMAL(14,2) NOT NULL CHECK (valor > 0),
    forma_pagamento forma_pagamento,
    vencimento DATE NOT NULL,
    status status_lancamento DEFAULT 'EM_ABERTO',
    data_pagamento DATE,
    valor_pago DECIMAL(14,2) CHECK (valor_pago > 0 OR valor_pago IS NULL),
    observacoes TEXT,
    boleto_url TEXT,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT beneficiario_obrigatorio_despesa CHECK (
        (tipo = 'DESPESA' AND beneficiario_id IS NOT NULL) OR 
        (tipo = 'RECEITA')
    ),
    CONSTRAINT pagamento_consistente CHECK (
        (status = 'PAGO' AND data_pagamento IS NOT NULL AND valor_pago IS NOT NULL) OR
        (status != 'PAGO' AND data_pagamento IS NULL AND valor_pago IS NULL)
    )
);

-- Criar tabela de auditoria
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade TEXT NOT NULL DEFAULT 'lancamentos',
    entidade_id UUID NOT NULL,
    acao acao_auditoria NOT NULL,
    antes JSONB,
    depois JSONB,
    motivo TEXT,
    user_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lancamentos
CREATE POLICY "Usuários podem ver seus próprios lançamentos" ON lancamentos
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Usuários podem criar seus próprios lançamentos" ON lancamentos
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seus próprios lançamentos" ON lancamentos
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Apenas admins podem deletar lançamentos" ON lancamentos
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
    );

-- Políticas RLS para auditoria
CREATE POLICY "Usuários podem ver auditoria de seus registros" ON auditoria
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Sistema pode inserir na auditoria" ON auditoria
    FOR INSERT WITH CHECK (true);

-- Criar índices
CREATE INDEX idx_lancamentos_user_status ON lancamentos(user_id, status);
CREATE INDEX idx_lancamentos_user_vencimento ON lancamentos(user_id, vencimento);
CREATE INDEX idx_lancamentos_user_data_pagamento ON lancamentos(user_id, data_pagamento);
CREATE INDEX idx_beneficiaries_user_nome ON beneficiaries(user_id, name);
CREATE INDEX idx_categories_user_nome ON categories(user_id, name);
CREATE INDEX idx_lancamentos_em_aberto ON lancamentos(user_id, vencimento) WHERE status = 'EM_ABERTO';
CREATE INDEX idx_lancamentos_pagos ON lancamentos(user_id, data_pagamento) WHERE status = 'PAGO';

-- Adicionar constraints únicos
ALTER TABLE beneficiaries ADD CONSTRAINT unique_beneficiary_per_user UNIQUE (user_id, name);
ALTER TABLE categories ADD CONSTRAINT unique_category_per_user UNIQUE (user_id, name);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para updated_at em lancamentos
CREATE TRIGGER update_lancamentos_updated_at 
    BEFORE UPDATE ON lancamentos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função de auditoria
CREATE OR REPLACE FUNCTION log_lancamento_changes()
RETURNS TRIGGER AS $$
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
$$ language 'plpgsql';

-- Trigger de auditoria para lancamentos
CREATE TRIGGER lancamentos_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON lancamentos
    FOR EACH ROW EXECUTE FUNCTION log_lancamento_changes();

-- Função para definir user_id automaticamente
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para definir user_id automaticamente
CREATE TRIGGER lancamentos_set_user_id 
    BEFORE INSERT ON lancamentos 
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- Inserir dados iniciais (seeds)
-- Categorias DESPESA
INSERT INTO categories (name, tipo, user_id) VALUES 
('Água', 'DESPESA', '00000000-0000-0000-0000-000000000000'),
('Luz', 'DESPESA', '00000000-0000-0000-0000-000000000000'),
('Internet', 'DESPESA', '00000000-0000-0000-0000-000000000000'),
('Aluguel', 'DESPESA', '00000000-0000-0000-0000-000000000000'),
('Materiais', 'DESPESA', '00000000-0000-0000-0000-000000000000');

-- Categorias RECEITA
INSERT INTO categories (name, tipo, user_id) VALUES 
('Dízimos', 'RECEITA', '00000000-0000-0000-0000-000000000000'),
('Ofertas', 'RECEITA', '00000000-0000-0000-0000-000000000000'),
('Doações', 'RECEITA', '00000000-0000-0000-0000-000000000000');

-- Beneficiários de exemplo
INSERT INTO beneficiaries (name, phone, user_id) VALUES 
('SABESP', '(11) 3388-8000', '00000000-0000-0000-0000-000000000000'),
('Enel São Paulo', '0800-727-0120', '00000000-0000-0000-0000-000000000000'),
('Vivo Fibra', '0800-771-0810', '00000000-0000-0000-0000-000000000000');

-- Criar bucket para boletos
INSERT INTO storage.buckets (id, name, public) VALUES ('boletos', 'boletos', false);

-- Políticas de storage para boletos
CREATE POLICY "Usuários podem visualizar seus próprios boletos" ON storage.objects
    FOR SELECT USING (bucket_id = 'boletos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem fazer upload de boletos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'boletos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem atualizar seus próprios boletos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'boletos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem deletar seus próprios boletos" ON storage.objects
    FOR DELETE USING (bucket_id = 'boletos' AND auth.uid()::text = (storage.foldername(name))[1]);