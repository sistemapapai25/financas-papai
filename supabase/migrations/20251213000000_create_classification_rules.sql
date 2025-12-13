-- Create classification_rules table for transaction standardization
create table if not exists classification_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  term text not null,
  category_id uuid references categories(id),
  beneficiary_id uuid references beneficiaries(id),
  created_at timestamptz default now()
);

-- Enable RLS
alter table classification_rules enable row level security;

-- Policy: Users can manage their own rules
create policy "Users can manage their own rules" 
  on classification_rules 
  for all 
  using (auth.uid() = user_id);

-- Add index for faster lookups
create index if not exists idx_classification_rules_user_id 
  on classification_rules(user_id);
