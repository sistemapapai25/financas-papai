-- Template editavel do resumo diario de contas a pagar enviado ao grupo do WhatsApp.
-- Editavel na tela "Configuracao de Mensagens".
-- Variaveis suportadas: {data} {lista} {total} {qtd} {qtd_hoje} {qtd_atrasadas}
insert into configuracao_mensagens (tipo, titulo, template_mensagem)
values
  (
    'CONTAS_PAGAR_GRUPO_DIARIO',
    'Resumo diario de Contas a Pagar (grupo)',
    E'📋 *Contas a pagar de hoje ({data})*\n\n{lista}\n\n💰 Total: {total} ({qtd} conta(s))\n\n_Inclui contas que vencem hoje e atrasadas em aberto._'
  )
on conflict (tipo) do nothing;
