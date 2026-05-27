create or replace function public.saldo_conta_ate(p_conta_id uuid, p_data date)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(case when tipo = 'ENTRADA' then valor else -valor end),
    0
  )::numeric
  from public.movimentos_financeiros
  where conta_id = p_conta_id
    and data < p_data;
$$;

grant execute on function public.saldo_conta_ate(uuid, date) to authenticated;
