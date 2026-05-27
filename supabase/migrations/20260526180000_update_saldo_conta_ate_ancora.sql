-- Atualiza a função para considerar o saldo_inicial_em da conta.
-- Retorna apenas o "delta" desde o saldo_inicial: movimentos com
-- data >= saldo_inicial_em (se houver) e data < p_data.
-- Para obter o saldo total: saldo_inicial + saldo_conta_ate(...).
create or replace function public.saldo_conta_ate(p_conta_id uuid, p_data date)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  with conta as (
    select saldo_inicial_em from public.contas_financeiras where id = p_conta_id
  )
  select coalesce(
    sum(case when m.tipo = 'ENTRADA' then m.valor else -m.valor end),
    0
  )::numeric
  from public.movimentos_financeiros m
  cross join conta c
  where m.conta_id = p_conta_id
    and m.data < p_data
    and (c.saldo_inicial_em is null or m.data >= c.saldo_inicial_em);
$$;
