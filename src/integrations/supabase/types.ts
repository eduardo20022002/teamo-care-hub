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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_events: {
        Row: {
          actual_duration_minutes: number | null
          actual_start_at: string | null
          child_id: string
          created_at: string
          end_at: string | null
          id: string
          linked_event_id: string | null
          locale: string | null
          plan_visible_to_parents: boolean | null
          professional_id: string | null
          professional_name_raw: string | null
          recurrence: Json
          reminders: Json
          session_attendance: string | null
          session_plan: Json | null
          session_type: string | null
          start_at: string
          status: string
          therapist_id: string | null
          title: string
          type: string
          type_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          actual_start_at?: string | null
          child_id: string
          created_at?: string
          end_at?: string | null
          id?: string
          linked_event_id?: string | null
          locale?: string | null
          plan_visible_to_parents?: boolean | null
          professional_id?: string | null
          professional_name_raw?: string | null
          recurrence?: Json
          reminders?: Json
          session_attendance?: string | null
          session_plan?: Json | null
          session_type?: string | null
          start_at: string
          status?: string
          therapist_id?: string | null
          title: string
          type: string
          type_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_duration_minutes?: number | null
          actual_start_at?: string | null
          child_id?: string
          created_at?: string
          end_at?: string | null
          id?: string
          linked_event_id?: string | null
          locale?: string | null
          plan_visible_to_parents?: boolean | null
          professional_id?: string | null
          professional_name_raw?: string | null
          recurrence?: Json
          reminders?: Json
          session_attendance?: string | null
          session_plan?: Json | null
          session_type?: string | null
          start_at?: string
          status?: string
          therapist_id?: string | null
          title?: string
          type?: string
          type_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_notification_prefs: {
        Row: {
          onboarding_completed: boolean
          one_day_before: boolean
          one_hour_before: boolean
          pending_observations: boolean
          post_event_register: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          onboarding_completed?: boolean
          one_day_before?: boolean
          one_hour_before?: boolean
          pending_observations?: boolean
          post_event_register?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          onboarding_completed?: boolean
          one_day_before?: boolean
          one_hour_before?: boolean
          pending_observations?: boolean
          post_event_register?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agenda_notifications: {
        Row: {
          actioned_at: string | null
          body: string
          created_at: string
          deep_link: string
          event_id: string | null
          fire_at: string
          id: string
          kind: string
          observation_ids: string[] | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actioned_at?: string | null
          body: string
          created_at?: string
          deep_link: string
          event_id?: string | null
          fire_at: string
          id?: string
          kind: string
          observation_ids?: string[] | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actioned_at?: string | null
          body?: string
          created_at?: string
          deep_link?: string
          event_id?: string | null
          fire_at?: string
          id?: string
          kind?: string
          observation_ids?: string[] | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_observation_attachments: {
        Row: {
          created_at: string
          duration_seconds: number | null
          filename: string
          id: string
          kind: string
          mime_type: string
          observation_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          filename: string
          id?: string
          kind: string
          mime_type: string
          observation_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          filename?: string
          id?: string
          kind?: string
          mime_type?: string
          observation_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_observation_attachments_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "agenda_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_observations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          promoted_to_record_id: string | null
          reminder_dismissed: boolean
          reminder_enabled: boolean
          reminder_fire_at: string | null
          reminder_target_event_id: string | null
          reminder_target_professional_id: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          promoted_to_record_id?: string | null
          reminder_dismissed?: boolean
          reminder_enabled?: boolean
          reminder_fire_at?: string | null
          reminder_target_event_id?: string | null
          reminder_target_professional_id?: string | null
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          promoted_to_record_id?: string | null
          reminder_dismissed?: boolean
          reminder_enabled?: boolean
          reminder_fire_at?: string | null
          reminder_target_event_id?: string | null
          reminder_target_professional_id?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_observations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_observations_promoted_to_record_id_fkey"
            columns: ["promoted_to_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_observations_reminder_target_event_id_fkey"
            columns: ["reminder_target_event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_observations_reminder_target_professional_id_fkey"
            columns: ["reminder_target_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          module: string | null
          properties: Json
          route: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          module?: string | null
          properties?: Json
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          module?: string | null
          properties?: Json
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          category: string
          child_id: string
          content: string
          created_at: string
          id: string
          professional_id: string | null
          professional_name: string
          record_date: string
          record_type: string | null
          shift: string | null
          title: string | null
          type_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          child_id: string
          content: string
          created_at?: string
          id?: string
          professional_id?: string | null
          professional_name: string
          record_date: string
          record_type?: string | null
          shift?: string | null
          title?: string | null
          type_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          child_id?: string
          content?: string
          created_at?: string
          id?: string
          professional_id?: string | null
          professional_name?: string
          record_date?: string
          record_type?: string | null
          shift?: string | null
          title?: string | null
          type_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      care_access: {
        Row: {
          alias: string
          caregiver_id: string
          child_id: string
          created_at: string
          granted_at: string
          id: string
          invite_id: string
          owner_id: string
          relation: string
          revoked_at: string | null
          role: string
          status: string
        }
        Insert: {
          alias: string
          caregiver_id: string
          child_id: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id: string
          owner_id: string
          relation: string
          revoked_at?: string | null
          role: string
          status?: string
        }
        Update: {
          alias?: string
          caregiver_id?: string
          child_id?: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id?: string
          owner_id?: string
          relation?: string
          revoked_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_access_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "care_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      care_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          approved_at: string | null
          child_id: string
          created_at: string
          denied_at: string | null
          expires_at: string
          id: string
          invitee_alias: string
          invitee_email: string
          owner_id: string
          relation: string
          revoked_at: string | null
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          approved_at?: string | null
          child_id: string
          created_at?: string
          denied_at?: string | null
          expires_at: string
          id?: string
          invitee_alias: string
          invitee_email: string
          owner_id: string
          relation: string
          revoked_at?: string | null
          role?: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          approved_at?: string | null
          child_id?: string
          created_at?: string
          denied_at?: string | null
          expires_at?: string
          id?: string
          invitee_alias?: string
          invitee_email?: string
          owner_id?: string
          relation?: string
          revoked_at?: string | null
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_invites_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      child_attachments: {
        Row: {
          child_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          title: string | null
          user_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          title?: string | null
          user_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_attachments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          birth_date: string
          created_at: string
          created_by_type: string
          diagnoses: Json
          diagnosis: string | null
          guardian_info: Json | null
          id: string
          name: string
          relation: string | null
          user_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          created_by_type?: string
          diagnoses?: Json
          diagnosis?: string | null
          guardian_info?: Json | null
          id?: string
          name: string
          relation?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          created_by_type?: string
          diagnoses?: Json
          diagnosis?: string | null
          guardian_info?: Json | null
          id?: string
          name?: string
          relation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          specialty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          specialty: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          specialty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          phone: string | null
          secondary_role: string | null
          terms_accepted_at: string | null
          user_type: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          phone?: string | null
          secondary_role?: string | null
          terms_accepted_at?: string | null
          user_type?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          phone?: string | null
          secondary_role?: string | null
          terms_accepted_at?: string | null
          user_type?: string
        }
        Relationships: []
      }
      record_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          record_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          record_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          record_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      session_records: {
        Row: {
          approach_adjustment: string | null
          child_id: string
          clinical_observations: string | null
          created_at: string
          engagement_level: string | null
          event_id: string
          family_instruction: string | null
          frequency_suggestion: string | null
          goals_achieved: Json
          id: string
          is_draft: boolean
          is_private: boolean
          notable_behaviors: Json
          points_to_continue: string | null
          published_at: string | null
          therapist_id: string
          updated_at: string
          what_was_done: string | null
        }
        Insert: {
          approach_adjustment?: string | null
          child_id: string
          clinical_observations?: string | null
          created_at?: string
          engagement_level?: string | null
          event_id: string
          family_instruction?: string | null
          frequency_suggestion?: string | null
          goals_achieved?: Json
          id?: string
          is_draft?: boolean
          is_private?: boolean
          notable_behaviors?: Json
          points_to_continue?: string | null
          published_at?: string | null
          therapist_id: string
          updated_at?: string
          what_was_done?: string | null
        }
        Update: {
          approach_adjustment?: string | null
          child_id?: string
          clinical_observations?: string | null
          created_at?: string
          engagement_level?: string | null
          event_id?: string
          family_instruction?: string | null
          frequency_suggestion?: string | null
          goals_achieved?: Json
          id?: string
          is_draft?: boolean
          is_private?: boolean
          notable_behaviors?: Json
          points_to_continue?: string | null
          published_at?: string | null
          therapist_id?: string
          updated_at?: string
          what_was_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      share_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          share_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          share_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          share_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_items_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "shares"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          last_renewed_at: string | null
          link_token: string | null
          otp_attempts: number
          otp_expires_at: string | null
          otp_hash: string | null
          professional_id: string
          renewals_count: number
          revoked_at: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_renewed_at?: string | null
          link_token?: string | null
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          professional_id: string
          renewals_count?: number
          revoked_at?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_renewed_at?: string | null
          link_token?: string | null
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          professional_id?: string
          renewals_count?: number
          revoked_at?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      therapist_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          child_id: string
          created_at: string
          expires_at: string
          id: string
          invitee_alias: string
          invitee_email: string
          relation: string
          revoked_at: string | null
          status: string
          therapist_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_alias: string
          invitee_email: string
          relation: string
          revoked_at?: string | null
          status?: string
          therapist_id: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_alias?: string
          invitee_email?: string
          relation?: string
          revoked_at?: string | null
          status?: string
          therapist_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invites_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_parent_access: {
        Row: {
          alias: string
          child_id: string
          created_at: string
          granted_at: string
          id: string
          invite_id: string
          parent_id: string
          relation: string
          revoked_at: string | null
          status: string
          therapist_id: string
        }
        Insert: {
          alias: string
          child_id: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id: string
          parent_id: string
          relation: string
          revoked_at?: string | null
          status?: string
          therapist_id: string
        }
        Update: {
          alias?: string
          child_id?: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id?: string
          parent_id?: string
          relation?: string
          revoked_at?: string | null
          status?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_parent_access_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_parent_access_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "therapist_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profiles: {
        Row: {
          attendance_modality: string | null
          attendance_setting: string | null
          bio: string | null
          council_number: string
          council_state: string
          council_type: string
          created_at: string
          id: string
          patient_count_range: string | null
          specialty: string
          updated_at: string
          user_id: string
          weekly_hours_range: string | null
        }
        Insert: {
          attendance_modality?: string | null
          attendance_setting?: string | null
          bio?: string | null
          council_number: string
          council_state: string
          council_type: string
          created_at?: string
          id?: string
          patient_count_range?: string | null
          specialty: string
          updated_at?: string
          user_id: string
          weekly_hours_range?: string | null
        }
        Update: {
          attendance_modality?: string | null
          attendance_setting?: string | null
          bio?: string | null
          council_number?: string
          council_state?: string
          council_type?: string
          created_at?: string
          id?: string
          patient_count_range?: string | null
          specialty?: string
          updated_at?: string
          user_id?: string
          weekly_hours_range?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_care_access: { Args: { p_child_id: string }; Returns: boolean }
      has_therapist_parent_access: {
        Args: { p_child_id: string }
        Returns: boolean
      }
      schedule_agenda_notifications: { Args: never; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
