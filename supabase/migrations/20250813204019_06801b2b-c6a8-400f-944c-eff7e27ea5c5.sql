-- Inserir categorias padrão para despesas
INSERT INTO public.categories (name, tipo, user_id) VALUES
('Geral', 'DESPESA', auth.uid()),
('Alimentação', 'DESPESA', auth.uid()),
('Transporte', 'DESPESA', auth.uid()),
('Moradia', 'DESPESA', auth.uid()),
('Saúde', 'DESPESA', auth.uid()),
('Educação', 'DESPESA', auth.uid()),
('Lazer', 'DESPESA', auth.uid());

-- Inserir categorias padrão para receitas
INSERT INTO public.categories (name, tipo, user_id) VALUES
('Salário', 'RECEITA', auth.uid()),
('Freelance', 'RECEITA', auth.uid()),
('Investimentos', 'RECEITA', auth.uid()),
('Vendas', 'RECEITA', auth.uid()),
('Outros', 'RECEITA', auth.uid());