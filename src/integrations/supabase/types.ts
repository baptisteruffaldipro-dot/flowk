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
      print_orders: {
        Row: {
          amount: number | null
          bat_file_path: string | null
          bat_validated_at: string | null
          client_id: string
          created_at: string
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
          bat_validated_at?: string | null
          client_id: string
          created_at?: string
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
          bat_validated_at?: string | null
          client_id?: string
          created_at?: string
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
          brief: Json | null
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
          brief?: Json | null
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
          brief?: Json | null
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
      tasks: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          client_id: string | null
          client_revisions_count: number
          created_at: string
          deadline: string | null
          estimated_minutes: number | null
          flat_amount: number | null
          hourly_rate: number | null
          id: string
          notes: string | null
          prestation: Database["public"]["Enums"]["prestation_type"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          timer_started_at: string | null
          title: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          estimated_minutes?: number | null
          flat_amount?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          prestation?: Database["public"]["Enums"]["prestation_type"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timer_started_at?: string | null
          title: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client_id?: string | null
          client_revisions_count?: number
          created_at?: string
          deadline?: string | null
          estimated_minutes?: number | null
          flat_amount?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          prestation?: Database["public"]["Enums"]["prestation_type"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "client"
      billing_type: "horaire" | "forfait"
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
      task_status:
        | "a_faire"
        | "en_attente"
        | "aujourdhui"
        | "envoye"
        | "a_facturer"
        | "archive"
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
      billing_type: ["horaire", "forfait"],
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
      task_status: [
        "a_faire",
        "en_attente",
        "aujourdhui",
        "envoye",
        "a_facturer",
        "archive",
      ],
    },
  },
} as const
