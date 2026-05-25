alter table public.contas_financeiras
  add column if not exists ativo boolean not null default true;

update public.contas_financeiras set ativo = true where ativo is null;
