export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: Database["public"]["Enums"]["acao_auditoria"]
          antes: Json | null
          depois: Json | null
          entidade: string
          entidade_id: string
          id: string
          motivo: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["acao_auditoria"]
          antes?: Json | null
          depois?: Json | null
          entidade?: string
          entidade_id: string
          id?: string
          motivo?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_auditoria"]
          antes?: Json | null
          depois?: Json | null
          entidade?: string
          entidade_id?: string
          id?: string
          motivo?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          documento: string | null
          email: string | null
          id: string
          name: string
          observacoes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          name: string
          observacoes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          name?: string
          observacoes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          attachment_path: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          ordem: number
          parent_id: string | null
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          ordem?: number
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          ordem?: number
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      church_settings: {
        Row: {
          assinatura_path: string | null
          created_at: string | null
          igreja_cnpj: string
          igreja_nome: string
          responsavel_cpf: string
          responsavel_nome: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assinatura_path?: string | null
          created_at?: string | null
          igreja_cnpj: string
          igreja_nome: string
          responsavel_cpf: string
          responsavel_nome: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assinatura_path?: string | null
          created_at?: string | null
          igreja_cnpj?: string
          igreja_nome?: string
          responsavel_cpf?: string
          responsavel_nome?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      classification_rules: {
        Row: {
          beneficiary_id: string | null
          category_id: string | null
          created_at: string | null
          id: string
          term: string
          user_id: string
        }
        Insert: {
          beneficiary_id?: string | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          term: string
          user_id: string
        }
        Update: {
          beneficiary_id?: string | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_financeiras: {
        Row: {
          agencia: string | null
          created_at: string
          id: string
          instituicao: string | null
          logo: string | null
          nome: string
          numero: string | null
          saldo_inicial: number
          saldo_inicial_em: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          created_at?: string
          id?: string
          instituicao?: string | null
          logo?: string | null
          nome: string
          numero?: string | null
          saldo_inicial?: number
          saldo_inicial_em?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          created_at?: string
          id?: string
          instituicao?: string | null
          logo?: string | null
          nome?: string
          numero?: string | null
          saldo_inicial?: number
          saldo_inicial_em?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      cultos: {
        Row: {
          adultos: number
          created_at: string
          criancas: number
          data: string
          id: string
          pregador: string | null
          tipo_id: string | null
          user_id: string
        }
        Insert: {
          adultos?: number
          created_at?: string
          criancas?: number
          data: string
          id?: string
          pregador?: string | null
          tipo_id?: string | null
          user_id: string
        }
        Update: {
          adultos?: number
          created_at?: string
          criancas?: number
          data?: string
          id?: string
          pregador?: string | null
          tipo_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_culto"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_parcelas: {
        Row: {
          competencia: string
          created_at: string
          id: string
          pago_em: string | null
          pago_obs: string | null
          pago_valor: number | null
          participante_id: string
          status: string
          valor: number
          vencimento: string
        }
        Insert: {
          competencia: string
          created_at?: string
          id?: string
          pago_em?: string | null
          pago_obs?: string | null
          pago_valor?: number | null
          participante_id: string
          status?: string
          valor: number
          vencimento: string
        }
        Update: {
          competencia?: string
          created_at?: string
          id?: string
          pago_em?: string | null
          pago_obs?: string | null
          pago_valor?: number | null
          participante_id?: string
          status?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_parcelas_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "desafio_participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_participantes: {
        Row: {
          created_at: string
          desafio_id: string
          id: string
          participant_user_id: string | null
          pessoa_id: string
          status: string
          token_expires_at: string | null
          token_link: string
        }
        Insert: {
          created_at?: string
          desafio_id: string
          id?: string
          participant_user_id?: string | null
          pessoa_id: string
          status?: string
          token_expires_at?: string | null
          token_link?: string
        }
        Update: {
          created_at?: string
          desafio_id?: string
          id?: string
          participant_user_id?: string | null
          pessoa_id?: string
          status?: string
          token_expires_at?: string | null
          token_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_participantes_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_participantes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      desafios: {
        Row: {
          ativo: boolean
          created_at: string
          data_inicio: string
          descricao: string | null
          dia_vencimento: number
          id: string
          lembrete_dias_antes: number[]
          qtd_parcelas: number
          titulo: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_inicio: string
          descricao?: string | null
          dia_vencimento?: number
          id?: string
          lembrete_dias_antes?: number[]
          qtd_parcelas?: number
          titulo: string
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_inicio?: string
          descricao?: string | null
          dia_vencimento?: number
          id?: string
          lembrete_dias_antes?: number[]
          qtd_parcelas?: number
          titulo?: string
          valor_mensal?: number
        }
        Relationships: []
      }
      dizimos: {
        Row: {
          created_at: string
          culto_id: string
          id: string
          importado: boolean
          nome: string
          valor: number
        }
        Insert: {
          created_at?: string
          culto_id: string
          id?: string
          importado?: boolean
          nome: string
          valor: number
        }
        Update: {
          created_at?: string
          culto_id?: string
          id?: string
          importado?: boolean
          nome?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "dizimos_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dizimos_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_culto_totais"
            referencedColumns: ["culto_id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          beneficiario_id: string | null
          boleto_url: string | null
          categoria_id: string
          comprovante_url: string | null
          conta_id: string | null
          created_at: string | null
          data_pagamento: string | null
          deleted_at: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          recibo_ano: number | null
          recibo_gerado_em: string | null
          recibo_numero: number | null
          recibo_pdf_path: string | null
          status: Database["public"]["Enums"]["status_lancamento"] | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string | null
          user_id: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          beneficiario_id?: string | null
          boleto_url?: string | null
          categoria_id: string
          comprovante_url?: string | null
          conta_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          recibo_ano?: number | null
          recibo_gerado_em?: string | null
          recibo_numero?: number | null
          recibo_pdf_path?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"] | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          user_id: string
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          beneficiario_id?: string | null
          boleto_url?: string | null
          categoria_id?: string
          comprovante_url?: string | null
          conta_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          recibo_ano?: number | null
          recibo_gerado_em?: string | null
          recibo_numero?: number | null
          recibo_pdf_path?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"] | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          user_id?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_financeiros: {
        Row: {
          beneficiario_id: string | null
          categoria_id: string | null
          comprovante_url: string | null
          conta_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string | null
          ref_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          beneficiario_id?: string | null
          categoria_id?: string | null
          comprovante_url?: string | null
          conta_id: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string | null
          ref_id?: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          beneficiario_id?: string | null
          categoria_id?: string | null
          comprovante_url?: string | null
          conta_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string | null
          ref_id?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      ofertas: {
        Row: {
          created_at: string
          culto_id: string
          id: string
          importado: boolean
          valor: number
          valor_dinheiro: number
          valor_moedas: number
        }
        Insert: {
          created_at?: string
          culto_id: string
          id?: string
          importado?: boolean
          valor: number
          valor_dinheiro?: number
          valor_moedas?: number
        }
        Update: {
          created_at?: string
          culto_id?: string
          id?: string
          importado?: boolean
          valor?: number
          valor_dinheiro?: number
          valor_moedas?: number
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_culto_totais"
            referencedColumns: ["culto_id"]
          },
        ]
      }
      pessoas: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean | null
          auth_user_id: string | null
          created_at: string | null
          email: string
          name: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      recibos_sequencia: {
        Row: {
          ano: number
          ultimo_numero: number
          user_id: string
        }
        Insert: {
          ano: number
          ultimo_numero?: number
          user_id: string
        }
        Update: {
          ano?: number
          ultimo_numero?: number
          user_id?: string
        }
        Relationships: []
      }
      saldos_mensais: {
        Row: {
          conta_id: string
          id: string
          mes: string
          saldo_inicial: number
          user_id: string
        }
        Insert: {
          conta_id: string
          id?: string
          mes: string
          saldo_inicial?: number
          user_id: string
        }
        Update: {
          conta_id?: string
          id?: string
          mes?: string
          saldo_inicial?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saldos_mensais_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_culto: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          user_id: string
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: string
          user_id: string
          valor: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_conciliacao: {
        Row: {
          conta_id: string | null
          data_real: string | null
          lancamento_descricao: string | null
          lancamento_id: string | null
          lancamento_tipo: Database["public"]["Enums"]["tipo_lancamento"] | null
          movimento_descricao: string | null
          movimento_id: string | null
          movimento_tipo: string | null
          status: Database["public"]["Enums"]["status_lancamento"] | null
          user_id: string | null
          valor_previsto: number | null
          valor_real: number | null
          vencimento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_culto_totais: {
        Row: {
          culto_id: string | null
          total_dizimos: number | null
          total_ofertas: number | null
        }
        Relationships: []
      }
      vw_lancamentos_whatsapp: {
        Row: {
          beneficiario_id: string | null
          descricao: string | null
          id: string | null
          nomebenef: string | null
          status: Database["public"]["Enums"]["status_lancamento"] | null
          user_id: string | null
          valor: number | null
          vencimento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ensure_default_categories: { Args: never; Returns: undefined }
      gerar_carne_para_participante: {
        Args: { _participante_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      next_recibo_num: {
        Args: { _ano: number; _user_id: string }
        Returns: number
      }
      registrar_transferencia: {
        Args: {
          _data: string
          _descricao: string
          _valor: number
          destino: string
          origem: string
        }
        Returns: string
      }
    }
    Enums: {
      acao_auditoria: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE"
      app_role: "ADMIN" | "USER"
      forma_pagamento:
        | "PIX"
        | "DINHEIRO"
        | "CARTAO"
        | "BOLETO"
        | "TRANSFERENCIA"
        | "OUTRO"
      status_lancamento: "EM_ABERTO" | "PAGO" | "CANCELADO"
      tipo_categoria: "DESPESA" | "RECEITA" | "TRANSFERENCIA"
      tipo_lancamento: "DESPESA" | "RECEITA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_auditoria: ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"],
      app_role: ["ADMIN", "USER"],
      forma_pagamento: [
        "PIX",
        "DINHEIRO",
        "CARTAO",
        "BOLETO",
        "TRANSFERENCIA",
        "OUTRO",
      ],
      status_lancamento: ["EM_ABERTO", "PAGO", "CANCELADO"],
      tipo_categoria: ["DESPESA", "RECEITA", "TRANSFERENCIA"],
      tipo_lancamento: ["DESPESA", "RECEITA"],
    },
  },
} as const
