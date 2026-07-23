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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          project_id: string | null
          reminder_minutes_before: number | null
          reminder_sent_at: string | null
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_balances: {
        Row: {
          amount: number
          as_of_date: string
          created_at: string
          id: string
          import_id: string | null
          note: string | null
          source: string
          updated_at: string
        }
        Insert: {
          amount: number
          as_of_date: string
          created_at?: string
          id?: string
          import_id?: string | null
          note?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          as_of_date?: string
          created_at?: string
          id?: string
          import_id?: string | null
          note?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_balances_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tiime_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      bat_annotations: {
        Row: {
          author_id: string | null
          bat_id: string | null
          comment: string
          created_at: string
          id: string
          page: number
          print_order_id: string | null
          resolved: boolean
          task_id: string | null
          x: number
          y: number
        }
        Insert: {
          author_id?: string | null
          bat_id?: string | null
          comment: string
          created_at?: string
          id?: string
          page?: number
          print_order_id?: string | null
          resolved?: boolean
          task_id?: string | null
          x: number
          y: number
        }
        Update: {
          author_id?: string | null
          bat_id?: string | null
          comment?: string
          created_at?: string
          id?: string
          page?: number
          print_order_id?: string | null
          resolved?: boolean
          task_id?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "bat_annotations_bat_id_fkey"
            columns: ["bat_id"]
            isOneToOne: false
            referencedRelation: "bats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bat_annotations_print_order_id_fkey"
            columns: ["print_order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bat_annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bats: {
        Row: {
          client_id: string
          colors: string | null
          corners: string | null
          created_at: string
          description: string | null
          file_path: string | null
          file_uploaded_at: string | null
          finitions: string | null
          foil_color: string | null
          format: string | null
          hot_foil: string | null
          id: string
          is_published: boolean
          lamination: string | null
          models_count: number | null
          observations: string | null
          price_tiers: Json
          pricing_text: string | null
          print_status: Database["public"]["Enums"]["bat_print_status"] | null
          printed_face: string | null
          project_id: string | null
          quantity: number | null
          reference: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          share_token: string
          signed_at: string | null
          signed_by_name: string | null
          status: Database["public"]["Enums"]["bat_status"]
          support: string | null
          title: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          client_id: string
          colors?: string | null
          corners?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_uploaded_at?: string | null
          finitions?: string | null
          foil_color?: string | null
          format?: string | null
          hot_foil?: string | null
          id?: string
          is_published?: boolean
          lamination?: string | null
          models_count?: number | null
          observations?: string | null
          price_tiers?: Json
          pricing_text?: string | null
          print_status?: Database["public"]["Enums"]["bat_print_status"] | null
          printed_face?: string | null
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          share_token?: string
          signed_at?: string | null
          signed_by_name?: string | null
          status?: Database["public"]["Enums"]["bat_status"]
          support?: string | null
          title: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          client_id?: string
          colors?: string | null
          corners?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_uploaded_at?: string | null
          finitions?: string | null
          foil_color?: string | null
          format?: string | null
          hot_foil?: string | null
          id?: string
          is_published?: boolean
          lamination?: string | null
          models_count?: number | null
          observations?: string | null
          price_tiers?: Json
          pricing_text?: string | null
          print_status?: Database["public"]["Enums"]["bat_print_status"] | null
          printed_face?: string | null
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          share_token?: string
          signed_at?: string | null
          signed_by_name?: string | null
          status?: Database["public"]["Enums"]["bat_status"]
          support?: string | null
          title?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_strategies: {
        Row: {
          client_id: string | null
          client_name: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          project_name: string
          share_token: string | null
          tagline: string
          updated_at: string
          version: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          project_name: string
          share_token?: string | null
          tagline?: string
          updated_at?: string
          version?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          project_name?: string
          share_token?: string | null
          tagline?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json | null
          portal_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json | null
          portal_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_messages: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          portal_id: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          portal_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_messages_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portals: {
        Row: {
          admin_confirmed_paid_at: string | null
          admin_notes: string | null
          client_declared_paid_at: string | null
          client_declared_paid_note: string | null
          client_id: string | null
          client_refused_at: string | null
          client_validated_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_override: boolean
          delivery_unlock_rule: Database["public"]["Enums"]["delivery_unlock_rule"]
          entity_id: string
          entity_type: Database["public"]["Enums"]["client_portal_entity"]
          id: string
          is_published: boolean
          payment_link_sent_at: string | null
          payment_link_url: string | null
          payment_method_requested:
            | Database["public"]["Enums"]["client_portal_payment_method"]
            | null
          published_at: string | null
          refusal_reason: string | null
          share_token: string
          status: Database["public"]["Enums"]["client_portal_status"]
          updated_at: string
        }
        Insert: {
          admin_confirmed_paid_at?: string | null
          admin_notes?: string | null
          client_declared_paid_at?: string | null
          client_declared_paid_note?: string | null
          client_id?: string | null
          client_refused_at?: string | null
          client_validated_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_override?: boolean
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          entity_id: string
          entity_type: Database["public"]["Enums"]["client_portal_entity"]
          id?: string
          is_published?: boolean
          payment_link_sent_at?: string | null
          payment_link_url?: string | null
          payment_method_requested?:
            | Database["public"]["Enums"]["client_portal_payment_method"]
            | null
          published_at?: string | null
          refusal_reason?: string | null
          share_token?: string
          status?: Database["public"]["Enums"]["client_portal_status"]
          updated_at?: string
        }
        Update: {
          admin_confirmed_paid_at?: string | null
          admin_notes?: string | null
          client_declared_paid_at?: string | null
          client_declared_paid_note?: string | null
          client_id?: string | null
          client_refused_at?: string | null
          client_validated_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_override?: boolean
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["client_portal_entity"]
          id?: string
          is_published?: boolean
          payment_link_sent_at?: string | null
          payment_link_url?: string | null
          payment_method_requested?:
            | Database["public"]["Enums"]["client_portal_payment_method"]
            | null
          published_at?: string | null
          refusal_reason?: string | null
          share_token?: string
          status?: Database["public"]["Enums"]["client_portal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_request_messages: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      client_requests: {
        Row: {
          billing_type: Database["public"]["Enums"]["client_request_billing"]
          client_id: string | null
          client_name_snapshot: string | null
          client_refusal_reason: string | null
          client_refused_at: string | null
          client_validated_at: string | null
          converted_appointment_id: string | null
          converted_print_order_id: string | null
          converted_project_id: string | null
          converted_task_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          estimated_amount: number | null
          estimated_end_date: string | null
          estimated_minutes: number | null
          estimated_start_date: string | null
          hourly_rate: number | null
          id: string
          is_published: boolean
          kind: Database["public"]["Enums"]["client_request_kind"]
          prestation_type: string | null
          share_token: string
          status: Database["public"]["Enums"]["client_request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          billing_type?: Database["public"]["Enums"]["client_request_billing"]
          client_id?: string | null
          client_name_snapshot?: string | null
          client_refusal_reason?: string | null
          client_refused_at?: string | null
          client_validated_at?: string | null
          converted_appointment_id?: string | null
          converted_print_order_id?: string | null
          converted_project_id?: string | null
          converted_task_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_amount?: number | null
          estimated_end_date?: string | null
          estimated_minutes?: number | null
          estimated_start_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_published?: boolean
          kind?: Database["public"]["Enums"]["client_request_kind"]
          prestation_type?: string | null
          share_token?: string
          status?: Database["public"]["Enums"]["client_request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["client_request_billing"]
          client_id?: string | null
          client_name_snapshot?: string | null
          client_refusal_reason?: string | null
          client_refused_at?: string | null
          client_validated_at?: string | null
          converted_appointment_id?: string | null
          converted_print_order_id?: string | null
          converted_project_id?: string | null
          converted_task_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_amount?: number | null
          estimated_end_date?: string | null
          estimated_minutes?: number | null
          estimated_start_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_published?: boolean
          kind?: Database["public"]["Enums"]["client_request_kind"]
          prestation_type?: string | null
          share_token?: string
          status?: Database["public"]["Enums"]["client_request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_requests_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_requests_converted_print_order_id_fkey"
            columns: ["converted_print_order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_requests_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_requests_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          portal_token: string
          portal_user_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          portal_token?: string
          portal_user_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          portal_token?: string
          portal_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      finance_category_rules: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["finance_category"]
          created_at: string
          field: string
          id: string
          match_kind: Database["public"]["Enums"]["finance_kind"] | null
          pattern: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          field?: string
          id?: string
          match_kind?: Database["public"]["Enums"]["finance_kind"] | null
          pattern: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          field?: string
          id?: string
          match_kind?: Database["public"]["Enums"]["finance_kind"] | null
          pattern?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_financings: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          first_payment_date: string | null
          id: string
          interest_rate: number | null
          kind: Database["public"]["Enums"]["financing_kind"]
          label: string
          monthly_payment: number
          note: string | null
          principal_amount: number
          received_date: string
          remaining_installments: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          first_payment_date?: string | null
          id?: string
          interest_rate?: number | null
          kind?: Database["public"]["Enums"]["financing_kind"]
          label: string
          monthly_payment?: number
          note?: string | null
          principal_amount?: number
          received_date?: string
          remaining_installments?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          first_payment_date?: string | null
          id?: string
          interest_rate?: number | null
          kind?: Database["public"]["Enums"]["financing_kind"]
          label?: string
          monthly_payment?: number
          note?: string | null
          principal_amount?: number
          received_date?: string
          remaining_installments?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_forecasts: {
        Row: {
          amount_ttc: number
          created_at: string
          id: string
          kind: string
          label: string
          note: string | null
          planned_date: string
          recurrence: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          amount_ttc: number
          created_at?: string
          id?: string
          kind?: string
          label: string
          note?: string | null
          planned_date: string
          recurrence?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          amount_ttc?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string
          note?: string | null
          planned_date?: string
          recurrence?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      finance_link_rules: {
        Row: {
          client_id: string | null
          counterparty_normalized: string
          created_at: string
          id: string
          project_id: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          counterparty_normalized: string
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          counterparty_normalized?: string
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_link_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_link_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_link_rules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_code: string | null
          amount_ht: number
          amount_ttc: number
          category: Database["public"]["Enums"]["finance_category"]
          category_source: string | null
          client_id: string | null
          counterparty: string | null
          counterparty_normalized: string | null
          created_at: string
          date: string
          dedupe_key: string | null
          doc_number: string | null
          due_date: string | null
          id: string
          import_id: string | null
          invoice_id: string | null
          kind: Database["public"]["Enums"]["finance_kind"]
          label: string | null
          paid_date: string | null
          project_id: string | null
          raw: Json | null
          source: string
          supplier_cost_ht: number | null
          task_id: string | null
          updated_at: string
          vat_amount: number
          vat_rate: number | null
        }
        Insert: {
          account_code?: string | null
          amount_ht?: number
          amount_ttc?: number
          category?: Database["public"]["Enums"]["finance_category"]
          category_source?: string | null
          client_id?: string | null
          counterparty?: string | null
          counterparty_normalized?: string | null
          created_at?: string
          date: string
          dedupe_key?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          kind: Database["public"]["Enums"]["finance_kind"]
          label?: string | null
          paid_date?: string | null
          project_id?: string | null
          raw?: Json | null
          source?: string
          supplier_cost_ht?: number | null
          task_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number | null
        }
        Update: {
          account_code?: string | null
          amount_ht?: number
          amount_ttc?: number
          category?: Database["public"]["Enums"]["finance_category"]
          category_source?: string | null
          client_id?: string | null
          counterparty?: string | null
          counterparty_normalized?: string | null
          created_at?: string
          date?: string
          dedupe_key?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          import_id?: string | null
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["finance_kind"]
          label?: string | null
          paid_date?: string | null
          project_id?: string | null
          raw?: Json | null
          source?: string
          supplier_cost_ht?: number | null
          task_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tiime_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_projects: {
        Row: {
          created_at: string
          goal_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_tasks: {
        Row: {
          created_at: string
          goal_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          icon: string | null
          id: string
          position: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          position?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          position?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          invoice_id: string
          label: string | null
          paid_amount: number
          paid_at: string | null
          position: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          invoice_id: string
          label?: string | null
          paid_amount?: number
          paid_at?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_id?: string
          label?: string | null
          paid_amount?: number
          paid_at?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_type: Database["public"]["Enums"]["invoice_billing_type"]
          client_id: string
          created_at: string
          hourly_rate: number | null
          hours: number | null
          id: string
          invoiced_at: string | null
          label: string
          paid_at: string | null
          print_order_id: string | null
          questionnaire_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          task_id: string | null
          tiime_invoice_id: string | null
          tiime_synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_type?: Database["public"]["Enums"]["invoice_billing_type"]
          client_id: string
          created_at?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoiced_at?: string | null
          label: string
          paid_at?: string | null
          print_order_id?: string | null
          questionnaire_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          task_id?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_type?: Database["public"]["Enums"]["invoice_billing_type"]
          client_id?: string
          created_at?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoiced_at?: string | null
          label?: string
          paid_at?: string | null
          print_order_id?: string | null
          questionnaire_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          task_id?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_print_order_id_fkey"
            columns: ["print_order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_dividers: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          status: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          metadata: Json
          name: string | null
          phone: string | null
          read_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      logo_presentations: {
        Row: {
          client_id: string | null
          client_name: string
          content: Json
          created_at: string
          created_by: string | null
          deliverables: Json
          delivery_override: boolean
          delivery_override_at: string | null
          delivery_override_by: string | null
          delivery_unlock_rule: Database["public"]["Enums"]["delivery_unlock_rule"]
          id: string
          invoice_file_path: string | null
          invoice_url: string | null
          is_published: boolean
          project_name: string
          share_token: string | null
          tagline: string
          updated_at: string
          version: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deliverables?: Json
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          is_published?: boolean
          project_name: string
          share_token?: string | null
          tagline?: string
          updated_at?: string
          version?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deliverables?: Json
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          is_published?: boolean
          project_name?: string
          share_token?: string | null
          tagline?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "logo_presentations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_accounts: {
        Row: {
          created_at: string
          email: string
          from_name: string | null
          id: string
          imap_host: string
          imap_port: number
          imap_tls: boolean
          last_error: string | null
          last_synced_at: string | null
          last_uid_seen: number
          signature: string | null
          smtp_host: string
          smtp_port: number
          smtp_tls: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          from_name?: string | null
          id?: string
          imap_host: string
          imap_port?: number
          imap_tls?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          last_uid_seen?: number
          signature?: string | null
          smtp_host: string
          smtp_port?: number
          smtp_tls?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          from_name?: string | null
          id?: string
          imap_host?: string
          imap_port?: number
          imap_tls?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          last_uid_seen?: number
          signature?: string | null
          smtp_host?: string
          smtp_port?: number
          smtp_tls?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      mail_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mail_id: string
          mime: string | null
          size: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mail_id: string
          mime?: string | null
          size?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mail_id?: string
          mime?: string | null
          size?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_attachments_mail_id_fkey"
            columns: ["mail_id"]
            isOneToOne: false
            referencedRelation: "mails"
            referencedColumns: ["id"]
          },
        ]
      }
      mails: {
        Row: {
          account_id: string
          body_html: string | null
          body_text: string | null
          cc_emails: string[]
          client_id: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          in_reply_to: string | null
          is_archived: boolean
          is_read: boolean
          is_starred: boolean
          message_id: string | null
          project_id: string | null
          raw_headers: Json | null
          received_at: string
          snippet: string | null
          subject: string | null
          task_id: string | null
          thread_key: string | null
          to_emails: string[]
          uid: number
          updated_at: string
        }
        Insert: {
          account_id: string
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          client_id?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          message_id?: string | null
          project_id?: string | null
          raw_headers?: Json | null
          received_at: string
          snippet?: string | null
          subject?: string | null
          task_id?: string | null
          thread_key?: string | null
          to_emails?: string[]
          uid: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          client_id?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          message_id?: string | null
          project_id?: string | null
          raw_headers?: Json | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          task_id?: string | null
          thread_key?: string | null
          to_emails?: string[]
          uid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mails_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          account_holder: string | null
          bank_name: string | null
          bic: string | null
          iban: string | null
          id: number
          transfer_note: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          iban?: string | null
          id?: number
          transfer_note?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          iban?: string | null
          id?: number
          transfer_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phase_actions: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          phase_id: string
          position: number
          task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          phase_id: string
          position?: number
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          phase_id?: string
          position?: number
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_actions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_actions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      print_orders: {
        Row: {
          amount: number | null
          bat_file_path: string | null
          bat_rejected_at: string | null
          bat_rejection_reason: string | null
          bat_uploaded_at: string | null
          bat_validated_at: string | null
          client_id: string
          colors: string | null
          created_at: string
          deliverables: Json
          delivery_override: boolean
          delivery_override_at: string | null
          delivery_override_by: string | null
          delivery_unlock_rule: Database["public"]["Enums"]["delivery_unlock_rule"]
          description: string
          estimated_delivery_date: string | null
          finitions: string | null
          format: string | null
          grammage: string | null
          id: string
          invoice_file_path: string | null
          invoice_url: string | null
          observations: string | null
          payment_status: Database["public"]["Enums"]["print_payment_status"]
          products: Json
          project_id: string | null
          quantity: number | null
          reference: string | null
          status: Database["public"]["Enums"]["print_status"]
          support: string | null
          total_minutes: number
          updated_at: string
        }
        Insert: {
          amount?: number | null
          bat_file_path?: string | null
          bat_rejected_at?: string | null
          bat_rejection_reason?: string | null
          bat_uploaded_at?: string | null
          bat_validated_at?: string | null
          client_id: string
          colors?: string | null
          created_at?: string
          deliverables?: Json
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          description: string
          estimated_delivery_date?: string | null
          finitions?: string | null
          format?: string | null
          grammage?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          observations?: string | null
          payment_status?: Database["public"]["Enums"]["print_payment_status"]
          products?: Json
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          status?: Database["public"]["Enums"]["print_status"]
          support?: string | null
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          amount?: number | null
          bat_file_path?: string | null
          bat_rejected_at?: string | null
          bat_rejection_reason?: string | null
          bat_uploaded_at?: string | null
          bat_validated_at?: string | null
          client_id?: string
          colors?: string | null
          created_at?: string
          deliverables?: Json
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          description?: string
          estimated_delivery_date?: string | null
          finitions?: string | null
          format?: string | null
          grammage?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          observations?: string | null
          payment_status?: Database["public"]["Enums"]["print_payment_status"]
          products?: Json
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          status?: Database["public"]["Enums"]["print_status"]
          support?: string | null
          total_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          collapsed: boolean
          created_at: string
          id: string
          objective: string | null
          position: number
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          collapsed?: boolean
          created_at?: string
          id?: string
          objective?: string | null
          position?: number
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          collapsed?: boolean
          created_at?: string
          id?: string
          objective?: string | null
          position?: number
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          brief: Json | null
          brief_required: boolean
          brief_submitted_at: string | null
          client_id: string
          created_at: string
          deadline: string | null
          deliverable_files: Json
          description: string | null
          id: string
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          archived?: boolean
          brief?: Json | null
          brief_required?: boolean
          brief_submitted_at?: string | null
          client_id: string
          created_at?: string
          deadline?: string | null
          deliverable_files?: Json
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          archived?: boolean
          brief?: Json | null
          brief_required?: boolean
          brief_submitted_at?: string | null
          client_id?: string
          created_at?: string
          deadline?: string | null
          deliverable_files?: Json
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          ai_suggested_tasks: Json
          ai_summary: string | null
          ai_summary_generated_at: string | null
          answers: Json
          client_id: string | null
          created_at: string
          created_by: string | null
          filled_by_client: boolean
          id: string
          project_id: string | null
          share_token: string | null
          status: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at: string | null
          template: Database["public"]["Enums"]["questionnaire_template"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_suggested_tasks?: Json
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          answers?: Json
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          filled_by_client?: boolean
          id?: string
          project_id?: string | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at?: string | null
          template: Database["public"]["Enums"]["questionnaire_template"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_suggested_tasks?: Json
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          answers?: Json
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          filled_by_client?: boolean
          id?: string
          project_id?: string | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at?: string | null
          template?: Database["public"]["Enums"]["questionnaire_template"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaires_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_captures: {
        Row: {
          ai_suggestions: Json
          ai_summary: string | null
          client_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          print_order_id: string | null
          processed_at: string | null
          project_id: string | null
          source: Database["public"]["Enums"]["capture_source"]
          status: Database["public"]["Enums"]["capture_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          ai_suggestions?: Json
          ai_summary?: string | null
          client_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          print_order_id?: string | null
          processed_at?: string | null
          project_id?: string | null
          source?: Database["public"]["Enums"]["capture_source"]
          status?: Database["public"]["Enums"]["capture_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_suggestions?: Json
          ai_summary?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          print_order_id?: string | null
          processed_at?: string | null
          project_id?: string | null
          source?: Database["public"]["Enums"]["capture_source"]
          status?: Database["public"]["Enums"]["capture_status"]
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_captures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_captures_print_order_id_fkey"
            columns: ["print_order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_captures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_captures_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          id: string
          label: string
          position: number
          url: string
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          label: string
          position?: number
          url: string
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          position?: number
          url?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          caption: string | null
          checklist: Json
          client_id: string
          created_at: string
          event_name: string | null
          format: Database["public"]["Enums"]["social_format"]
          id: string
          media: Json
          notes: string | null
          pillar: string | null
          platforms: Database["public"]["Enums"]["social_platform"][]
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["social_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          checklist?: Json
          client_id: string
          created_at?: string
          event_name?: string | null
          format?: Database["public"]["Enums"]["social_format"]
          id?: string
          media?: Json
          notes?: string | null
          pillar?: string | null
          platforms?: Database["public"]["Enums"]["social_platform"][]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          checklist?: Json
          client_id?: string
          created_at?: string
          event_name?: string | null
          format?: Database["public"]["Enums"]["social_format"]
          id?: string
          media?: Json
          notes?: string | null
          pillar?: string | null
          platforms?: Database["public"]["Enums"]["social_platform"][]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_strategies: {
        Row: {
          axes: Json
          client_id: string
          content: string | null
          created_at: string
          id: string
          objective: string | null
          pillars: Json
          rhythm: Json
          tone: string | null
          updated_at: string
          weekly_template: Json
        }
        Insert: {
          axes?: Json
          client_id: string
          content?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          pillars?: Json
          rhythm?: Json
          tone?: string | null
          updated_at?: string
          weekly_template?: Json
        }
        Update: {
          axes?: Json
          client_id?: string
          content?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          pillars?: Json
          rhythm?: Json
          tone?: string | null
          updated_at?: string
          weekly_template?: Json
        }
        Relationships: []
      }
      social_tasks: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          position: number
          post_id: string | null
          priority: Database["public"]["Enums"]["social_task_priority"]
          reminder_at: string | null
          status: Database["public"]["Enums"]["social_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          position?: number
          post_id?: string | null
          priority?: Database["public"]["Enums"]["social_task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["social_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          position?: number
          post_id?: string | null
          priority?: Database["public"]["Enums"]["social_task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["social_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_tasks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subgoals: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          goal_id: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          goal_id: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          goal_id?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgoals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          acompte_invoiced: boolean
          bat_id: string | null
          billing_type: Database["public"]["Enums"]["billing_type"]
          client_id: string | null
          client_revisions_count: number
          created_at: string
          deadline: string | null
          deliverable_files: Json
          deliverables: Json
          delivered_at: string | null
          delivery_override: boolean
          delivery_override_at: string | null
          delivery_override_by: string | null
          delivery_unlock_rule: Database["public"]["Enums"]["delivery_unlock_rule"]
          estimated_minutes: number | null
          estimated_print_amount: number | null
          extra_revision_rate: number | null
          flat_amount: number | null
          free_revisions: number
          hourly_rate: number | null
          id: string
          invoice_file_path: string | null
          invoice_url: string | null
          note_attachments: Json
          notes: string | null
          position: number
          prestation: Database["public"]["Enums"]["prestation_type"]
          prestations: string[]
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          questionnaire_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          timer_started_at: string | null
          title: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          acompte_invoiced?: boolean
          bat_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          deliverable_files?: Json
          deliverables?: Json
          delivered_at?: string | null
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          estimated_minutes?: number | null
          estimated_print_amount?: number | null
          extra_revision_rate?: number | null
          flat_amount?: number | null
          free_revisions?: number
          hourly_rate?: number | null
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          note_attachments?: Json
          notes?: string | null
          position?: number
          prestation?: Database["public"]["Enums"]["prestation_type"]
          prestations?: string[]
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          questionnaire_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timer_started_at?: string | null
          title: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          acompte_invoiced?: boolean
          bat_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          deliverable_files?: Json
          deliverables?: Json
          delivered_at?: string | null
          delivery_override?: boolean
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_unlock_rule?: Database["public"]["Enums"]["delivery_unlock_rule"]
          estimated_minutes?: number | null
          estimated_print_amount?: number | null
          extra_revision_rate?: number | null
          flat_amount?: number | null
          free_revisions?: number
          hourly_rate?: number | null
          id?: string
          invoice_file_path?: string | null
          invoice_url?: string | null
          note_attachments?: Json
          notes?: string | null
          position?: number
          prestation?: Database["public"]["Enums"]["prestation_type"]
          prestations?: string[]
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          questionnaire_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timer_started_at?: string | null
          title?: string
          total_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_bat_id_fkey"
            columns: ["bat_id"]
            isOneToOne: false
            referencedRelation: "bats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_allowed_users: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_conversations: {
        Row: {
          chat_id: number
          history: Json
          pending_payload: Json | null
          updated_at: string
        }
        Insert: {
          chat_id: number
          history?: Json
          pending_payload?: Json | null
          updated_at?: string
        }
        Update: {
          chat_id?: number
          history?: Json
          pending_payload?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      tiime_auth: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          id: number
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          id?: number
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          id?: number
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tiime_column_mappings: {
        Row: {
          created_at: string
          headers_signature: string | null
          id: string
          kind: Database["public"]["Enums"]["finance_kind"] | null
          mapping: Json
          profile_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          headers_signature?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["finance_kind"] | null
          mapping?: Json
          profile_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          headers_signature?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["finance_kind"] | null
          mapping?: Json
          profile_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tiime_imports: {
        Row: {
          created_at: string
          duplicate_count: number
          file_hash: string | null
          filename: string
          id: string
          imported_by: string | null
          inserted_count: number
          notes: string | null
          period_month: string | null
          rolled_back_at: string | null
          row_count: number
          status: Database["public"]["Enums"]["tiime_import_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          file_hash?: string | null
          filename: string
          id?: string
          imported_by?: string | null
          inserted_count?: number
          notes?: string | null
          period_month?: string | null
          rolled_back_at?: string | null
          row_count?: number
          status?: Database["public"]["Enums"]["tiime_import_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          file_hash?: string | null
          filename?: string
          id?: string
          imported_by?: string | null
          inserted_count?: number
          notes?: string | null
          period_month?: string | null
          rolled_back_at?: string | null
          row_count?: number
          status?: Database["public"]["Enums"]["tiime_import_status"]
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          estimated_minutes_at_start: number | null
          id: string
          started_at: string
          task_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          estimated_minutes_at_start?: number | null
          id?: string
          started_at: string
          task_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          estimated_minutes_at_start?: number | null
          id?: string
          started_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vat_adjustments: {
        Row: {
          adjustment: number
          created_at: string
          id: string
          note: string | null
          period_month: string
          reserve_pct: number | null
          updated_at: string
        }
        Insert: {
          adjustment?: number
          created_at?: string
          id?: string
          note?: string | null
          period_month: string
          reserve_pct?: number | null
          updated_at?: string
        }
        Update: {
          adjustment?: number
          created_at?: string
          id?: string
          note?: string | null
          period_month?: string
          reserve_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_download: {
        Args: { _entity_id: string; _entity_type: string }
        Returns: boolean
      }
      client_request_add_message_by_token: {
        Args: { _body: string; _token: string }
        Returns: Json
      }
      client_request_decide_by_token: {
        Args: { _decision: string; _reason?: string; _token: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_brand_strategy_by_token: {
        Args: { _token: string }
        Returns: {
          client_id: string | null
          client_name: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          project_name: string
          share_token: string | null
          tagline: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "brand_strategies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_client_portal_by_token: { Args: { _token: string }; Returns: Json }
      get_client_request_by_token: { Args: { _token: string }; Returns: Json }
      get_logo_presentation_by_token: {
        Args: { _token: string }
        Returns: {
          client_id: string | null
          client_name: string
          content: Json
          created_at: string
          created_by: string | null
          deliverables: Json
          delivery_override: boolean
          delivery_override_at: string | null
          delivery_override_by: string | null
          delivery_unlock_rule: Database["public"]["Enums"]["delivery_unlock_rule"]
          id: string
          invoice_file_path: string | null
          invoice_url: string | null
          is_published: boolean
          project_name: string
          share_token: string | null
          tagline: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "logo_presentations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      portal_action_by_token: {
        Args: { _action: string; _payload?: Json; _token: string }
        Returns: Json
      }
      portal_deliverables_by_token: { Args: { _token: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "client"
      appointment_status: "planifie" | "confirme" | "annule" | "termine"
      appointment_type: "visio" | "presentiel" | "telephone" | "autre"
      bat_print_status: "a_imprimer" | "en_impression" | "expedie" | "livre"
      bat_status: "brouillon" | "en_relecture" | "valide" | "rejete"
      billing_type: "horaire" | "forfait"
      capture_source:
        | "sms"
        | "whatsapp"
        | "email"
        | "instagram"
        | "messenger"
        | "telephone"
        | "autre"
      capture_status: "a_traiter" | "traite" | "archive"
      client_portal_entity: "task" | "project"
      client_portal_payment_method: "transfer" | "link"
      client_portal_status:
        | "draft"
        | "awaiting_validation"
        | "validated"
        | "refused"
        | "payment_pending"
        | "payment_link_requested"
        | "paid"
        | "delivered"
      client_request_billing: "forfait" | "horaire" | "a_definir"
      client_request_channel: "mail" | "message" | "appel" | "rdv" | "autre"
      client_request_kind: "projet" | "tache" | "commande" | "rdv" | "autre"
      client_request_status:
        | "nouveau"
        | "en_attente_client"
        | "validee"
        | "refusee"
        | "convertie"
        | "annulee"
      delivery_unlock_rule: "acompte" | "total" | "libre"
      finance_category:
        | "prestation"
        | "achat_revente"
        | "expense"
        | "bank"
        | "other"
        | "apport_perso"
        | "retrait_perso"
      finance_kind: "sale" | "expense" | "bank"
      financing_kind: "credit" | "shareholder_loan" | "other"
      invoice_billing_type: "forfait" | "horaire"
      invoice_status: "a_facturer" | "facturee" | "payee"
      lead_status: "nouveau" | "contacte" | "qualifie" | "perdu" | "converti"
      prestation_type:
        | "mise_en_page"
        | "creation"
        | "logo"
        | "impression"
        | "devis"
        | "moodboard"
        | "ajustements"
        | "autre"
        | "illustration"
        | "crea"
        | "logotype"
        | "a_commander"
        | "recherche_graphique"
        | "post_insta"
        | "affiche"
        | "motion"
        | "projet"
        | "shooting"
        | "vecto"
        | "reel"
        | "sideprojet"
        | "en_attente_client"
        | "livrables"
        | "gestion"
        | "prospect"
        | "developpement"
        | "conception_graphique"
        | "rendez_vous"
        | "croquis"
        | "test"
        | "programmer"
        | "maj_carte"
        | "rappeler"
        | "refonte"
        | "vectorisation"
        | "covering"
        | "impaye"
        | "prevoir_rdv"
        | "organiser"
        | "etiquette"
        | "acompte"
        | "facture_a_payer"
        | "facture_a_faire"
        | "strategie"
        | "traduction"
      print_payment_status: "non_regle" | "acompte_50" | "regle"
      print_status:
        | "a_commander"
        | "validation_bat"
        | "en_impression"
        | "livre"
        | "livre_paye"
        | "sav_en_cours"
        | "sav_a_faire"
      project_type:
        | "identite_graphique"
        | "support_communication"
        | "web"
        | "impression"
        | "autre"
        | "identite_visuelle"
        | "rebranding"
        | "strategie_marque"
        | "logotype"
        | "multi_projets"
      questionnaire_status: "brouillon" | "envoye" | "complete" | "archive"
      questionnaire_template: "logo" | "print" | "web" | "rapide" | "note"
      social_format:
        | "reel"
        | "post"
        | "carrousel"
        | "story"
        | "linkedin"
        | "video"
        | "autre"
      social_platform:
        | "instagram"
        | "facebook"
        | "linkedin"
        | "tiktok"
        | "pinterest"
        | "autre"
      social_post_status:
        | "idee"
        | "a_faire"
        | "pret"
        | "programme"
        | "publie"
        | "annule"
      social_task_priority: "basse" | "normale" | "haute"
      social_task_status:
        | "a_faire"
        | "en_cours"
        | "fait"
        | "aujourdhui"
        | "envoye"
        | "bat"
        | "impression"
        | "a_facturer"
        | "archive"
      task_priority:
        | "en_priorite"
        | "secondaire"
        | "attente_retour_client"
        | "devis"
      task_status:
        | "a_faire"
        | "en_attente"
        | "aujourdhui"
        | "envoye"
        | "a_facturer"
        | "archive"
        | "facturee"
        | "payee"
        | "facture_envoyee"
        | "bat"
        | "tiime"
        | "impression"
      tiime_import_status: "pending" | "completed" | "rolled_back" | "failed"
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
      app_role: ["admin", "client"],
      appointment_status: ["planifie", "confirme", "annule", "termine"],
      appointment_type: ["visio", "presentiel", "telephone", "autre"],
      bat_print_status: ["a_imprimer", "en_impression", "expedie", "livre"],
      bat_status: ["brouillon", "en_relecture", "valide", "rejete"],
      billing_type: ["horaire", "forfait"],
      capture_source: [
        "sms",
        "whatsapp",
        "email",
        "instagram",
        "messenger",
        "telephone",
        "autre",
      ],
      capture_status: ["a_traiter", "traite", "archive"],
      client_portal_entity: ["task", "project"],
      client_portal_payment_method: ["transfer", "link"],
      client_portal_status: [
        "draft",
        "awaiting_validation",
        "validated",
        "refused",
        "payment_pending",
        "payment_link_requested",
        "paid",
        "delivered",
      ],
      client_request_billing: ["forfait", "horaire", "a_definir"],
      client_request_channel: ["mail", "message", "appel", "rdv", "autre"],
      client_request_kind: ["projet", "tache", "commande", "rdv", "autre"],
      client_request_status: [
        "nouveau",
        "en_attente_client",
        "validee",
        "refusee",
        "convertie",
        "annulee",
      ],
      delivery_unlock_rule: ["acompte", "total", "libre"],
      finance_category: [
        "prestation",
        "achat_revente",
        "expense",
        "bank",
        "other",
        "apport_perso",
        "retrait_perso",
      ],
      finance_kind: ["sale", "expense", "bank"],
      financing_kind: ["credit", "shareholder_loan", "other"],
      invoice_billing_type: ["forfait", "horaire"],
      invoice_status: ["a_facturer", "facturee", "payee"],
      lead_status: ["nouveau", "contacte", "qualifie", "perdu", "converti"],
      prestation_type: [
        "mise_en_page",
        "creation",
        "logo",
        "impression",
        "devis",
        "moodboard",
        "ajustements",
        "autre",
        "illustration",
        "crea",
        "logotype",
        "a_commander",
        "recherche_graphique",
        "post_insta",
        "affiche",
        "motion",
        "projet",
        "shooting",
        "vecto",
        "reel",
        "sideprojet",
        "en_attente_client",
        "livrables",
        "gestion",
        "prospect",
        "developpement",
        "conception_graphique",
        "rendez_vous",
        "croquis",
        "test",
        "programmer",
        "maj_carte",
        "rappeler",
        "refonte",
        "vectorisation",
        "covering",
        "impaye",
        "prevoir_rdv",
        "organiser",
        "etiquette",
        "acompte",
        "facture_a_payer",
        "facture_a_faire",
        "strategie",
        "traduction",
      ],
      print_payment_status: ["non_regle", "acompte_50", "regle"],
      print_status: [
        "a_commander",
        "validation_bat",
        "en_impression",
        "livre",
        "livre_paye",
        "sav_en_cours",
        "sav_a_faire",
      ],
      project_type: [
        "identite_graphique",
        "support_communication",
        "web",
        "impression",
        "autre",
        "identite_visuelle",
        "rebranding",
        "strategie_marque",
        "logotype",
        "multi_projets",
      ],
      questionnaire_status: ["brouillon", "envoye", "complete", "archive"],
      questionnaire_template: ["logo", "print", "web", "rapide", "note"],
      social_format: [
        "reel",
        "post",
        "carrousel",
        "story",
        "linkedin",
        "video",
        "autre",
      ],
      social_platform: [
        "instagram",
        "facebook",
        "linkedin",
        "tiktok",
        "pinterest",
        "autre",
      ],
      social_post_status: [
        "idee",
        "a_faire",
        "pret",
        "programme",
        "publie",
        "annule",
      ],
      social_task_priority: ["basse", "normale", "haute"],
      social_task_status: [
        "a_faire",
        "en_cours",
        "fait",
        "aujourdhui",
        "envoye",
        "bat",
        "impression",
        "a_facturer",
        "archive",
      ],
      task_priority: [
        "en_priorite",
        "secondaire",
        "attente_retour_client",
        "devis",
      ],
      task_status: [
        "a_faire",
        "en_attente",
        "aujourdhui",
        "envoye",
        "a_facturer",
        "archive",
        "facturee",
        "payee",
        "facture_envoyee",
        "bat",
        "tiime",
        "impression",
      ],
      tiime_import_status: ["pending", "completed", "rolled_back", "failed"],
    },
  },
} as const
