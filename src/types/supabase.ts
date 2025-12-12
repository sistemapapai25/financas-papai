// src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ======== ESQUEMA TYPED DO SUPABASE ======== //
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      // ========== EXISTENTES ==========
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
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          user_id?: string
        }
        Relationships: []
      }

      // ========= NOVAS TABELAS FINANCEIRAS =========
      contas_financeiras: {
        Row: {
          id: string
          user_id: string
          tipo: "CAIXA" | "BANCO"
          nome: string
          instituicao: string | null
          agencia: string | null
          numero: string | null
          saldo_inicial: number
          logo: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tipo: "CAIXA" | "BANCO"
          nome: string
          instituicao?: string | null
          agencia?: string | null
          numero?: string | null
          saldo_inicial?: number
          logo?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tipo?: "CAIXA" | "BANCO"
          nome?: string
          instituicao?: string | null
          agencia?: string | null
          numero?: string | null
          saldo_inicial?: number
          logo?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

      movimentos_financeiros: {
        Row: {
          id: string
          user_id: string
          conta_id: string
          data: string        // 'YYYY-MM-DD'
          tipo: "ENTRADA" | "SAIDA"
          valor: number
          descricao: string | null
          origem: "CULTO" | "LANCAMENTO" | "AJUSTE" | "EXTRATO" | null
          ref_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          conta_id: string
          data: string
          tipo: "ENTRADA" | "SAIDA"
          valor: number
          descricao?: string | null
          origem?: "CULTO" | "LANCAMENTO" | "AJUSTE" | "EXTRATO" | null
          ref_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          conta_id?: string
          data?: string
          tipo?: "ENTRADA" | "SAIDA"
          valor?: number
          descricao?: string | null
          origem?: "CULTO" | "LANCAMENTO" | "AJUSTE" | null
          ref_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          }
        ]
      }
      // ========= FIM NOVAS TABELAS FINANCEIRAS =========

      // ========= LANCAMENTOS (com conta_id opcional) =========
      lancamentos: {
        Row: {
          beneficiario_id: string | null
          boleto_url: string | null
          categoria_id: string
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          deleted_at: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_lancamento"] | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string | null
          user_id: string
          valor: number
          valor_pago: number | null
          vencimento: string
          conta_id: string | null
        }
        Insert: {
          beneficiario_id?: string | null
          boleto_url?: string | null
          categoria_id: string
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"] | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          user_id: string
          valor: number
          valor_pago?: number | null
          vencimento: string
          conta_id?: string | null
        }
        Update: {
          beneficiario_id?: string | null
          boleto_url?: string | null
          categoria_id?: string
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"] | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          user_id?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
          conta_id?: string | null
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
          }
        ]
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

      // ======== NOVAS TABELAS DE CULTO ========

      tipos_culto: {
        Row: {
          id: string
          nome: string
          ativo: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }

      cultos: {
        Row: {
          id: string
          data: string          // date
          tipo_id: string | null
          pregador: string | null
          adultos: number
          criancas: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          data: string
          tipo_id?: string | null
          pregador?: string | null
          adultos?: number
          criancas?: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          data?: string
          tipo_id?: string | null
          pregador?: string | null
          adultos?: number
          criancas?: number
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_culto"
            referencedColumns: ["id"]
          }
        ]
      }

      dizimos: {
        Row: {
          id: string
          culto_id: string
          nome: string
          valor: number
          created_at: string
        }
        Insert: {
          id?: string
          culto_id: string
          nome: string
          valor: number
          created_at?: string
        }
        Update: {
          id?: string
          culto_id?: string
          nome?: string
          valor?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dizimos_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          }
        ]
      }

      ofertas: {
        Row: {
          id: string
          culto_id: string
          valor: number
          valor_dinheiro: number
          valor_moedas: number
          created_at: string
        }
        Insert: {
          id?: string
          culto_id: string
          valor: number
          valor_dinheiro?: number
          valor_moedas?: number
          created_at?: string
        }
        Update: {
          id?: string
          culto_id?: string
          valor?: number
          valor_dinheiro?: number
          valor_moedas?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          }
        ]
      }
      // ======== FIM TABELAS DE CULTO ========
    }

    Views: {
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
          }
        ]
      }
    }

    Functions: {
      atualizar_saldo_conta: {
        Args: { conta_id: string; valor: number }
        Returns: undefined
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }

    Enums: {
      acao_auditoria: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE"
      app_role: "ADMIN" | "USER"
      forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO" | "TRANSFERENCIA" | "OUTRO"
      status_lancamento: "EM_ABERTO" | "PAGO" | "CANCELADO"
      tipo_categoria: "DESPESA" | "RECEITA"
      tipo_lancamento: "DESPESA" | "RECEITA"
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ======== HELPERS GERADOS (Tables, TablesInsert, etc.) ======== //
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
        ? R
        : never
      : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I }
      ? I
      : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
        ? I
        : never
      : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> =
  DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U }
      ? U
      : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
        ? U
        : never
      : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> =
  DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> =
  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
  public: {
    Enums: {
      acao_auditoria: ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"],
      app_role: ["ADMIN", "USER"],
      forma_pagamento: ["PIX","DINHEIRO","CARTAO","BOLETO","TRANSFERENCIA","OUTRO"],
      status_lancamento: ["EM_ABERTO","PAGO","CANCELADO"],
      tipo_categoria: ["DESPESA","RECEITA"],
      tipo_lancamento: ["DESPESA","RECEITA"],
    },
  },
} as const
