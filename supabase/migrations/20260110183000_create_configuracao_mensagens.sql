create table if not exists configuracao_mensagens (
  id uuid default gen_random_uuid() primary key,
  tipo text not null unique,
  titulo text not null,
  template_mensagem text not null,
  ativo boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table configuracao_mensagens enable row level security;

create policy "Mensagens visíveis para todos"
  on configuracao_mensagens for select
  using (true);

create policy "Apenas autenticados podem editar mensagens"
  on configuracao_mensagens for update
  using (auth.role() = 'authenticated');

insert into configuracao_mensagens (tipo, titulo, template_mensagem)
values
  (
    'LEMBRETE_VENCIMENTO_HOJE',
    'Lembrete de Vencimento (Hoje)',
    E'Olá {nome} 🙌\n\nLembrete: *hoje* vence sua parcela do desafio {desafio}!\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
  ),
  (
    'LEMBRETE_VENCIMENTO_AMANHA',
    'Lembrete de Vencimento (Amanhã)',
    E'Olá {nome} 🙌\n\nLembrete: *amanhã* vence sua parcela do desafio {desafio}!\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
  ),
  (
    'LEMBRETE_VENCIMENTO_DIAS',
    'Lembrete de Vencimento (Dias Antes)',
    E'Olá {nome} 🙌\n\nLembrete: faltam *{dias_restantes} dias* para vencer sua parcela do desafio {desafio}.\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
  )
on conflict (tipo) do nothing;
