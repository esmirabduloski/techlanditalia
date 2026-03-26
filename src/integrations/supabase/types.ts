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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          browser: string | null
          click_x: number | null
          click_y: number | null
          created_at: string
          device_type: string | null
          element_selector: string | null
          event_action: string
          event_category: string
          event_label: string | null
          event_type: string
          event_value: number | null
          id: string
          metadata: Json | null
          page_title: string | null
          page_url: string | null
          referrer: string | null
          screen_size: string | null
          session_id: string
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          browser?: string | null
          click_x?: number | null
          click_y?: number | null
          created_at?: string
          device_type?: string | null
          element_selector?: string | null
          event_action: string
          event_category: string
          event_label?: string | null
          event_type: string
          event_value?: number | null
          id?: string
          metadata?: Json | null
          page_title?: string | null
          page_url?: string | null
          referrer?: string | null
          screen_size?: string | null
          session_id: string
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          browser?: string | null
          click_x?: number | null
          click_y?: number | null
          created_at?: string
          device_type?: string | null
          element_selector?: string | null
          event_action?: string
          event_category?: string
          event_label?: string | null
          event_type?: string
          event_value?: number | null
          id?: string
          metadata?: Json | null
          page_title?: string | null
          page_url?: string | null
          referrer?: string | null
          screen_size?: string | null
          session_id?: string
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          id: string
          marked_at: string | null
          marked_by: string | null
          notes: string | null
          scheduled_lesson_id: string
          status: string
          student_id: string
        }
        Insert: {
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          scheduled_lesson_id: string
          status: string
          student_id: string
        }
        Update: {
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          scheduled_lesson_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_scheduled_lesson_id_fkey"
            columns: ["scheduled_lesson_id"]
            isOneToOne: false
            referencedRelation: "scheduled_lessons"
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
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          emoji: string
          id: string
          name: string
          points_reward: number
          requirement_course_id: string | null
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          emoji?: string
          id?: string
          name: string
          points_reward?: number
          requirement_course_id?: string | null
          requirement_type: string
          requirement_value: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          name?: string
          points_reward?: number
          requirement_course_id?: string | null
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "badges_requirement_course_id_fkey"
            columns: ["requirement_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          published: boolean
          read_time: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean
          read_time?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean
          read_time?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          course_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          ended_at: string | null
          id: string
          metadata: Json | null
          session_id: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string
          started_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          email_sent: boolean
          error_message: string | null
          id: string
          messaggio: string
          nome: string
          oggetto: string
        }
        Insert: {
          created_at?: string
          email: string
          email_sent?: boolean
          error_message?: string | null
          id?: string
          messaggio: string
          nome: string
          oggetto: string
        }
        Update: {
          created_at?: string
          email?: string
          email_sent?: boolean
          error_message?: string | null
          id?: string
          messaggio?: string
          nome?: string
          oggetto?: string
        }
        Relationships: []
      }
      content_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          snapshot_data: Json
          snapshot_label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id?: string
          snapshot_data: Json
          snapshot_label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_label?: string
          entity_type?: string
          id?: string
          snapshot_data?: Json
          snapshot_label?: string | null
        }
        Relationships: []
      }
      conversion_funnels: {
        Row: {
          completed: boolean | null
          created_at: string
          funnel_name: string
          id: string
          metadata: Json | null
          session_id: string
          step_name: string
          step_number: number
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          funnel_name: string
          id?: string
          metadata?: Json | null
          session_id: string
          step_name: string
          step_number: number
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          funnel_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          step_name?: string
          step_number?: number
          user_id?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          age_range: string | null
          created_at: string
          description: string | null
          duration: string | null
          emoji: string
          id: string
          is_visible: boolean
          level: string
          slug: string
          title: string
          total_lessons: number
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          emoji?: string
          id?: string
          is_visible?: boolean
          level?: string
          slug: string
          title: string
          total_lessons?: number
        }
        Update: {
          age_range?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          emoji?: string
          id?: string
          is_visible?: boolean
          level?: string
          slug?: string
          title?: string
          total_lessons?: number
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          stripe_product_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          stripe_product_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          stripe_product_id?: string
        }
        Relationships: []
      }
      gamification_levels: {
        Row: {
          badge_emoji: string
          level: number
          min_points: number
          name: string
        }
        Insert: {
          badge_emoji: string
          level: number
          min_points: number
          name: string
        }
        Update: {
          badge_emoji?: string
          level?: number
          min_points?: number
          name?: string
        }
        Relationships: []
      }
      group_attendance: {
        Row: {
          group_id: string
          id: string
          lesson_number: number
          marked_at: string | null
          marked_by: string | null
          notes: string | null
          status: string
          student_id: string
        }
        Insert: {
          group_id: string
          id?: string
          lesson_number: number
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          status?: string
          student_id: string
        }
        Update: {
          group_id?: string
          id?: string
          lesson_number?: number
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          group_id: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          group_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_comments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_lesson_schedule: {
        Row: {
          created_at: string
          group_id: string
          id: string
          lesson_date: string
          lesson_number: number
          lesson_time: string | null
          lesson_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          lesson_date: string
          lesson_number: number
          lesson_time?: string | null
          lesson_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          lesson_date?: string
          lesson_number?: number
          lesson_time?: string | null
          lesson_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_lesson_schedule_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_students: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          student_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          student_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          attachments: Json | null
          created_at: string
          default_css_code: string | null
          default_html_code: string | null
          default_js_code: string | null
          default_python_code: string | null
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          lesson_id: string
          points_reward: number
          preview_only: boolean
          python_env: string | null
          replit_url: string | null
          title: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          default_css_code?: string | null
          default_html_code?: string | null
          default_js_code?: string | null
          default_python_code?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          lesson_id: string
          points_reward?: number
          preview_only?: boolean
          python_env?: string | null
          replit_url?: string | null
          title: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          default_css_code?: string | null
          default_html_code?: string | null
          default_js_code?: string | null
          default_python_code?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string
          points_reward?: number
          preview_only?: boolean
          python_env?: string | null
          replit_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_group_deadlines: {
        Row: {
          created_at: string
          due_date: string
          group_id: string
          homework_id: string
          id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          group_id: string
          homework_id: string
          id?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          group_id?: string
          homework_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_group_deadlines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_group_deadlines_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          feedback_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          grade: number | null
          homework_id: string
          id: string
          notes: string | null
          points_earned: number
          status: string
          student_id: string
          submitted_at: string
          teacher_feedback: string | null
        }
        Insert: {
          feedback_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          grade?: number | null
          homework_id: string
          id?: string
          notes?: string | null
          points_earned?: number
          status?: string
          student_id: string
          submitted_at?: string
          teacher_feedback?: string | null
        }
        Update: {
          feedback_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          grade?: number | null
          homework_id?: string
          id?: string
          notes?: string | null
          points_earned?: number
          status?: string
          student_id?: string
          submitted_at?: string
          teacher_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          created_at: string
          email: string
          id: string
          messaggio: string
          nome: string
          posizione: string
          read: boolean
          telefono: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          messaggio: string
          nome: string
          posizione: string
          read?: boolean
          telefono?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          messaggio?: string
          nome?: string
          posizione?: string
          read?: boolean
          telefono?: string | null
        }
        Relationships: []
      }
      lesson_balance_log: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          notes: string | null
          operation_type: string
          performed_by: string | null
          student_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          notes?: string | null
          operation_type: string
          performed_by?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          notes?: string | null
          operation_type?: string
          performed_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_balance_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          points_earned: number
          student_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          points_earned?: number
          student_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          points_earned?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reports: {
        Row: {
          created_at: string
          group_id: string
          id: string
          lesson_number: number
          students_needing_support: string[]
          support_notes: string | null
          teacher_id: string
          topics_covered: string
          topics_not_covered: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          lesson_number: number
          students_needing_support?: string[]
          support_notes?: string | null
          teacher_id: string
          topics_covered?: string
          topics_not_covered?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          lesson_number?: number
          students_needing_support?: string[]
          support_notes?: string | null
          teacher_id?: string
          topics_covered?: string
          topics_not_covered?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_tasks: {
        Row: {
          attachments: Json | null
          content: string | null
          content_type: string | null
          created_at: string
          default_css_code: string | null
          default_html_code: string | null
          default_js_code: string | null
          default_python_code: string | null
          description: string | null
          id: string
          lesson_id: string
          points_reward: number
          python_env: string | null
          replit_url: string | null
          scratch_url: string | null
          slides_url: string | null
          task_number: number
          title: string
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          default_css_code?: string | null
          default_html_code?: string | null
          default_js_code?: string | null
          default_python_code?: string | null
          description?: string | null
          id?: string
          lesson_id: string
          points_reward?: number
          python_env?: string | null
          replit_url?: string | null
          scratch_url?: string | null
          slides_url?: string | null
          task_number: number
          title: string
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          default_css_code?: string | null
          default_html_code?: string | null
          default_js_code?: string | null
          default_python_code?: string | null
          description?: string | null
          id?: string
          lesson_id?: string
          points_reward?: number
          python_env?: string | null
          replit_url?: string | null
          scratch_url?: string | null
          slides_url?: string | null
          task_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_tasks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          content_type: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          images: Json | null
          lesson_number: number
          manual_url: string | null
          points_reward: number
          slides_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          lesson_number: number
          manual_url?: string | null
          points_reward?: number
          slides_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          content_type?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          lesson_number?: number
          manual_url?: string | null
          points_reward?: number
          slides_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmation_token: string
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          confirmation_token?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          confirmation_token?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          device_type: string | null
          entered_at: string
          exited_at: string | null
          id: string
          page_title: string | null
          page_url: string
          referrer: string | null
          scroll_depth: number | null
          session_id: string
          time_on_page: number | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          device_type?: string | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          page_title?: string | null
          page_url: string
          referrer?: string | null
          scroll_depth?: number | null
          session_id: string
          time_on_page?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          device_type?: string | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          page_title?: string | null
          page_url?: string
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string
          time_on_page?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_id: number
          bg_color: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          lesson_balance: number
          onboarding_completed: boolean | null
          parent_id: string | null
          role: string
          total_points: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_id?: number
          bg_color?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          lesson_balance?: number
          onboarding_completed?: boolean | null
          parent_id?: string | null
          role: string
          total_points?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_id?: number
          bg_color?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lesson_balance?: number
          onboarding_completed?: boolean | null
          parent_id?: string | null
          role?: string
          total_points?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_lessons: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          lesson_date: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lesson_date: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lesson_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_bonuses: {
        Row: {
          awarded_at: string | null
          id: string
          milestone: number
          points_awarded: number
          streak_type: string
          student_id: string
        }
        Insert: {
          awarded_at?: string | null
          id?: string
          milestone: number
          points_awarded: number
          streak_type: string
          student_id: string
        }
        Update: {
          awarded_at?: string | null
          id?: string
          milestone?: number
          points_awarded?: number
          streak_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_bonuses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_code_drafts: {
        Row: {
          code_type: string
          content: string
          created_at: string
          id: string
          lesson_id: string | null
          student_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          code_type: string
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          code_type?: string
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_code_drafts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_code_drafts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_code_drafts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "lesson_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          student_id: string
          updated_at: string
          visibility: string[]
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
          visibility?: string[]
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
          visibility?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "student_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_groups: {
        Row: {
          archived_at: string | null
          certificates: Json | null
          course_id: string
          created_at: string | null
          id: string
          last_lesson_title: string | null
          lesson_days: number[] | null
          lesson_time: string | null
          max_lessons: number | null
          start_date: string | null
          status: string
          student_meeting_link: string | null
          teacher_id: string | null
          teacher_meeting_link: string | null
          title: string
          updated_at: string | null
          whatsapp_link: string | null
        }
        Insert: {
          archived_at?: string | null
          certificates?: Json | null
          course_id: string
          created_at?: string | null
          id?: string
          last_lesson_title?: string | null
          lesson_days?: number[] | null
          lesson_time?: string | null
          max_lessons?: number | null
          start_date?: string | null
          status?: string
          student_meeting_link?: string | null
          teacher_id?: string | null
          teacher_meeting_link?: string | null
          title: string
          updated_at?: string | null
          whatsapp_link?: string | null
        }
        Update: {
          archived_at?: string | null
          certificates?: Json | null
          course_id?: string
          created_at?: string | null
          id?: string
          last_lesson_title?: string | null
          lesson_days?: number[] | null
          lesson_time?: string | null
          max_lessons?: number | null
          start_date?: string | null
          status?: string
          student_meeting_link?: string | null
          teacher_id?: string | null
          teacher_meeting_link?: string | null
          title?: string
          updated_at?: string | null
          whatsapp_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_streaks: {
        Row: {
          attendance_streak: number | null
          best_attendance_streak: number | null
          best_homework_streak: number | null
          homework_streak: number | null
          id: string
          last_attendance_date: string | null
          last_homework_date: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          attendance_streak?: number | null
          best_attendance_streak?: number | null
          best_homework_streak?: number | null
          homework_streak?: number | null
          id?: string
          last_attendance_date?: string | null
          last_homework_date?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          attendance_streak?: number | null
          best_attendance_streak?: number | null
          best_homework_streak?: number | null
          homework_streak?: number | null
          id?: string
          last_attendance_date?: string | null
          last_homework_date?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_progress: {
        Row: {
          completed_at: string
          id: string
          points_earned: number
          student_id: string
          task_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          points_earned?: number
          student_id: string
          task_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          points_earned?: number
          student_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "lesson_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_courses: {
        Row: {
          assigned_at: string | null
          course_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          assigned_at?: string | null
          course_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          assigned_at?: string | null
          course_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_links: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      teacher_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          teacher_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          teacher_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          teacher_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          availability: Json | null
          bio: string | null
          created_at: string | null
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability?: Json | null
          bio?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability?: Json | null
          bio?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trial_bookings: {
        Row: {
          admin_notes: string | null
          availability: string | null
          child_age: number
          created_at: string
          email: string
          id: string
          interest: string
          message: string | null
          parent_name: string
          phone: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          availability?: string | null
          child_age: number
          created_at?: string
          email: string
          id?: string
          interest: string
          message?: string | null
          parent_name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          availability?: string | null
          child_age?: number
          created_at?: string
          email?: string
          id?: string
          interest?: string
          message?: string | null
          parent_name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      generate_slug: { Args: { title: string }; Returns: string }
      get_children_ids: { Args: { _parent_id: string }; Returns: string[] }
      get_leaderboard: {
        Args: { _filter_id?: string; _filter_type?: string; _limit?: number }
        Returns: {
          avatar_id: number
          full_name: string
          rank: number
          role: string
          total_points: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_parent_of_group: {
        Args: { _group_id: string; _parent_id: string }
        Returns: boolean
      }
      is_student_in_group: {
        Args: { _group_id: string; _student_id: string }
        Returns: boolean
      }
      is_teacher_of_group: {
        Args: { _group_id: string; _teacher_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
      teacher_teaches_student_in_group: {
        Args: { _group_id: string; _teacher_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "teacher"
      booking_status:
        | "pending"
        | "contacted"
        | "scheduled"
        | "completed"
        | "cancelled"
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
      app_role: ["admin", "user", "teacher"],
      booking_status: [
        "pending",
        "contacted",
        "scheduled",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
