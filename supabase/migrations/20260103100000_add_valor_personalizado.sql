-- Add valor_personalizado column to desafio_participantes
alter table public.desafio_participantes
add column if not exists valor_personalizado numeric(10,2);

-- Update gerar_carne_para_participante to use valor_personalizado if available
create or replace function public.gerar_carne_para_participante(_participante_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desafio public.desafios%rowtype;
  v_part public.desafio_participantes%rowtype;
  v_i int;
  v_comp date;
  v_venc date;
  v_last_day int;
  v_valor numeric(10,2);
begin
  select * into v_part from public.desafio_participantes where id = _participante_id;
  if not found then
    raise exception 'participante não encontrado: %', _participante_id;
  end if;

  select * into v_desafio from public.desafios where id = v_part.desafio_id;
  if not found then
    raise exception 'desafio não encontrado: %', v_part.desafio_id;
  end if;

  -- Determine the value to use: custom value if present, otherwise default challenge value
  v_valor := coalesce(v_part.valor_personalizado, v_desafio.valor_mensal);

  for v_i in 0..(v_desafio.qtd_parcelas - 1) loop
    v_comp := (date_trunc('month', v_desafio.data_inicio)::date + make_interval(months => v_i))::date;
    
    -- Calculate due date handling month end days
    v_last_day := extract(day from (date_trunc('month', v_comp)::date + interval '1 month - 1 day'))::int;
    v_venc := make_date(
      extract(year from v_comp)::int,
      extract(month from v_comp)::int,
      least(v_desafio.dia_vencimento, v_last_day)
    );

    insert into public.desafio_parcelas (participante_id, competencia, vencimento, valor, status)
    values (_participante_id, v_comp, v_venc, v_valor, 'ABERTO')
    on conflict (participante_id, competencia) do nothing;
  end loop;
end;
$$;
