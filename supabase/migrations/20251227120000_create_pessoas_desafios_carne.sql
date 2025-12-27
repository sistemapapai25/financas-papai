create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  telefone text,
  email text,
  ativo boolean not null default true,
  auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_pessoas_auth_user_id on public.pessoas(auth_user_id);
create index if not exists idx_pessoas_nome on public.pessoas(nome);

create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titulo text not null,
  descricao text,
  valor_mensal numeric(12,2) not null default 50,
  qtd_parcelas int not null default 12,
  data_inicio date not null,
  dia_vencimento int not null default 10,
  ativo boolean not null default true,
  constraint desafios_dia_vencimento_check check (dia_vencimento >= 1 and dia_vencimento <= 31),
  constraint desafios_qtd_parcelas_check check (qtd_parcelas >= 1 and qtd_parcelas <= 240),
  constraint desafios_valor_mensal_check check (valor_mensal > 0)
);

create index if not exists idx_desafios_ativo on public.desafios(ativo);
create index if not exists idx_desafios_titulo on public.desafios(titulo);

create table if not exists public.desafio_participantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  desafio_id uuid not null references public.desafios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete restrict,
  participant_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  token_link uuid not null default gen_random_uuid(),
  token_expires_at timestamptz,
  constraint desafio_participantes_unique unique (desafio_id, pessoa_id)
);

create index if not exists idx_desafio_participantes_desafio_id on public.desafio_participantes(desafio_id);
create index if not exists idx_desafio_participantes_pessoa_id on public.desafio_participantes(pessoa_id);
create index if not exists idx_desafio_participantes_participant_user_id on public.desafio_participantes(participant_user_id);
create unique index if not exists idx_desafio_participantes_token_link on public.desafio_participantes(token_link);

create table if not exists public.desafio_parcelas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  participante_id uuid not null references public.desafio_participantes(id) on delete cascade,
  competencia date not null,
  vencimento date not null,
  valor numeric(12,2) not null,
  status text not null default 'ABERTO' check (status in ('ABERTO', 'PAGO', 'CANCELADO')),
  pago_em timestamptz,
  pago_valor numeric(12,2),
  pago_obs text,
  constraint desafio_parcelas_unique unique (participante_id, competencia),
  constraint desafio_parcelas_valor_check check (valor > 0)
);

create index if not exists idx_desafio_parcelas_participante_id on public.desafio_parcelas(participante_id);
create index if not exists idx_desafio_parcelas_vencimento on public.desafio_parcelas(vencimento);
create index if not exists idx_desafio_parcelas_status on public.desafio_parcelas(status);

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
begin
  select * into v_part from public.desafio_participantes where id = _participante_id;
  if not found then
    raise exception 'participante não encontrado: %', _participante_id;
  end if;

  select * into v_desafio from public.desafios where id = v_part.desafio_id;
  if not found then
    raise exception 'desafio não encontrado: %', v_part.desafio_id;
  end if;

  for v_i in 0..(v_desafio.qtd_parcelas - 1) loop
    v_comp := (date_trunc('month', v_desafio.data_inicio)::date + make_interval(months => v_i))::date;
    v_last_day := extract(day from (date_trunc('month', v_comp)::date + interval '1 month - 1 day'))::int;
    v_venc := make_date(
      extract(year from v_comp)::int,
      extract(month from v_comp)::int,
      least(v_desafio.dia_vencimento, v_last_day)
    );

    insert into public.desafio_parcelas (participante_id, competencia, vencimento, valor, status)
    values (_participante_id, v_comp, v_venc, v_desafio.valor_mensal, 'ABERTO')
    on conflict (participante_id, competencia) do nothing;
  end loop;
end;
$$;

create or replace function public.trg_gerar_carne_participante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.gerar_carne_para_participante(new.id);
  return new;
end;
$$;

drop trigger if exists on_desafio_participante_created on public.desafio_participantes;
create trigger on_desafio_participante_created
after insert on public.desafio_participantes
for each row execute procedure public.trg_gerar_carne_participante();

alter table public.pessoas enable row level security;
alter table public.desafios enable row level security;
alter table public.desafio_participantes enable row level security;
alter table public.desafio_parcelas enable row level security;

drop policy if exists "pessoas_select_admin_or_own" on public.pessoas;
create policy "pessoas_select_admin_or_own"
on public.pessoas
for select
to authenticated
using (public.is_admin() or auth.uid() = auth_user_id);

drop policy if exists "pessoas_insert_admin" on public.pessoas;
create policy "pessoas_insert_admin"
on public.pessoas
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "pessoas_update_admin" on public.pessoas;
create policy "pessoas_update_admin"
on public.pessoas
for update
to authenticated
using (public.is_admin());

drop policy if exists "pessoas_delete_admin" on public.pessoas;
create policy "pessoas_delete_admin"
on public.pessoas
for delete
to authenticated
using (public.is_admin());

drop policy if exists "desafios_select_admin_or_participant" on public.desafios;
create policy "desafios_select_admin_or_participant"
on public.desafios
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.desafio_participantes dp
    where dp.desafio_id = desafios.id
      and dp.participant_user_id = auth.uid()
  )
);

drop policy if exists "desafios_insert_admin" on public.desafios;
create policy "desafios_insert_admin"
on public.desafios
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "desafios_update_admin" on public.desafios;
create policy "desafios_update_admin"
on public.desafios
for update
to authenticated
using (public.is_admin());

drop policy if exists "desafios_delete_admin" on public.desafios;
create policy "desafios_delete_admin"
on public.desafios
for delete
to authenticated
using (public.is_admin());

drop policy if exists "desafio_participantes_select_admin_or_own" on public.desafio_participantes;
create policy "desafio_participantes_select_admin_or_own"
on public.desafio_participantes
for select
to authenticated
using (public.is_admin() or participant_user_id = auth.uid());

drop policy if exists "desafio_participantes_insert_admin" on public.desafio_participantes;
create policy "desafio_participantes_insert_admin"
on public.desafio_participantes
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "desafio_participantes_update_admin" on public.desafio_participantes;
create policy "desafio_participantes_update_admin"
on public.desafio_participantes
for update
to authenticated
using (public.is_admin());

drop policy if exists "desafio_participantes_delete_admin" on public.desafio_participantes;
create policy "desafio_participantes_delete_admin"
on public.desafio_participantes
for delete
to authenticated
using (public.is_admin());

drop policy if exists "desafio_parcelas_select_admin_or_own" on public.desafio_parcelas;
create policy "desafio_parcelas_select_admin_or_own"
on public.desafio_parcelas
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.desafio_participantes dp
    where dp.id = desafio_parcelas.participante_id
      and dp.participant_user_id = auth.uid()
  )
);

drop policy if exists "desafio_parcelas_insert_admin" on public.desafio_parcelas;
create policy "desafio_parcelas_insert_admin"
on public.desafio_parcelas
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "desafio_parcelas_update_admin" on public.desafio_parcelas;
create policy "desafio_parcelas_update_admin"
on public.desafio_parcelas
for update
to authenticated
using (public.is_admin());

drop policy if exists "desafio_parcelas_delete_admin" on public.desafio_parcelas;
create policy "desafio_parcelas_delete_admin"
on public.desafio_parcelas
for delete
to authenticated
using (public.is_admin());

