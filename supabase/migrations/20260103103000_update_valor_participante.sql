create or replace function public.atualizar_valor_participante(_participante_id uuid, _novo_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Atualiza o valor personalizado no participante
  update public.desafio_participantes
  set valor_personalizado = _novo_valor
  where id = _participante_id;

  -- Atualiza as parcelas em aberto
  update public.desafio_parcelas
  set valor = _novo_valor
  where participante_id = _participante_id
    and status = 'ABERTO';
end;
$$;

create or replace function public.atualizar_valor_parcela(_parcela_id uuid, _novo_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Atualiza apenas se a parcela estiver em ABERTO
  update public.desafio_parcelas
  set valor = _novo_valor
  where id = _parcela_id
    and status = 'ABERTO';
    
  if not found then
    raise exception 'Apenas parcelas em aberto podem ser alteradas.';
  end if;
end;
$$;

-- Permissões para que as funções possam ser chamadas pela API
grant execute on function public.atualizar_valor_participante(uuid, numeric) to authenticated;
grant execute on function public.atualizar_valor_participante(uuid, numeric) to service_role;

grant execute on function public.atualizar_valor_parcela(uuid, numeric) to authenticated;
grant execute on function public.atualizar_valor_parcela(uuid, numeric) to service_role;
