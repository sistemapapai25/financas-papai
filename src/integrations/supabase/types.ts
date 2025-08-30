// src/integrations/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13.0.4" };
  public: {
    Tables: {
      auditoria: {
        Row: {
          id: string;
          user_id: string;
          acao: Database["public"]["Enums"]["acao_auditoria"];
          entidade: string;
          entidade_id: string;
          motivo: string | null;
          antes: Json | null;
          depois: Json | null;
          timestamp: string | null; // timestamptz
        };
        Insert: {
          id?: string;
          user_id: string;
          acao: Database["public"]["Enums"]["acao_auditoria"];
          entidade?: string;
          entidade_id: string;
          motivo?: string | null;
          antes?: Json | null;
          depois?: Json | null;
          timestamp?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["auditoria"]["Insert"]>;
        Relationships: [];
      };

      beneficiaries: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          documento: string | null;
          phone: string | null;
          email: string | null;
          observacoes: string | null;
          created_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          documento?: string | null;
          phone?: string | null;
          email?: string | null;
          observacoes?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["beneficiaries"]["Insert"]>;
        Relationships: [];
      };

      bills: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          status: string;
          due_date: string; // date
          description: string | null;
          attachment_path: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          status?: string;
          due_date: string;
          description?: string | null;
          attachment_path?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bills"]["Insert"]>;
        Relationships: [];
      };

      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          created_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          tipo?: Database["public"]["Enums"]["tipo_categoria"];
          created_at?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };

      // ---------- NOVAS TABELAS DE CONTAS E MOVIMENTOS ----------
      contas_financeiras: {
        Row: {
          id: string;
          user_id: string;
          tipo: "CAIXA" | "BANCO";
          nome: string;
          instituicao: string | null;
          agencia: string | null;
          numero: string | null;
          saldo_inicial: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tipo: "CAIXA" | "BANCO";
          nome: string;
          instituicao?: string | null;
          agencia?: string | null;
          numero?: string | null;
          saldo_inicial?: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["contas_financeiras"]["Insert"]>;
        Relationships: [];
      };

      movimentos_financeiros: {
        Row: {
          id: string;
          user_id: string;
          conta_id: string;
          data: string; // date
          tipo: "ENTRADA" | "SAIDA";
          valor: number;
          descricao: string | null;
          origem: "CULTO" | "LANCAMENTO" | "AJUSTE" | null;
          ref_id: string | null; // referencia ao culto/lancamento/ajuste
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          conta_id: string;
          data: string;
          tipo: "ENTRADA" | "SAIDA";
          valor: number;
          descricao?: string | null;
          origem?: "CULTO" | "LANCAMENTO" | "AJUSTE" | null;
          ref_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["movimentos_financeiros"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "contas_financeiras";
            referencedColumns: ["id"];
          }
        ];
      };
      // ---------- FIM NOVAS TABELAS ----------

      // ---------- TABELAS DE CULTOS ----------
      tipos_culto: {
        Row: {
          id: string;
          nome: string;
          ativo: boolean;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          ativo?: boolean;
          ordem?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tipos_culto"]["Insert"]>;
        Relationships: [];
      };

      cultos: {
        Row: {
          id: string;
          data: string; // date
          tipo_id: string | null;
          pregador: string | null;
          adultos: number;
          criancas: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          data: string;
          tipo_id?: string | null;
          pregador?: string | null;
          adultos?: number;
          criancas?: number;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cultos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cultos_tipo_id_fkey";
            columns: ["tipo_id"];
            isOneToOne: false;
            referencedRelation: "tipos_culto";
            referencedColumns: ["id"];
          },
        ];
      };

      dizimos: {
        Row: {
          id: string;
          culto_id: string;
          nome: string;
          valor: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          culto_id: string;
          nome: string;
          valor: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dizimos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dizimos_culto_id_fkey";
            columns: ["culto_id"];
            isOneToOne: false;
            referencedRelation: "cultos";
            referencedColumns: ["id"];
          },
        ];
      };

      ofertas: {
        Row: {
          id: string;
          culto_id: string;
          // campo antigo "valor" pode existir no seu banco; mantemos opcional
          valor: number | null;
          // novos campos
          valor_dinheiro: number;
          valor_moedas: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          culto_id: string;
          valor?: number | null;
          valor_dinheiro?: number;
          valor_moedas?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ofertas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ofertas_culto_id_fkey";
            columns: ["culto_id"];
            isOneToOne: false;
            referencedRelation: "cultos";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------- FIM CULTOS ----------

      lancamentos: {
        Row: {
          id: string;
          user_id: string;
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          beneficiario_id: string | null;
          categoria_id: string;
          descricao: string | null;
          valor: number;
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null;
          vencimento: string; // date
          status: Database["public"]["Enums"]["status_lancamento"] | null;
          data_pagamento: string | null; // date
          valor_pago: number | null;
          observacoes: string | null;
          boleto_url: string | null;
          comprovante_url: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
          // novo relacionamento para conciliação
          conta_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          beneficiario_id?: string | null;
          categoria_id: string;
          descricao?: string | null;
          valor: number;
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"] | null;
          vencimento: string;
          status?: Database["public"]["Enums"]["status_lancamento"] | null;
          data_pagamento?: string | null;
          valor_pago?: number | null;
          observacoes?: string | null;
          boleto_url?: string | null;
          comprovante_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          conta_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "beneficiaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "contas_financeiras";
            referencedColumns: ["id"];
          },
        ];
      };

      profiles: {
        Row: {
          auth_user_id: string | null;
          email: string;
          name: string | null;
          phone: string | null;
          active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          auth_user_id?: string | null;
          email: string;
          name?: string | null;
          phone?: string | null;
          active?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };

      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
    };

    Views: {
      vw_lancamentos_whatsapp: {
        Row: {
          id: string | null;
          user_id: string | null;
          beneficiario_id: string | null;
          nomebenef: string | null;
          descricao: string | null;
          valor: number | null;
          vencimento: string | null;
          status: Database["public"]["Enums"]["status_lancamento"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "beneficiaries";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Functions: {
      atualizar_saldo_conta: {
        Args: { conta_id: string; valor: number };
        Returns: undefined;
      };
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };

    Enums: {
      acao_auditoria: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
      app_role: "ADMIN" | "USER";
      forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO" | "TRANSFERENCIA" | "OUTRO";
      status_lancamento: "EM_ABERTO" | "PAGO" | "CANCELADO";
      tipo_categoria: "DESPESA" | "RECEITA";
      tipo_lancamento: "DESPESA" | "RECEITA";
      // (se tiver enums no banco para CAIXA/BANCO, ENTRADA/SAIDA, etc., podemos mover para cá)
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// -------- Helpers para tipagem fácil --------
type DB = Database;
type PublicSchema = DB["public"];

export type Tables<TName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TName]["Row"];

export type TablesInsert<TName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TName]["Insert"];

export type TablesUpdate<TName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TName]["Update"];

export type Enums<TName extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][TName];

// (opcional) constantes úteis
export const Constants = {
  public: {
    Enums: {
      acao_auditoria: ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"] as const,
      app_role: ["ADMIN", "USER"] as const,
      forma_pagamento: ["PIX","DINHEIRO","CARTAO","BOLETO","TRANSFERENCIA","OUTRO"] as const,
      status_lancamento: ["EM_ABERTO","PAGO","CANCELADO"] as const,
      tipo_categoria: ["DESPESA","RECEITA"] as const,
      tipo_lancamento: ["DESPESA","RECEITA"] as const,
    },
  },
} as const;
