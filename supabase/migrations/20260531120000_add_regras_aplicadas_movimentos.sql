alter table public.movimentos_financeiros
  add column if not exists regras_aplicadas_em timestamptz null;

create index if not exists idx_movimentos_regras_pendentes
  on public.movimentos_financeiros (user_id, data)
  where regras_aplicadas_em is null;
