export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ab_testes: {
        Row: {
          conclusao: string | null;
          created_at: string;
          descricao: string | null;
          dimensao: string;
          id: string;
          nome: string;
          period_id: string;
          safra_final_id: string;
          safra_inicial_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          conclusao?: string | null;
          created_at?: string;
          descricao?: string | null;
          dimensao: string;
          id?: string;
          nome: string;
          period_id: string;
          safra_final_id: string;
          safra_inicial_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          conclusao?: string | null;
          created_at?: string;
          descricao?: string | null;
          dimensao?: string;
          id?: string;
          nome?: string;
          period_id?: string;
          safra_final_id?: string;
          safra_inicial_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ab_testes_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ab_testes_safra_final_id_fkey";
            columns: ["safra_final_id"];
            isOneToOne: false;
            referencedRelation: "safras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ab_testes_safra_inicial_id_fkey";
            columns: ["safra_inicial_id"];
            isOneToOne: false;
            referencedRelation: "safras";
            referencedColumns: ["id"];
          },
        ];
      };
      ab_versoes: {
        Row: {
          id: string;
          ordem: number;
          rotulo: string;
          teste_id: string;
          valores: string[];
        };
        Insert: {
          id?: string;
          ordem?: number;
          rotulo: string;
          teste_id: string;
          valores: string[];
        };
        Update: {
          id?: string;
          ordem?: number;
          rotulo?: string;
          teste_id?: string;
          valores?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "ab_versoes_teste_id_fkey";
            columns: ["teste_id"];
            isOneToOne: false;
            referencedRelation: "ab_testes";
            referencedColumns: ["id"];
          },
        ];
      };
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
      alocacoes: {
        Row: {
          created_at: string;
          created_by: string | null;
          dupla: string | null;
          id: string;
          meta_contatos: number;
          meta_empresas: number;
          motivo_meta_zero: string | null;
          safra_id: string;
          sector_id: string;
          subsector_id: string | null;
          updated_at: string;
          user_id: string;
          vigente_desde: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dupla?: string | null;
          id?: string;
          meta_contatos?: number;
          meta_empresas?: number;
          motivo_meta_zero?: string | null;
          safra_id: string;
          sector_id: string;
          subsector_id?: string | null;
          updated_at?: string;
          user_id: string;
          vigente_desde: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dupla?: string | null;
          id?: string;
          meta_contatos?: number;
          meta_empresas?: number;
          motivo_meta_zero?: string | null;
          safra_id?: string;
          sector_id?: string;
          subsector_id?: string | null;
          updated_at?: string;
          user_id?: string;
          vigente_desde?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alocacoes_safra_id_fkey";
            columns: ["safra_id"];
            isOneToOne: false;
            referencedRelation: "safras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alocacoes_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alocacoes_subsector_id_fkey";
            columns: ["subsector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      at_eventos: {
        Row: {
          at_id: string;
          autor: string | null;
          created_at: string;
          evento: string;
          horario_anterior: string | null;
          horario_novo: string | null;
          id: string;
          motivo: string | null;
          ocorrido_em: string;
          origem: string;
          pipedrive_ref: string | null;
          pipedrive_stage_id: number | null;
        };
        Insert: {
          at_id: string;
          autor?: string | null;
          created_at?: string;
          evento: string;
          horario_anterior?: string | null;
          horario_novo?: string | null;
          id?: string;
          motivo?: string | null;
          ocorrido_em?: string;
          origem?: string;
          pipedrive_ref?: string | null;
          pipedrive_stage_id?: number | null;
        };
        Update: {
          at_id?: string;
          autor?: string | null;
          created_at?: string;
          evento?: string;
          horario_anterior?: string | null;
          horario_novo?: string | null;
          id?: string;
          motivo?: string | null;
          ocorrido_em?: string;
          origem?: string;
          pipedrive_ref?: string | null;
          pipedrive_stage_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "at_eventos_at_id_fkey";
            columns: ["at_id"];
            isOneToOne: false;
            referencedRelation: "ats";
            referencedColumns: ["id"];
          },
        ];
      };
      ats: {
        Row: {
          agendada_atual: string;
          agendada_original: string;
          canal: string | null;
          cargo: string | null;
          cn_login: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          empresa: string;
          ficha_original: string | null;
          hunter_login: string | null;
          id: string;
          linkedin: string | null;
          mensagem_ficha: string | null;
          motivo_prospeccao: string | null;
          origem: string;
          pipedrive_activity_at_id: number | null;
          pipedrive_activity_tp1_id: number | null;
          pipedrive_activity_tp3_id: number | null;
          pipedrive_activity_tp4_id: number | null;
          pipedrive_deal_id: number | null;
          pipedrive_org_id: number | null;
          pipedrive_person_id: number | null;
          pipedrive_stage_id: number | null;
          prospect: string;
          registrada_em: string;
          resposta_etapa: number | null;
          resposta_modelo: string | null;
          setor: string | null;
          status: string;
          status_em: string | null;
          tipo: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          agendada_atual: string;
          agendada_original: string;
          canal?: string | null;
          cargo?: string | null;
          cn_login?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa: string;
          ficha_original?: string | null;
          hunter_login?: string | null;
          id?: string;
          linkedin?: string | null;
          mensagem_ficha?: string | null;
          motivo_prospeccao?: string | null;
          origem?: string;
          pipedrive_activity_at_id?: number | null;
          pipedrive_activity_tp1_id?: number | null;
          pipedrive_activity_tp3_id?: number | null;
          pipedrive_activity_tp4_id?: number | null;
          pipedrive_deal_id?: number | null;
          pipedrive_org_id?: number | null;
          pipedrive_person_id?: number | null;
          pipedrive_stage_id?: number | null;
          prospect: string;
          registrada_em?: string;
          resposta_etapa?: number | null;
          resposta_modelo?: string | null;
          setor?: string | null;
          status?: string;
          status_em?: string | null;
          tipo?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          agendada_atual?: string;
          agendada_original?: string;
          canal?: string | null;
          cargo?: string | null;
          cn_login?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa?: string;
          ficha_original?: string | null;
          hunter_login?: string | null;
          id?: string;
          linkedin?: string | null;
          mensagem_ficha?: string | null;
          motivo_prospeccao?: string | null;
          origem?: string;
          pipedrive_activity_at_id?: number | null;
          pipedrive_activity_tp1_id?: number | null;
          pipedrive_activity_tp3_id?: number | null;
          pipedrive_activity_tp4_id?: number | null;
          pipedrive_deal_id?: number | null;
          pipedrive_org_id?: number | null;
          pipedrive_person_id?: number | null;
          pipedrive_stage_id?: number | null;
          prospect?: string;
          registrada_em?: string;
          resposta_etapa?: number | null;
          resposta_modelo?: string | null;
          setor?: string | null;
          status?: string;
          status_em?: string | null;
          tipo?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ats_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      ciclo_metas: {
        Row: {
          ats_avancaram: number | null;
          ats_marcadas: number | null;
          ats_realizadas: number | null;
          contatos: number | null;
          created_at: string;
          period_id: string;
          updated_at: string;
          vendas: number | null;
        };
        Insert: {
          ats_avancaram?: number | null;
          ats_marcadas?: number | null;
          ats_realizadas?: number | null;
          contatos?: number | null;
          created_at?: string;
          period_id: string;
          updated_at?: string;
          vendas?: number | null;
        };
        Update: {
          ats_avancaram?: number | null;
          ats_marcadas?: number | null;
          ats_realizadas?: number | null;
          contatos?: number | null;
          created_at?: string;
          period_id?: string;
          updated_at?: string;
          vendas?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ciclo_metas_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: true;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          gender: string;
          id: string;
          name: string;
          period_id: string | null;
          porte: string | null;
          sector_id: string;
          subsector_id: string | null;
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
          porte?: string | null;
          sector_id: string;
          subsector_id?: string | null;
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
          porte?: string | null;
          sector_id?: string;
          subsector_id?: string | null;
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
          {
            foreignKeyName: "companies_subsector_id_fkey";
            columns: ["subsector_id"];
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
          persona: string | null;
          phone: string;
          proposta_em: string | null;
          proposta_registrado_em: string | null;
          respondeu_em: string | null;
          resposta_etapa: number | null;
          resposta_modelo: string | null;
          resposta_tipo: string | null;
          retomada_marcada_em: string | null;
          retomado_em: string | null;
          retomar_em: string | null;
          retomar_motivo: string | null;
          sector: string;
          sem_whatsapp: boolean;
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
          persona?: string | null;
          phone?: string;
          proposta_em?: string | null;
          proposta_registrado_em?: string | null;
          respondeu_em?: string | null;
          resposta_etapa?: number | null;
          resposta_modelo?: string | null;
          resposta_tipo?: string | null;
          retomada_marcada_em?: string | null;
          retomado_em?: string | null;
          retomar_em?: string | null;
          retomar_motivo?: string | null;
          sector?: string;
          sem_whatsapp?: boolean;
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
          persona?: string | null;
          phone?: string;
          proposta_em?: string | null;
          proposta_registrado_em?: string | null;
          respondeu_em?: string | null;
          resposta_etapa?: number | null;
          resposta_modelo?: string | null;
          resposta_tipo?: string | null;
          retomada_marcada_em?: string | null;
          retomado_em?: string | null;
          retomar_em?: string | null;
          retomar_motivo?: string | null;
          sector?: string;
          sem_whatsapp?: boolean;
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
      dashboard_parametros: {
        Row: {
          amostra_minima_ab: number;
          avanco_fica_pct: number;
          avanco_troca_pct: number;
          concentracao_ats_pct: number;
          dias_contato_parado: number;
          esforco_alerta_pct: number;
          id: boolean;
          maturacao_semanas: number;
          min_ats_segmento: number;
          nao_realizadas_pct: number;
          semanas_seguidas: number;
          updated_at: string;
        };
        Insert: {
          amostra_minima_ab?: number;
          avanco_fica_pct?: number;
          avanco_troca_pct?: number;
          concentracao_ats_pct?: number;
          dias_contato_parado?: number;
          esforco_alerta_pct?: number;
          id?: boolean;
          maturacao_semanas?: number;
          min_ats_segmento?: number;
          nao_realizadas_pct?: number;
          semanas_seguidas?: number;
          updated_at?: string;
        };
        Update: {
          amostra_minima_ab?: number;
          avanco_fica_pct?: number;
          avanco_troca_pct?: number;
          concentracao_ats_pct?: number;
          dias_contato_parado?: number;
          esforco_alerta_pct?: number;
          id?: boolean;
          maturacao_semanas?: number;
          min_ats_segmento?: number;
          nao_realizadas_pct?: number;
          semanas_seguidas?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      dashboard_tempo_etapas: {
        Row: {
          meta_dias: number;
          stage_id: number;
          updated_at: string;
        };
        Insert: {
          meta_dias: number;
          stage_id: number;
          updated_at?: string;
        };
        Update: {
          meta_dias?: number;
          stage_id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          ats_semana: number | null;
          created_at: string;
          envios_dia: number | null;
          group_id: string | null;
          id: string;
          l1_semana: number | null;
          no_prazo_pct: number | null;
          passos_semana: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          ats_semana?: number | null;
          created_at?: string;
          envios_dia?: number | null;
          group_id?: string | null;
          id?: string;
          l1_semana?: number | null;
          no_prazo_pct?: number | null;
          passos_semana?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          ats_semana?: number | null;
          created_at?: string;
          envios_dia?: number | null;
          group_id?: string | null;
          id?: string;
          l1_semana?: number | null;
          no_prazo_pct?: number | null;
          passos_semana?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goals_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
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
      pd_card_etapas: {
        Row: {
          deal_id: number;
          entrou_em: string;
          saiu_em: string | null;
          stage_id: number;
        };
        Insert: {
          deal_id: number;
          entrou_em: string;
          saiu_em?: string | null;
          stage_id: number;
        };
        Update: {
          deal_id?: number;
          entrou_em?: string;
          saiu_em?: string | null;
          stage_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pd_card_etapas_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "pd_cards";
            referencedColumns: ["deal_id"];
          },
        ];
      };
      pd_cards: {
        Row: {
          add_time: string | null;
          canal_entrada: string | null;
          cargo: string | null;
          deal_id: number;
          etiquetas: number[];
          hunter_login: string | null;
          lost_reason: string | null;
          lost_time: string | null;
          moeda: string | null;
          org_id: number | null;
          outbound: boolean;
          person_id: number | null;
          pipeline_id: number | null;
          porte: string | null;
          sincronizado_em: string;
          stage_change_time: string | null;
          stage_id: number | null;
          status: string;
          titulo: string;
          update_time: string | null;
          valor: number | null;
          won_time: string | null;
        };
        Insert: {
          add_time?: string | null;
          canal_entrada?: string | null;
          cargo?: string | null;
          deal_id: number;
          etiquetas?: number[];
          hunter_login?: string | null;
          lost_reason?: string | null;
          lost_time?: string | null;
          moeda?: string | null;
          org_id?: number | null;
          outbound?: boolean;
          person_id?: number | null;
          pipeline_id?: number | null;
          porte?: string | null;
          sincronizado_em?: string;
          stage_change_time?: string | null;
          stage_id?: number | null;
          status: string;
          titulo?: string;
          update_time?: string | null;
          valor?: number | null;
          won_time?: string | null;
        };
        Update: {
          add_time?: string | null;
          canal_entrada?: string | null;
          cargo?: string | null;
          deal_id?: number;
          etiquetas?: number[];
          hunter_login?: string | null;
          lost_reason?: string | null;
          lost_time?: string | null;
          moeda?: string | null;
          org_id?: number | null;
          outbound?: boolean;
          person_id?: number | null;
          pipeline_id?: number | null;
          porte?: string | null;
          sincronizado_em?: string;
          stage_change_time?: string | null;
          stage_id?: number | null;
          status?: string;
          titulo?: string;
          update_time?: string | null;
          valor?: number | null;
          won_time?: string | null;
        };
        Relationships: [];
      };
      pd_tasks: {
        Row: {
          activity_id: number;
          add_time: string | null;
          assunto: string;
          deal_id: number;
          done: boolean;
          due_date: string | null;
          hunter_login: string | null;
          marked_as_done_time: string | null;
          tipo: string | null;
        };
        Insert: {
          activity_id: number;
          add_time?: string | null;
          assunto?: string;
          deal_id: number;
          done?: boolean;
          due_date?: string | null;
          hunter_login?: string | null;
          marked_as_done_time?: string | null;
          tipo?: string | null;
        };
        Update: {
          activity_id?: number;
          add_time?: string | null;
          assunto?: string;
          deal_id?: number;
          done?: boolean;
          due_date?: string | null;
          hunter_login?: string | null;
          marked_as_done_time?: string | null;
          tipo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pd_tasks_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "pd_cards";
            referencedColumns: ["deal_id"];
          },
        ];
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
          kind: string;
          name: string;
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
      pipedrive_webhook_log: {
        Row: {
          erro: string | null;
          evento: string | null;
          id: number;
          objeto_id: number | null;
          payload: Json;
          processado_em: string | null;
          recebido_em: string;
        };
        Insert: {
          erro?: string | null;
          evento?: string | null;
          id?: number;
          objeto_id?: number | null;
          payload: Json;
          processado_em?: string | null;
          recebido_em?: string;
        };
        Update: {
          erro?: string | null;
          evento?: string | null;
          id?: number;
          objeto_id?: number | null;
          payload?: Json;
          processado_em?: string | null;
          recebido_em?: string;
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
      safras: {
        Row: {
          created_at: string;
          fim: string;
          id: string;
          inicio: string;
          numero: number;
          period_id: string;
          updated_at: string;
          usa_alocacao: boolean;
        };
        Insert: {
          created_at?: string;
          fim: string;
          id?: string;
          inicio: string;
          numero: number;
          period_id: string;
          updated_at?: string;
          usa_alocacao?: boolean;
        };
        Update: {
          created_at?: string;
          fim?: string;
          id?: string;
          inicio?: string;
          numero?: number;
          period_id?: string;
          updated_at?: string;
          usa_alocacao?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "safras_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
        ];
      };
      sector_templates: {
        Row: {
          body: string;
          code: string;
          persona: string;
          sector_id: string;
          step: number;
          updated_at: string;
        };
        Insert: {
          body?: string;
          code?: string;
          persona?: string;
          sector_id: string;
          step: number;
          updated_at?: string;
        };
        Update: {
          body?: string;
          code?: string;
          persona?: string;
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
          parent_id: string | null;
          sort: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          sort?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sectors_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
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
      time_comercial: {
        Row: {
          apelidos: string[];
          ativo: boolean;
          created_at: string;
          login: string;
          nome: string;
          papel: string;
          pipedrive_hunter_option_id: number | null;
          pipedrive_user_id: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          apelidos?: string[];
          ativo?: boolean;
          created_at?: string;
          login: string;
          nome: string;
          papel: string;
          pipedrive_hunter_option_id?: number | null;
          pipedrive_user_id?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          apelidos?: string[];
          ativo?: boolean;
          created_at?: string;
          login?: string;
          nome?: string;
          papel?: string;
          pipedrive_hunter_option_id?: number | null;
          pipedrive_user_id?: number | null;
          updated_at?: string;
          user_id?: string | null;
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
      match_persona: { Args: { texto: string }; Returns: string };
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
      suggest_persona: {
        Args: { cargo: string; headline: string };
        Returns: string;
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
