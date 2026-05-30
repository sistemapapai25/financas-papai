alter table public.classification_rules
  add column if not exists aplica_todos boolean not null default false,
  add column if not exists category_name text,
  add column if not exists beneficiary_name text;

update public.classification_rules cr
set category_name = c.name
from public.categories c
where cr.category_id = c.id
  and cr.category_name is null;

update public.classification_rules cr
set beneficiary_name = b.name
from public.beneficiaries b
where cr.beneficiary_id = b.id
  and cr.beneficiary_name is null;

create index if not exists idx_classification_rules_aplica_todos
  on public.classification_rules(aplica_todos)
  where aplica_todos = true;

drop policy if exists "Users can manage their own rules" on public.classification_rules;

create policy "Users can manage their own rules"
on public.classification_rules
for all
to authenticated
using (auth.uid() = user_id and aplica_todos = false)
with check (auth.uid() = user_id and aplica_todos = false);

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classification_rules'
      and policyname = 'classification_rules_select_global'
  ) then
    create policy "classification_rules_select_global"
    on public.classification_rules
    for select
    to authenticated
    using (aplica_todos = true);
  end if;
end $$;
