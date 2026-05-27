alter table public.movimentos_financeiros
  add column if not exists conferido boolean not null default false,
  add column if not exists conferido_em timestamptz null;

create index if not exists idx_movimentos_conferido
  on public.movimentos_financeiros (conta_id, data, conferido);
