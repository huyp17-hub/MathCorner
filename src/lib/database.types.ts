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
      answers: {
        Row: {
          blank_answers: Json | null
          flagged: boolean
          id: string
          points_awarded: number | null
          question_id: string
          selected_choice_ids: string[]
          submission_id: string
          text_answer: string | null
          tf_answers: Json | null
          time_spent_seconds: number
          updated_at: string
        }
        Insert: {
          blank_answers?: Json | null
          flagged?: boolean
          id?: string
          points_awarded?: number | null
          question_id: string
          selected_choice_ids?: string[]
          submission_id: string
          text_answer?: string | null
          tf_answers?: Json | null
          time_spent_seconds?: number
          updated_at?: string
        }
        Update: {
          blank_answers?: Json | null
          flagged?: boolean
          id?: string
          points_awarded?: number | null
          question_id?: string
          selected_choice_ids?: string[]
          submission_id?: string
          text_answer?: string | null
          tf_answers?: Json | null
          time_spent_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          allow_pause: boolean
          class_id: string
          created_at: string
          description: string | null
          due_at: string
          exam_format: Database["public"]["Enums"]["exam_format"]
          id: string
          max_attempts: number
          open_at: string
          show_answers: Database["public"]["Enums"]["show_answers_mode"]
          shuffle: boolean
          time_limit_minutes: number | null
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
        }
        Insert: {
          allow_late?: boolean
          allow_pause?: boolean
          class_id: string
          created_at?: string
          description?: string | null
          due_at: string
          exam_format?: Database["public"]["Enums"]["exam_format"]
          id?: string
          max_attempts?: number
          open_at?: string
          show_answers?: Database["public"]["Enums"]["show_answers_mode"]
          shuffle?: boolean
          time_limit_minutes?: number | null
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
        }
        Update: {
          allow_late?: boolean
          allow_pause?: boolean
          class_id?: string
          created_at?: string
          description?: string | null
          due_at?: string
          exam_format?: Database["public"]["Enums"]["exam_format"]
          id?: string
          max_attempts?: number
          open_at?: string
          show_answers?: Database["public"]["Enums"]["show_answers_mode"]
          shuffle?: boolean
          time_limit_minutes?: number | null
          title?: string
          type?: Database["public"]["Enums"]["assignment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          note: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          note?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          note?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      choices: {
        Row: {
          blank_no: number | null
          content: string
          id: string
          is_correct: boolean
          order_index: number
          question_id: string
        }
        Insert: {
          blank_no?: number | null
          content: string
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id: string
        }
        Update: {
          blank_no?: number | null
          content?: string
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_messages: {
        Row: {
          class_id: string
          content: string
          created_at: string
          id: string
          pinned: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string
          id?: string
          pinned?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "class_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          period: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          period?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          billable_statuses: Database["public"]["Enums"]["attendance_status"][]
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          created_at: string
          id: string
          join_code: string
          low_session_warning: number
          name: string
          price_per_session: number | null
          school_year: string | null
          subject: string | null
          teacher_id: string
        }
        Insert: {
          billable_statuses?: Database["public"]["Enums"]["attendance_status"][]
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          created_at?: string
          id?: string
          join_code?: string
          low_session_warning?: number
          name: string
          price_per_session?: number | null
          school_year?: string | null
          subject?: string | null
          teacher_id?: string
        }
        Update: {
          billable_statuses?: Database["public"]["Enums"]["attendance_status"][]
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          created_at?: string
          id?: string
          join_code?: string
          low_session_warning?: number
          name?: string
          price_per_session?: number | null
          school_year?: string | null
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sections: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          order_index: number
          time_limit_minutes: number | null
          title: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          order_index?: number
          time_limit_minutes?: number | null
          title: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          order_index?: number
          time_limit_minutes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          lesson_id: string
          mime_type: string | null
          position: number
          size_bytes: number | null
          storage_path: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind: string
          lesson_id: string
          mime_type?: string | null
          position?: number
          size_bytes?: number | null
          storage_path?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          lesson_id?: string
          mime_type?: string | null
          position?: number
          size_bytes?: number | null
          storage_path?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_files_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          published: boolean
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          published?: boolean
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          published?: boolean
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_attempts: {
        Row: {
          attempted_at: string
          id: number
          parent_id: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          parent_id: string
          success: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          parent_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "parent_link_attempts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          created_at: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_code: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_code?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_code?: string | null
        }
        Relationships: []
      }
      question_answer_keys: {
        Row: {
          answer: string
          id: string
          question_id: string
        }
        Insert: {
          answer: string
          id?: string
          question_id: string
        }
        Update: {
          answer?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answer_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_groups: {
        Row: {
          assignment_id: string
          content: string
          id: string
          order_index: number
          section_id: string | null
          title: string | null
        }
        Insert: {
          assignment_id: string
          content: string
          id?: string
          order_index?: number
          section_id?: string | null
          title?: string | null
        }
        Update: {
          assignment_id?: string
          content?: string
          id?: string
          order_index?: number
          section_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_groups_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_groups_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      question_solutions: {
        Row: {
          explanation: string
          question_id: string
        }
        Insert: {
          explanation: string
          question_id: string
        }
        Update: {
          explanation?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_solutions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          assignment_id: string
          content: string
          group_id: string | null
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          multiple_correct: boolean
          order_index: number
          points: number
          section_id: string | null
        }
        Insert: {
          assignment_id: string
          content: string
          group_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          multiple_correct?: boolean
          order_index?: number
          points?: number
          section_id?: string | null
        }
        Update: {
          assignment_id?: string
          content?: string
          group_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          multiple_correct?: boolean
          order_index?: number
          points?: number
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "question_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent_codes: {
        Row: {
          code: string
          student_id: string
          updated_at: string
        }
        Insert: {
          code?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          size: number
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          size: number
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          size?: number
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_sections: {
        Row: {
          finished_at: string | null
          paused_seconds: number
          section_id: string
          started_at: string
          submission_id: string
        }
        Insert: {
          finished_at?: string | null
          paused_seconds?: number
          section_id: string
          started_at?: string
          submission_id: string
        }
        Update: {
          finished_at?: string | null
          paused_seconds?: number
          section_id?: string
          started_at?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_sections_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          attempt_no: number
          essay_text: string | null
          graded_at: string | null
          id: string
          is_late: boolean
          max_score: number | null
          paused_at: string | null
          paused_seconds: number
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        Insert: {
          assignment_id: string
          attempt_no?: number
          essay_text?: string | null
          graded_at?: string | null
          id?: string
          is_late?: boolean
          max_score?: number | null
          paused_at?: string | null
          paused_seconds?: number
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Update: {
          assignment_id?: string
          attempt_no?: number
          essay_text?: string | null
          graded_at?: string | null
          id?: string
          is_late?: boolean
          max_score?: number | null
          paused_at?: string | null
          paused_seconds?: number
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_packages: {
        Row: {
          class_id: string
          created_at: string
          id: string
          note: string | null
          price: number | null
          sessions: number
          start_date: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          note?: string | null
          price?: number | null
          sessions: number
          start_date?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          note?: string | null
          price?: number | null
          sessions?: number
          start_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_packages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_packages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_payments: {
        Row: {
          amount: number
          class_id: string
          created_at: string
          created_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          package_id: string | null
          paid_on: string
          student_id: string
        }
        Insert: {
          amount: number
          class_id: string
          created_at?: string
          created_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          package_id?: string | null
          paid_on?: string
          student_id: string
        }
        Update: {
          amount?: number
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          package_id?: string | null
          paid_on?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_payments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "tuition_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_payments_student_id_fkey"
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
      finish_section: {
        Args: { p_section_id: string; p_submission_id: string }
        Returns: Json
      }
      get_quiz: { Args: { p_submission_id: string }; Returns: Json }
      get_quiz_review: { Args: { p_submission_id: string }; Returns: Json }
      join_class: { Args: { p_code: string }; Returns: string }
      link_parent: { Args: { p_code: string }; Returns: Json }
      parent_child_assignments: {
        Args: { p_student_id: string }
        Returns: {
          assignment_id: string
          class_id: string
          class_name: string
          due_at: string
          is_late: boolean
          is_overdue: boolean
          max_score: number
          score: number
          status: string
          submitted_at: string
          teacher_comment: string
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
        }[]
      }
      parent_children: {
        Args: never
        Returns: {
          full_name: string
          student_code: string
          student_id: string
        }[]
      }
      pause_attempt: { Args: { p_submission_id: string }; Returns: Json }
      regenerate_join_code: { Args: { p_class_id: string }; Returns: string }
      regenerate_parent_code: {
        Args: { p_student_id: string }
        Returns: string
      }
      resume_attempt: { Args: { p_submission_id: string }; Returns: Json }
      save_essay: {
        Args: { p_essay_text: string; p_submission_id: string }
        Returns: undefined
      }
      start_attempt: {
        Args: { p_assignment_id: string }
        Returns: {
          assignment_id: string
          attempt_no: number
          essay_text: string | null
          graded_at: string | null
          id: string
          is_late: boolean
          max_score: number | null
          paused_at: string | null
          paused_seconds: number
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_section: {
        Args: { p_section_id: string; p_submission_id: string }
        Returns: Json
      }
      submit_essay: {
        Args: { p_essay_text?: string; p_submission_id: string }
        Returns: {
          assignment_id: string
          attempt_no: number
          essay_text: string | null
          graded_at: string | null
          id: string
          is_late: boolean
          max_score: number | null
          paused_at: string | null
          paused_seconds: number
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quiz: {
        Args: { p_submission_id: string }
        Returns: {
          assignment_id: string
          attempt_no: number
          essay_text: string | null
          graded_at: string | null
          id: string
          is_late: boolean
          max_score: number | null
          paused_at: string | null
          paused_seconds: number
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tuition_summary: {
        Args: { p_class_id: string; p_month?: string }
        Returns: {
          absent_in_month: number
          amount_due_month: number
          amount_total: number
          balance: number
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          full_name: string
          low_sessions: boolean
          paid_month: number
          paid_total: number
          sessions_in_month: number
          sessions_purchased: number
          sessions_remaining: number
          sessions_used_total: number
          student_code: string
          student_id: string
        }[]
      }
    }
    Enums: {
      assignment_type: "quiz" | "essay"
      attendance_status: "present" | "excused" | "absent" | "late"
      billing_mode: "package" | "per_session"
      exam_format: "standard" | "tsa"
      payment_method: "cash" | "transfer" | "other"
      question_kind:
        | "multiple_choice"
        | "true_false"
        | "short_answer"
        | "drag_drop"
      show_answers_mode: "after_submit" | "after_due" | "never"
      submission_status: "in_progress" | "submitted" | "graded"
      user_role: "teacher" | "student" | "parent"
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
    Enums: {
      assignment_type: ["quiz", "essay"],
      attendance_status: ["present", "excused", "absent", "late"],
      billing_mode: ["package", "per_session"],
      exam_format: ["standard", "tsa"],
      payment_method: ["cash", "transfer", "other"],
      question_kind: [
        "multiple_choice",
        "true_false",
        "short_answer",
        "drag_drop",
      ],
      show_answers_mode: ["after_submit", "after_due", "never"],
      submission_status: ["in_progress", "submitted", "graded"],
      user_role: ["teacher", "student", "parent"],
    },
  },
} as const
