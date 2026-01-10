-- Tabela para armazenar templates de mensagens
create table if not exists public.configuracao_mensagens (
    id uuid not null default gen_random_uuid(),
    tipo text not null unique, -- ex: 'LEMBRETE_VENCIMENTO_HOJE', 'LEMBRETE_VENCIMENTO_AMANHA', 'LEMBRETE_VENCIMENTO_FUTURO'
    titulo text not null, -- Nome amigável para exibir na tela
    template_mensagem text not null, -- O texto com as variáveis {nome}, {valor}, etc.
    ativo boolean not null default true,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint configuracao_mensagens_pkey primary key (id)
);

-- Habilitar RLS
alter table public.configuracao_mensagens enable row level security;

-- Políticas de acesso (apenas admin pode gerenciar, leitura pública ou autenticada conforme necessidade)
create policy "Admins podem fazer tudo em configuracao_mensagens"
    on public.configuracao_mensagens
    for all
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
    );

-- Inserir templates padrão iniciais (baseados no que já está no código)
insert into public.configuracao_mensagens (tipo, titulo, template_mensagem)
values
(
    'LEMBRETE_VENCIMENTO_HOJE',
    'Lembrete Vencimento (Hoje)',
    'Olá {nome} 🙌\n\nLembrete: *hoje* vence sua parcela do desafio {desafio}!\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
),
(
    'LEMBRETE_VENCIMENTO_AMANHA',
    'Lembrete Vencimento (Amanhã)',
    'Olá {nome} 🙌\n\nLembrete: *amanhã* vence sua parcela do desafio {desafio}!\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
),
(
    'LEMBRETE_VENCIMENTO_DIAS',
    'Lembrete Vencimento (Dias Restantes)',
    'Olá {nome} 🙌\n\nLembrete: faltam *{dias_restantes} dias* para vencer sua parcela do desafio {desafio}.\n\n💰 Valor: {valor}\n📆 Vencimento: {vencimento}\n🔑Chave Pix : 44582345000176\nEm nome de Igreja Apostólica e Profética Águas Purificadoras\nEnvie seu comprovante para a nossa secretaria através do whatsapp 62986193333\nObrigado pela sua fidelidade !\nDeus abençoe sua vida 🙌'
)
on conflict (tipo) do nothing;
