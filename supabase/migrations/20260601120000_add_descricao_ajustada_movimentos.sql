alter table public.movimentos_financeiros
  add column if not exists descricao_ajustada_em timestamptz null;

create index if not exists idx_movimentos_descricao_pendente
  on public.movimentos_financeiros (user_id, data)
  where regras_aplicadas_em is not null
    and descricao_ajustada_em is null;
