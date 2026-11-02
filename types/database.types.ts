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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          activity_id: string | null
          code_snapshot: Json
          content: string
          course_reference: Json | null
          created_at: string
          id: string
          latency_ms: number | null
          role: string
          student_lab_session_id: string
        }
        Insert: {
          activity_id?: string | null
          code_snapshot?: Json
          content: string
          course_reference?: Json | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          role: string
          student_lab_session_id: string
        }
        Update: {
          activity_id?: string | null
          code_snapshot?: Json
          content?: string
          course_reference?: Json | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          role?: string
          student_lab_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_student_lab_session_id_fkey"
            columns: ["student_lab_session_id"]
            isOneToOne: false
            referencedRelation: "student_lab_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_chapters: {
        Row: {
          chapter_number: number
          code: string
          course_id: string
          created_at: string
          id: string
          key_analogies: Json
          markdown_content: string
          pages_json: Json
          pdf_url: string | null
          title: string
          title_i18n: Json | null
          updated_at: string | null
        }
        Insert: {
          chapter_number: number
          code: string
          course_id: string
          created_at?: string
          id?: string
          key_analogies?: Json
          markdown_content?: string
          pages_json?: Json
          pdf_url?: string | null
          title: string
          title_i18n?: Json | null
          updated_at?: string | null
        }
        Update: {
          chapter_number?: number
          code?: string
          course_id?: string
          created_at?: string
          id?: string
          key_analogies?: Json
          markdown_content?: string
          pages_json?: Json
          pdf_url?: string | null
          title?: string
          title_i18n?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          competency_matrix: Json
          compiled_knowledge_base: string
          compiled_tutor_prompt: string
          content_language: string
          created_at: string
          description: string | null
          file_extensions: string[]
          id: string
          is_published: boolean
          stuck_threshold_turns: number
          teacher_id: string | null
          title: string
          tutor_language: string
          updated_at: string
        }
        Insert: {
          code: string
          competency_matrix?: Json
          compiled_knowledge_base?: string
          compiled_tutor_prompt?: string
          content_language?: string
          created_at?: string
          description?: string | null
          file_extensions?: string[]
          id?: string
          is_published?: boolean
          stuck_threshold_turns?: number
          teacher_id?: string | null
          title: string
          tutor_language?: string
          updated_at?: string
        }
        Update: {
          code?: string
          competency_matrix?: Json
          compiled_knowledge_base?: string
          compiled_tutor_prompt?: string
          content_language?: string
          created_at?: string
          description?: string | null
          file_extensions?: string[]
          id?: string
          is_published?: boolean
          stuck_threshold_turns?: number
          teacher_id?: string | null
          title?: string
          tutor_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          activities: Json
          code: string
          course_id: string
          covered_micro_concepts: string[]
          created_at: string
          demo_presets: Json
          description: string | null
          description_i18n: Json | null
          id: string
          is_active: boolean
          lab_number: number
          pages_json: Json
          pdf_url: string | null
          title: string
          title_i18n: Json | null
          updated_at: string | null
        }
        Insert: {
          activities?: Json
          code: string
          course_id: string
          covered_micro_concepts?: string[]
          created_at?: string
          demo_presets?: Json
          description?: string | null
          description_i18n?: Json | null
          id?: string
          is_active?: boolean
          lab_number: number
          pages_json?: Json
          pdf_url?: string | null
          title: string
          title_i18n?: Json | null
          updated_at?: string | null
        }
        Update: {
          activities?: Json
          code?: string
          course_id?: string
          covered_micro_concepts?: string[]
          created_at?: string
          demo_presets?: Json
          description?: string | null
          description_i18n?: Json | null
          id?: string
          is_active?: boolean
          lab_number?: number
          pages_json?: Json
          pdf_url?: string | null
          title?: string
          title_i18n?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_guest: boolean
          role: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_guest?: boolean
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_guest?: boolean
          role?: string
        }
        Relationships: []
      }
      student_lab_sessions: {
        Row: {
          activities_progress: Json
          completed_milestone_ids: string[]
          completion_report: Json | null
          consecutive_errors: number
          course_id: string
          current_activity_id: string | null
          current_milestone_id: string | null
          id: string
          lab_id: string
          last_diagnostic_note: string | null
          last_stuck_at: string | null
          micro_competencies_state: Json
          progress_percent: number
          seat_label: string
          started_at: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          activities_progress?: Json
          completed_milestone_ids?: string[]
          completion_report?: Json | null
          consecutive_errors?: number
          course_id: string
          current_activity_id?: string | null
          current_milestone_id?: string | null
          id?: string
          lab_id: string
          last_diagnostic_note?: string | null
          last_stuck_at?: string | null
          micro_competencies_state?: Json
          progress_percent?: number
          seat_label?: string
          started_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          activities_progress?: Json
          completed_milestone_ids?: string[]
          completion_report?: Json | null
          consecutive_errors?: number
          course_id?: string
          current_activity_id?: string | null
          current_milestone_id?: string | null
          id?: string
          lab_id?: string
          last_diagnostic_note?: string | null
          last_stuck_at?: string | null
          micro_competencies_state?: Json
          progress_percent?: number
          seat_label?: string
          started_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lab_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lab_sessions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lab_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

