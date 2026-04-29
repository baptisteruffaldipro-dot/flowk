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
          created_at: string
          description: string | null
          file_path: string | null
          file_uploaded_at: string | null
          finitions: string | null
          format: string | null
          id: string
          observations: string | null
          print_status: Database["public"]["Enums"]["bat_print_status"] | null
          project_id: string | null
          quantity: number | null
          reference: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
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
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_uploaded_at?: string | null
          finitions?: string | null
          format?: string | null
          id?: string
          observations?: string | null
          print_status?: Database["public"]["Enums"]["bat_print_status"] | null
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
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
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_uploaded_at?: string | null
          finitions?: string | null
          format?: string | null
          id?: string
          observations?: string | null
          print_status?: Database["public"]["Enums"]["bat_print_status"] | null
          project_id?: string | null
          quantity?: number | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
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
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          invoiced_at: string | null
          label: string
          paid_at: string | null
          print_order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          invoiced_at?: string | null
          label: string
          paid_at?: string | null
          print_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          invoiced_at?: string | null
          label?: string
          paid_at?: string | null
          print_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          task_id?: string | null
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
      print_orders: {
        Row: {
          amount: number | null
          bat_file_path: string | null
          bat_rejected_at: string | null
          bat_rejection_reason: string | null
          bat_uploaded_at: string | null
          bat_validated_at: string | null
          client_id: string
          created_at: string
          deliverables: Json
          description: string
          id: string
          project_id: string | null
          status: Database["public"]["Enums"]["print_status"]
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
          created_at?: string
          deliverables?: Json
          description: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["print_status"]
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
          created_at?: string
          deliverables?: Json
          description?: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["print_status"]
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
      projects: {
        Row: {
          archived: boolean
          brief: Json | null
          brief_submitted_at: string | null
          client_id: string
          created_at: string
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
          brief_submitted_at?: string | null
          client_id: string
          created_at?: string
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
          brief_submitted_at?: string | null
          client_id?: string
          created_at?: string
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
          billing_type: Database["public"]["Enums"]["billing_type"]
          client_id: string | null
          client_revisions_count: number
          created_at: string
          deadline: string | null
          deliverables: Json
          delivered_at: string | null
          estimated_minutes: number | null
          flat_amount: number | null
          hourly_rate: number | null
          id: string
          notes: string | null
          position: number
          prestation: Database["public"]["Enums"]["prestation_type"]
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          timer_started_at: string | null
          title: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          acompte_invoiced?: boolean
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          deliverables?: Json
          delivered_at?: string | null
          estimated_minutes?: number | null
          flat_amount?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          position?: number
          prestation?: Database["public"]["Enums"]["prestation_type"]
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timer_started_at?: string | null
          title: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          acompte_invoiced?: boolean
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          deliverables?: Json
          delivered_at?: string | null
          estimated_minutes?: number | null
          flat_amount?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          position?: number
          prestation?: Database["public"]["Enums"]["prestation_type"]
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timer_started_at?: string | null
          title?: string
          total_minutes?: number
          updated_at?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      invoice_status: "a_facturer" | "facturee" | "payee"
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
      print_status:
        | "bat_en_attente"
        | "bat_valide"
        | "en_impression"
        | "expedie"
        | "livre"
      project_type:
        | "identite_graphique"
        | "support_communication"
        | "web"
        | "impression"
        | "autre"
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
      invoice_status: ["a_facturer", "facturee", "payee"],
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
      print_status: [
        "bat_en_attente",
        "bat_valide",
        "en_impression",
        "expedie",
        "livre",
      ],
      project_type: [
        "identite_graphique",
        "support_communication",
        "web",
        "impression",
        "autre",
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
      ],
    },
  },
} as const
