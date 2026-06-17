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
          series_id: string | null
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
          series_id?: string | null
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
          series_id?: string | null
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
          token_hash: string
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
          token_hash: string
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
          token_hash?: string
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
          category: string | null
          category_description: string | null
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
          category?: string | null
          category_description?: string | null
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
          category?: string | null
          category_description?: string | null
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
      clinic_communications: {
        Row: {
          clinic_id: string
          comm_type: string
          confirmation_ip_hash: string | null
          confirmed_at: string | null
          created_at: string
          escalated_at: string | null
          escalated_to: string | null
          id: string
          patient_profile_id: string | null
          queue_entry_id: string | null
          response_deadline: string | null
          sent_at: string
          status: string
          token_id: string | null
        }
        Insert: {
          clinic_id: string
          comm_type: string
          confirmation_ip_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          patient_profile_id?: string | null
          queue_entry_id?: string | null
          response_deadline?: string | null
          sent_at?: string
          status?: string
          token_id?: string | null
        }
        Update: {
          clinic_id?: string
          comm_type?: string
          confirmation_ip_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          patient_profile_id?: string | null
          queue_entry_id?: string | null
          response_deadline?: string | null
          sent_at?: string
          status?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_communications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_communications_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_communications_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_communications_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "clinic_form_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_form_tokens: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string
          expires_at: string
          form_type: string
          id: string
          payload: Json | null
          queue_entry_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by: string
          expires_at?: string
          form_type: string
          id?: string
          payload?: Json | null
          queue_entry_id?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string
          form_type?: string
          id?: string
          payload?: Json | null
          queue_entry_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_form_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_form_tokens_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_group_members: {
        Row: {
          clinic_group_id: string
          exception_justification: string | null
          id: string
          joined_at: string
          leave_reason: string | null
          left_at: string | null
          patient_profile_id: string
        }
        Insert: {
          clinic_group_id: string
          exception_justification?: string | null
          id?: string
          joined_at?: string
          leave_reason?: string | null
          left_at?: string | null
          patient_profile_id: string
        }
        Update: {
          clinic_group_id?: string
          exception_justification?: string | null
          id?: string
          joined_at?: string
          leave_reason?: string | null
          left_at?: string | null
          patient_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_group_members_clinic_group_id_fkey"
            columns: ["clinic_group_id"]
            isOneToOne: false
            referencedRelation: "clinic_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_group_members_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_groups: {
        Row: {
          capacity_max: number
          clinic_id: string
          created_at: string
          day_of_week: number
          duration_minutes: number
          id: string
          matching_criteria: Json
          name: string
          room_id: string
          start_time: string
          status: string
          therapist_user_id: string
          updated_at: string
        }
        Insert: {
          capacity_max?: number
          clinic_id: string
          created_at?: string
          day_of_week: number
          duration_minutes?: number
          id?: string
          matching_criteria?: Json
          name: string
          room_id: string
          start_time: string
          status?: string
          therapist_user_id: string
          updated_at?: string
        }
        Update: {
          capacity_max?: number
          clinic_id?: string
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          id?: string
          matching_criteria?: Json
          name?: string
          room_id?: string
          start_time?: string
          status?: string
          therapist_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_groups_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "clinic_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          role: string
          token: string
          used_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          role: string
          token?: string
          used_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          id: string
          invited_at: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_payment_records: {
        Row: {
          amount_cents: number | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          patient_profile_id: string
          payment_type: string
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          patient_profile_id: string
          payment_type: string
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          patient_profile_id?: string
          payment_type?: string
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_payment_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_payment_records_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_recurring_schedules: {
        Row: {
          active: boolean | null
          clinic_id: string
          created_at: string | null
          day_of_week: number
          duration_minutes: number | null
          ends_on: string | null
          id: string
          patient_name: string
          queue_entry_id: string | null
          room_id: string
          session_type: string | null
          start_time: string
          starts_on: string
          therapist_user_id: string
        }
        Insert: {
          active?: boolean | null
          clinic_id: string
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number | null
          ends_on?: string | null
          id?: string
          patient_name: string
          queue_entry_id?: string | null
          room_id: string
          session_type?: string | null
          start_time: string
          starts_on: string
          therapist_user_id: string
        }
        Update: {
          active?: boolean | null
          clinic_id?: string
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          ends_on?: string | null
          id?: string
          patient_name?: string
          queue_entry_id?: string | null
          room_id?: string
          session_type?: string | null
          start_time?: string
          starts_on?: string
          therapist_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_recurring_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_recurring_schedules_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_recurring_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "clinic_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_replacements: {
        Row: {
          clinic_id: string
          communication_id: string | null
          created_at: string | null
          deadline_date: string
          event_type: string
          id: string
          original_session_id: string
          patient_name: string
          replacement_session_id: string | null
          status: string | null
          therapist_user_id: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          communication_id?: string | null
          created_at?: string | null
          deadline_date: string
          event_type: string
          id?: string
          original_session_id: string
          patient_name: string
          replacement_session_id?: string | null
          status?: string | null
          therapist_user_id: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          communication_id?: string | null
          created_at?: string | null
          deadline_date?: string
          event_type?: string
          id?: string
          original_session_id?: string
          patient_name?: string
          replacement_session_id?: string | null
          status?: string | null
          therapist_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_replacements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_replacements_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "clinic_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_replacements_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "clinic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_replacements_replacement_session_id_fkey"
            columns: ["replacement_session_id"]
            isOneToOne: false
            referencedRelation: "clinic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_rooms: {
        Row: {
          active: boolean | null
          capacity: number | null
          clinic_id: string
          created_at: string | null
          id: string
          name: string
          resources: string[] | null
        }
        Insert: {
          active?: boolean | null
          capacity?: number | null
          clinic_id: string
          created_at?: string | null
          id?: string
          name: string
          resources?: string[] | null
        }
        Update: {
          active?: boolean | null
          capacity?: number | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          name?: string
          resources?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_sessions: {
        Row: {
          clinic_id: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          insurance_authorization_id: string | null
          notes: string | null
          patient_name: string
          recurring_schedule_id: string | null
          room_id: string
          session_date: string
          session_type: string | null
          start_time: string
          status: string | null
          therapist_user_id: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          insurance_authorization_id?: string | null
          notes?: string | null
          patient_name: string
          recurring_schedule_id?: string | null
          room_id: string
          session_date: string
          session_type?: string | null
          start_time: string
          status?: string | null
          therapist_user_id: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          insurance_authorization_id?: string | null
          notes?: string | null
          patient_name?: string
          recurring_schedule_id?: string | null
          room_id?: string
          session_date?: string
          session_type?: string | null
          start_time?: string
          status?: string | null
          therapist_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_sessions_insurance_authorization_id_fkey"
            columns: ["insurance_authorization_id"]
            isOneToOne: false
            referencedRelation: "insurance_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_sessions_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "clinic_recurring_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "clinic_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_therapist_absences: {
        Row: {
          absence_type: string
          affected_times: Json | null
          clinic_id: string
          created_at: string | null
          created_by: string
          ends_on: string
          id: string
          notes: string | null
          partial: boolean | null
          sessions_cancelled: number | null
          starts_on: string
          therapist_user_id: string
        }
        Insert: {
          absence_type: string
          affected_times?: Json | null
          clinic_id: string
          created_at?: string | null
          created_by: string
          ends_on: string
          id?: string
          notes?: string | null
          partial?: boolean | null
          sessions_cancelled?: number | null
          starts_on: string
          therapist_user_id: string
        }
        Update: {
          absence_type?: string
          affected_times?: Json | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string
          ends_on?: string
          id?: string
          notes?: string | null
          partial?: boolean | null
          sessions_cancelled?: number | null
          starts_on?: string
          therapist_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_therapist_absences_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_therapist_availability: {
        Row: {
          clinic_id: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_therapist_availability_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: Json
          clinic_plan: string
          cnpj: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          services: string[]
          slug: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          clinic_plan?: string
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          services?: string[]
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          clinic_plan?: string
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          services?: string[]
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_goals: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          mastery_criterion: string
          objective: string
          priority: number | null
          report_id: string
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          mastery_criterion: string
          objective: string
          priority?: number | null
          report_id: string
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          mastery_criterion?: string
          objective?: string
          priority?: number | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_goals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_reports: {
        Row: {
          behavior_challenges: Json | null
          clinic_id: string
          clinical_justification: string | null
          created_at: string | null
          evaluation_dates: string[]
          fba_conducted: boolean | null
          finalized_at: string | null
          functional_profile: Json | null
          id: string
          initial_goals: Json | null
          instruments: string[]
          queue_entry_id: string
          recommended_hours_per_week: number | null
          recommended_modality: string[] | null
          session_duration_minutes: number | null
          sessions_count: number | null
          sessions_per_week: number | null
          status: string | null
          therapist_user_id: string
          updated_at: string | null
          vbmapp_barriers: Json | null
          vbmapp_domains: Json | null
          vbmapp_level: number | null
        }
        Insert: {
          behavior_challenges?: Json | null
          clinic_id: string
          clinical_justification?: string | null
          created_at?: string | null
          evaluation_dates?: string[]
          fba_conducted?: boolean | null
          finalized_at?: string | null
          functional_profile?: Json | null
          id?: string
          initial_goals?: Json | null
          instruments?: string[]
          queue_entry_id: string
          recommended_hours_per_week?: number | null
          recommended_modality?: string[] | null
          session_duration_minutes?: number | null
          sessions_count?: number | null
          sessions_per_week?: number | null
          status?: string | null
          therapist_user_id: string
          updated_at?: string | null
          vbmapp_barriers?: Json | null
          vbmapp_domains?: Json | null
          vbmapp_level?: number | null
        }
        Update: {
          behavior_challenges?: Json | null
          clinic_id?: string
          clinical_justification?: string | null
          created_at?: string | null
          evaluation_dates?: string[]
          fba_conducted?: boolean | null
          finalized_at?: string | null
          functional_profile?: Json | null
          id?: string
          initial_goals?: Json | null
          instruments?: string[]
          queue_entry_id?: string
          recommended_hours_per_week?: number | null
          recommended_modality?: string[] | null
          session_duration_minutes?: number | null
          sessions_count?: number | null
          sessions_per_week?: number | null
          status?: string | null
          therapist_user_id?: string
          updated_at?: string | null
          vbmapp_barriers?: Json | null
          vbmapp_domains?: Json | null
          vbmapp_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_reports_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
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
      insurance_authorizations: {
        Row: {
          archived: boolean
          authorization_number: string
          clinic_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          insurance_plan: string
          notes: string | null
          patient_profile_id: string
          sessions_authorized: number
          sessions_remaining: number | null
          sessions_used: number
          status: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          archived?: boolean
          authorization_number: string
          clinic_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          insurance_plan: string
          notes?: string | null
          patient_profile_id: string
          sessions_authorized: number
          sessions_remaining?: number | null
          sessions_used?: number
          status?: string
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          archived?: boolean
          authorization_number?: string
          clinic_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          insurance_plan?: string
          notes?: string | null
          patient_profile_id?: string
          sessions_authorized?: number
          sessions_remaining?: number | null
          sessions_used?: number
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_authorizations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_authorizations_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_goals: {
        Row: {
          achieved_at: string | null
          child_id: string
          created_at: string
          description: string | null
          id: string
          milestone_id: string
          status: string
          therapist_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          child_id: string
          created_at?: string
          description?: string | null
          id?: string
          milestone_id: string
          status?: string
          therapist_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          child_id?: string
          created_at?: string
          description?: string | null
          id?: string
          milestone_id?: string
          status?: string
          therapist_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_goals_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_communications: {
        Row: {
          child_id: string
          content: string
          created_at: string
          id: string
          therapist_id: string
        }
        Insert: {
          child_id: string
          content: string
          created_at?: string
          id?: string
          therapist_id: string
        }
        Update: {
          child_id?: string
          content?: string
          created_at?: string
          id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_communications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_event_reminders: {
        Row: {
          created_at: string
          event_id: string
          id: string
          one_day_before: boolean
          one_hour_before: boolean
          parent_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          one_day_before?: boolean
          one_hour_before?: boolean
          parent_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          one_day_before?: boolean
          one_hour_before?: boolean
          parent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_professional_access: {
        Row: {
          child_id: string
          created_at: string
          granted_at: string
          id: string
          invite_id: string | null
          parent_id: string
          professional_id: string
          revoked_at: string | null
          status: string
        }
        Insert: {
          child_id: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id?: string | null
          parent_id: string
          professional_id: string
          revoked_at?: string | null
          status?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          granted_at?: string
          id?: string
          invite_id?: string | null
          parent_id?: string
          professional_id?: string
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_professional_access_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_professional_access_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "parent_professional_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_professional_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          child_id: string
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          invitee_name: string | null
          parent_id: string
          revoked_at: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email: string
          invitee_name?: string | null
          parent_id: string
          revoked_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          invitee_name?: string | null
          parent_id?: string
          revoked_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_professional_invites_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_professional_messages: {
        Row: {
          access_id: string
          author_id: string
          author_type: string
          content: string
          created_at: string
          id: string
          read_at: string | null
        }
        Insert: {
          access_id: string
          author_id: string
          author_type: string
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
        }
        Update: {
          access_id?: string
          author_id?: string
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_professional_messages_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "parent_professional_access"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_profiles: {
        Row: {
          address: Json | null
          approved_at: string | null
          approved_by: string | null
          child_birthdate: string
          child_cpf: string | null
          child_full_name: string
          clinic_id: string
          comorbidities: string[] | null
          consent_date: string | null
          consent_given: boolean | null
          created_at: string | null
          current_professionals: Json | null
          diagnosis_family_report: string | null
          emergency_contacts: Json | null
          evaluation_report_id: string | null
          expectations: string | null
          family_routine: string | null
          guardians: Json
          id: string
          insurance_data: Json | null
          other_professionals: Json | null
          payment_type: string | null
          queue_entry_id: string
          school_info: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          child_birthdate: string
          child_cpf?: string | null
          child_full_name: string
          clinic_id: string
          comorbidities?: string[] | null
          consent_date?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          current_professionals?: Json | null
          diagnosis_family_report?: string | null
          emergency_contacts?: Json | null
          evaluation_report_id?: string | null
          expectations?: string | null
          family_routine?: string | null
          guardians?: Json
          id?: string
          insurance_data?: Json | null
          other_professionals?: Json | null
          payment_type?: string | null
          queue_entry_id: string
          school_info?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          child_birthdate?: string
          child_cpf?: string | null
          child_full_name?: string
          clinic_id?: string
          comorbidities?: string[] | null
          consent_date?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          current_professionals?: Json | null
          diagnosis_family_report?: string | null
          emergency_contacts?: Json | null
          evaluation_report_id?: string | null
          expectations?: string | null
          family_routine?: string | null
          guardians?: Json
          id?: string
          insurance_data?: Json | null
          other_professionals?: Json | null
          payment_type?: string | null
          queue_entry_id?: string
          school_info?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_profiles_evaluation_report_id_fkey"
            columns: ["evaluation_report_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_profiles_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
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
          parent_plan: string
          phone: string | null
          secondary_role: string | null
          terms_accepted_at: string | null
          therapist_plan: string
          user_type: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          parent_plan?: string
          phone?: string | null
          secondary_role?: string | null
          terms_accepted_at?: string | null
          therapist_plan?: string
          user_type?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          parent_plan?: string
          phone?: string | null
          secondary_role?: string | null
          terms_accepted_at?: string | null
          therapist_plan?: string
          user_type?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          child_birthdate: string
          child_cid: string | null
          child_diagnosis: string | null
          child_name: string
          clinic_id: string
          created_at: string
          disponibilidade: Json
          factor_a: Json
          factor_b: Json
          factor_c: Json
          form_payload: Json
          id: string
          modalidades: string[]
          priority_score: number
          priority_tier: string
          responsavel_email: string
          responsavel_nome: string
          responsavel_telefone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          child_birthdate: string
          child_cid?: string | null
          child_diagnosis?: string | null
          child_name: string
          clinic_id: string
          created_at?: string
          disponibilidade?: Json
          factor_a?: Json
          factor_b?: Json
          factor_c?: Json
          form_payload?: Json
          id?: string
          modalidades?: string[]
          priority_score?: number
          priority_tier?: string
          responsavel_email: string
          responsavel_nome: string
          responsavel_telefone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          child_birthdate?: string
          child_cid?: string | null
          child_diagnosis?: string | null
          child_name?: string
          clinic_id?: string
          created_at?: string
          disponibilidade?: Json
          factor_a?: Json
          factor_b?: Json
          factor_c?: Json
          form_payload?: Json
          id?: string
          modalidades?: string[]
          priority_score?: number
          priority_tier?: string
          responsavel_email?: string
          responsavel_nome?: string
          responsavel_telefone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_history: {
        Row: {
          change_type: string
          changed_by: string | null
          clinic_id: string
          created_at: string
          entry_id: string
          id: string
          justificativa: string | null
          new_score: number | null
          new_tier: string | null
          old_score: number | null
          old_tier: string | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          entry_id: string
          id?: string
          justificativa?: string | null
          new_score?: number | null
          new_tier?: string | null
          old_score?: number | null
          old_tier?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          justificativa?: string | null
          new_score?: number | null
          new_tier?: string | null
          old_score?: number | null
          old_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_history_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_priority_config: {
        Row: {
          clinic_id: string
          id: string
          tier_alta_min: number
          tier_moderada_min: number
          updated_at: string
          weight_factor_a: number
          weight_factor_b: number
          weight_factor_c: number
          weight_time: number
        }
        Insert: {
          clinic_id: string
          id?: string
          tier_alta_min?: number
          tier_moderada_min?: number
          updated_at?: string
          weight_factor_a?: number
          weight_factor_b?: number
          weight_factor_c?: number
          weight_time?: number
        }
        Update: {
          clinic_id?: string
          id?: string
          tier_alta_min?: number
          tier_moderada_min?: number
          updated_at?: string
          weight_factor_a?: number
          weight_factor_b?: number
          weight_factor_c?: number
          weight_time?: number
        }
        Relationships: [
          {
            foreignKeyName: "queue_priority_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
          next_session_event_id: string | null
          notable_behaviors: Json
          points_to_continue: string | null
          professional_observations: Json
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
          next_session_event_id?: string | null
          notable_behaviors?: Json
          points_to_continue?: string | null
          professional_observations?: Json
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
          next_session_event_id?: string | null
          notable_behaviors?: Json
          points_to_continue?: string | null
          professional_observations?: Json
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
          {
            foreignKeyName: "session_records_next_session_event_id_fkey"
            columns: ["next_session_event_id"]
            isOneToOne: false
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
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          scope: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          scope: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          scope?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapeutic_milestones: {
        Row: {
          achieved_at: string | null
          area: string
          child_id: string
          created_at: string
          description: string | null
          id: string
          is_shared_with_parents: boolean
          parent_celebrated_at: string | null
          started_at: string
          status: string
          therapist_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          area: string
          child_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_shared_with_parents?: boolean
          parent_celebrated_at?: string | null
          started_at?: string
          status?: string
          therapist_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          area?: string
          child_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_shared_with_parents?: boolean
          parent_celebrated_at?: string | null
          started_at?: string
          status?: string
          therapist_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapeutic_milestones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
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
          token_hash: string
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
          token_hash: string
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
          token_hash?: string
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
      user_sessions: {
        Row: {
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          ip: string | null
          last_seen_at: string
          session_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          session_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          session_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
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
      has_care_access: { Args: { p_child_id: string }; Returns: boolean }
      has_therapist_parent_access: {
        Args: { p_child_id: string }
        Returns: boolean
      }
      is_clinic_coordinator: { Args: { p_clinic_id: string }; Returns: boolean }
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean }
      purge_old_audit_logs: { Args: never; Returns: undefined }
      purge_old_user_sessions: { Args: never; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
