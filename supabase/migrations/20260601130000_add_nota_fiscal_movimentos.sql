alter table public.movimentos_financeiros
  add column if not exists nota_fiscal_url text null;

create index if not exists idx_movimentos_nota_fiscal
  on public.movimentos_financeiros (user_id, data)
  where nota_fiscal_url is not null;

insert into storage.buckets (id, name, public)
select 'Comprovantes', 'Comprovantes', true
where not exists (
  select 1 from storage.buckets where id = 'Comprovantes'
);
