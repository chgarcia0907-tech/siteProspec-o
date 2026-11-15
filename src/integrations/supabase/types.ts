export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      admin_attempts: {
        Row: {
          failures: number;
          locked_until: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          failures?: number;
          locked_until?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          failures?: number;
          locked_until?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          created_at: string;
          gender: string;
          id: string;
          name: string;
          period_id: string | null;
          sector_id: string;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          gender?: string;
          id?: string;
          name: string;
          period_id?: string | null;
          sector_id: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          gender?: string;
          id?: string;
          name?: string;
          period_id?: string | null;
          sector_id?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      competition_settings: {
        Row: {
          end_date: string | null;
          id: number;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          end_date?: string | null;
          id?: number;
          start_date?: string;
          updated_at?: string;
        };
        Update: {
          end_date?: string | null;
          id?: number;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          aprovacao_em: string | null;
          aprovacao_registrado_em: string | null;
          at_marcada_em: string | null;
          at_registrado_em: string | null;
          company: string;
          company_gender: string;
          company_id: string | null;
          connected_at: string | null;
          created_at: string;
          headline: string;
          id: string;
          job_title: string;
          lead_em: string | null;
          lead_registrado_em: string | null;
          name: string;
          period_id: string | null;
          phone: string;
          proposta_em: string | null;
          proposta_registrado_em: string | null;
          sector: string;
          sent1_at: string | null;
          sent2_at: string | null;
          sent3_at: string | null;
          sent4_at: string | null;
          sent5_at: string | null;
          status: string;
          step1_date: string | null;
          updated_at: string;
          user_id: string;
          vendido_em: string | null;
          vendido_registrado_em: string | null;
        };
        Insert: {
          aprovacao_em?: string | null;
          aprovacao_registrado_em?: string | null;
          at_marcada_em?: string | null;
          at_registrado_em?: string | null;
          company?: string;
          company_gender?: string;
          company_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          headline?: string;
          id?: string;
          job_title?: string;
          lead_em?: string | null;
          lead_registrado_em?: string | null;
          name: string;
          period_id?: string | null;
          phone?: string;
          proposta_em?: string | null;
          proposta_registrado_em?: string | null;
          sector?: string;
          sent1_at?: string | null;
          sent2_at?: string | null;
          sent3_at?: string | null;
          sent4_at?: string | null;
          sent5_at?: string | null;
          status?: string;
          step1_date?: string | null;
          updated_at?: string;
          user_id: string;
          vendido_em?: string | null;
          vendido_registrado_em?: string | null;
        };
        Update: {
          aprovacao_em?: string | null;
          aprovacao_registrado_em?: string | null;
          at_marcada_em?: string | null;
          at_registrado_em?: string | null;
          company?: string;
          company_gender?: string;
          company_id?: string | null;
          connected_at?: string | null;
          created_at?: string;
          headline?: string;
          id?: string;
          job_title?: string;
          lead_em?: string | null;
          lead_registrado_em?: string | null;
          name?: string;
          period_id?: string | null;
          phone?: string;
          proposta_em?: string | null;
          proposta_registrado_em?: string | null;
          sector?: string;
          sent1_at?: string | null;
          sent2_at?: string | null;
          sent3_at?: string | null;
          sent4_at?: string | null;
          sent5_at?: string | null;
          status?: string;
          step1_date?: string | null;
          updated_at?: string;
          user_id?: string;
          vendido_em?: string | null;
          vendido_registrado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          period_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          period_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          period_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          date: string;
          name: string;
        };
        Insert: {
          date: string;
          name?: string;
        };
        Update: {
          date?: string;
          name?: string;
        };
        Relationships: [];
      };
      message_templates: {
        Row: {
          body: string;
          code: string;
          step: number;
          updated_at: string;
        };
        Insert: {
          body: string;
          code: string;
          step: number;
          updated_at?: string;
        };
        Update: {
          body?: string;
          code?: string;
          step?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      period_members: {
        Row: {
          group_id: string | null;
          id: string;
          joined_at: string;
          period_id: string;
          subgroup_id: string | null;
          user_id: string;
        };
        Insert: {
          group_id?: string | null;
          id?: string;
          joined_at?: string;
          period_id: string;
          subgroup_id?: string | null;
          user_id: string;
        };
        Update: {
          group_id?: string | null;
          id?: string;
          joined_at?: string;
          period_id?: string;
          subgroup_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "period_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "period_members_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "period_members_subgroup_id_fkey";
            columns: ["subgroup_id"];
            isOneToOne: false;
            referencedRelation: "subgroups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "period_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      period_snapshots: {
        Row: {
          aprovacoes_count: number;
          ats_count: number;
          contacts_count: number;
          extra: Json;
          first_at_bonus: boolean;
          frozen_at: string;
          group_name: string;
          hunter_id: string;
          hunter_name: string;
          id: string;
          leads_count: number;
          period_id: string;
          points: number;
          propostas_count: number;
          sent1: number;
          sent2: number;
          sent3: number;
          sent4: number;
          sent5: number;
          subgroup_name: string;
          vendas_count: number;
          weekly_wins: number;
        };
        Insert: {
          aprovacoes_count?: number;
          ats_count?: number;
          contacts_count?: number;
          extra?: Json;
          first_at_bonus?: boolean;
          frozen_at?: string;
          group_name?: string;
          hunter_id: string;
          hunter_name?: string;
          id?: string;
          leads_count?: number;
          period_id: string;
          points?: number;
          propostas_count?: number;
          sent1?: number;
          sent2?: number;
          sent3?: number;
          sent4?: number;
          sent5?: number;
          subgroup_name?: string;
          vendas_count?: number;
          weekly_wins?: number;
        };
        Update: {
          aprovacoes_count?: number;
          ats_count?: number;
          contacts_count?: number;
          extra?: Json;
          first_at_bonus?: boolean;
          frozen_at?: string;
          group_name?: string;
          hunter_id?: string;
          hunter_name?: string;
          id?: string;
          leads_count?: number;
          period_id?: string;
          points?: number;
          propostas_count?: number;
          sent1?: number;
          sent2?: number;
          sent3?: number;
          sent4?: number;
          sent5?: number;
          subgroup_name?: string;
          vendas_count?: number;
          weekly_wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "period_snapshots_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
        ];
      };
      periods: {
        Row: {
          closed_at: string | null;
          created_at: string;
          id: string;
          name: string;
          kind: string;
          started_at: string;
          status: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          name: string;
          started_at?: string;
          status?: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          gender: string;
          id: string;
          message_name: string | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          gender?: string;
          id: string;
          message_name?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          gender?: string;
          id?: string;
          message_name?: string | null;
        };
        Relationships: [];
      };
      sector_templates: {
        Row: {
          body: string;
          code: string;
          sector_id: string;
          step: number;
          updated_at: string;
        };
        Insert: {
          body?: string;
          code?: string;
          sector_id: string;
          step: number;
          updated_at?: string;
        };
        Update: {
          body?: string;
          code?: string;
          sector_id?: string;
          step?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sector_templates_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      sectors: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          sort: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          sort?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          offset1: number;
          offset2: number;
          offset3: number;
          offset4: number;
          offset5: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          offset1?: number;
          offset2?: number;
          offset3?: number;
          offset4?: number;
          offset5?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          offset1?: number;
          offset2?: number;
          offset3?: number;
          offset4?: number;
          offset5?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subgroups: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subgroups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_log: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          rows_count: number;
          success: boolean;
          trigger: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message?: string;
          rows_count?: number;
          success: boolean;
          trigger?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          rows_count?: number;
          success?: boolean;
          trigger?: string;
        };
        Relationships: [];
      };
      sync_settings: {
        Row: {
          created_at: string;
          id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          token: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          token?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          body: string;
          id: string;
          step: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          id?: string;
          step: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          id?: string;
          step?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      ranking: {
        Args: { period_start: string };
        Returns: {
          concluidas: number;
          enviadas1: number;
          enviadas2: number;
          enviadas3: number;
          enviadas4: number;
          enviadas5: number;
          hunter_id: string;
          hunter_name: string;
          importados: number;
          respostas: number;
        }[];
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
