export type TipoLancamento = 'DESPESA' | 'RECEITA';
export type StatusLancamento = 'EM_ABERTO' | 'PAGO' | 'CANCELADO';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO' | 'BOLETO' | 'TRANSFERENCIA' | 'OUTRO';
export type TipoCategoria = 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA';
export type AppRole = 'ADMIN' | 'USER';

/** ✅ Tipos de Culto (tabela public.tipos_culto) */
export interface TipoCulto {
  id: string;
  nome: string;
  ativo: boolean;      // default true no banco
  ordem: number;       // default 0 no banco
  created_at: string;
}

export interface Beneficiario {
  id: string;
  name: string;
  phone?: string;
  documento?: string;
  user_id: string;
  created_at: string;
  deleted_at?: string;
}

export interface Categoria {
  id: string;
  name: string;
  tipo: TipoCategoria;
  user_id: string;
  created_at: string;
  deleted_at?: string;
  parent_id?: string | null;
  ordem?: number;
}

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  beneficiario_id?: string;
  categoria_id: string;
  descricao?: string;
  valor: number;
  forma_pagamento?: FormaPagamento;
  vencimento: string;
  status: StatusLancamento;
  data_pagamento?: string;
  valor_pago?: number;
  observacoes?: string;
  boleto_url?: string;
  comprovante_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  beneficiario?: Beneficiario;
  categoria?: Categoria;
}

export interface Profile {
  auth_user_id?: string;
  email: string;
  name?: string;
  phone?: string;
  role?: AppRole;
  active?: boolean;
  created_at?: string;
}

export interface DashboardData {
  totalEmAberto: number;
  totalPagoMes: number;
  proximosVencimentos: Lancamento[];
  receitasMes: number;
}

export interface ContaFinanceira {
  id: string;
  user_id: string;
  tipo: 'CAIXA' | 'BANCO';
  nome: string;
  instituicao?: string | null;
  agencia?: string | null;
  numero?: string | null;
  saldo_inicial: number;
  logo?: string | null;
  created_at: string;
}

export interface MovimentoFinanceiro {
  id: string;
  user_id: string;
  conta_id: string;
  data: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: number;
  descricao?: string | null;
  origem: 'LANCAMENTO' | 'CULTO' | 'AJUSTE' | 'EXTRATO';
  ref_id?: string | null;
  comprovante_url?: string | null;
  created_at: string;
}
