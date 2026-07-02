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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_router_config: {
        Row: {
          auth_secret_ref: string | null
          created_at: string
          customer_id: string
          enabled: boolean
          endpoint_url: string | null
          id: string
          manual_review_destination: string | null
          retry_backoff_seconds: number
          retry_max: number
          updated_at: string
          vendor_priority: Json
        }
        Insert: {
          auth_secret_ref?: string | null
          created_at?: string
          customer_id: string
          enabled?: boolean
          endpoint_url?: string | null
          id?: string
          manual_review_destination?: string | null
          retry_backoff_seconds?: number
          retry_max?: number
          updated_at?: string
          vendor_priority?: Json
        }
        Update: {
          auth_secret_ref?: string | null
          created_at?: string
          customer_id?: string
          enabled?: boolean
          endpoint_url?: string | null
          id?: string
          manual_review_destination?: string | null
          retry_backoff_seconds?: number
          retry_max?: number
          updated_at?: string
          vendor_priority?: Json
        }
        Relationships: [
          {
            foreignKeyName: "action_router_config_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_password_override: {
        Row: {
          id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          id?: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          location_id: string | null
          name: string
          system_prompt: string | null
          type: Database["public"]["Enums"]["agent_type"]
          updated_at: string
          workflow_config_json: Json
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          location_id?: string | null
          name: string
          system_prompt?: string | null
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          workflow_config_json?: Json
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          location_id?: string | null
          name?: string
          system_prompt?: string | null
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          workflow_config_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          action: string
          actor_user_id: string | null
          agent_id: string | null
          call_id: string | null
          created_at: string
          customer_id: string | null
          decision: string | null
          id: string
          metadata: Json
          model: string
          model_version: string | null
          rationale: string | null
          resource_id: string | null
          resource_type: string | null
          risk_level: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: string | null
          id?: string
          metadata?: Json
          model: string
          model_version?: string | null
          rationale?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_level?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: string | null
          id?: string
          metadata?: Json
          model?: string
          model_version?: string | null
          rationale?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          created_at: string
          customer_id: string
          daily_token_cap: number
          id: string
          request_count: number
          tokens_used: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          daily_token_cap?: number
          id?: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          daily_token_cap?: number
          id?: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_invocations: {
        Row: {
          agent_id: string | null
          block_reason: string | null
          call_id: string | null
          created_at: string
          customer_id: string | null
          decision: string
          id: string
          outcome: Json
          risk_level: string
          sanitized_params: Json
          tool_name: string
        }
        Insert: {
          agent_id?: string | null
          block_reason?: string | null
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: string
          id?: string
          outcome?: Json
          risk_level?: string
          sanitized_params?: Json
          tool_name: string
        }
        Update: {
          agent_id?: string | null
          block_reason?: string | null
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: string
          id?: string
          outcome?: Json
          risk_level?: string
          sanitized_params?: Json
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_invocations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_invocations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string | null
          payload: Json
          stripe_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json
          stripe_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          attempt_count: number
          billing_period: string
          created_at: string
          currency: string
          finalized_at: string | null
          id: string
          last_error: string | null
          organization_id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          total_cents: number
          total_seconds: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          billing_period: string
          created_at?: string
          currency?: string
          finalized_at?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total_cents?: number
          total_seconds?: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          billing_period?: string
          created_at?: string
          currency?: string
          finalized_at?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total_cents?: number
          total_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_vault: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          source_url: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          source_url?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          source_url?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          agent_id: string | null
          ai_resolved: boolean
          caller_name: string | null
          created_at: string
          customer_id: string
          customer_phone: string | null
          duration_sec: number | null
          ended_at: string | null
          error_code: string | null
          id: string
          intent: string | null
          location_id: string | null
          outcome: string | null
          recording_url: string | null
          serial_number: string | null
          started_at: string | null
          transcript_url: string | null
          transferred_to_human: boolean
          twilio_number: string | null
        }
        Insert: {
          agent_id?: string | null
          ai_resolved?: boolean
          caller_name?: string | null
          created_at?: string
          customer_id: string
          customer_phone?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          error_code?: string | null
          id?: string
          intent?: string | null
          location_id?: string | null
          outcome?: string | null
          recording_url?: string | null
          serial_number?: string | null
          started_at?: string | null
          transcript_url?: string | null
          transferred_to_human?: boolean
          twilio_number?: string | null
        }
        Update: {
          agent_id?: string | null
          ai_resolved?: boolean
          caller_name?: string | null
          created_at?: string
          customer_id?: string
          customer_phone?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          error_code?: string | null
          id?: string
          intent?: string | null
          location_id?: string | null
          outcome?: string | null
          recording_url?: string | null
          serial_number?: string | null
          started_at?: string | null
          transcript_url?: string | null
          transferred_to_human?: boolean
          twilio_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_program_reviews: {
        Row: {
          cadence: string
          created_at: string
          evidence_url: string | null
          findings: string | null
          id: string
          next_due: string | null
          outcome: string
          reviewed_at: string
          reviewer_name: string
          reviewer_role: string
          scope: string
        }
        Insert: {
          cadence: string
          created_at?: string
          evidence_url?: string | null
          findings?: string | null
          id?: string
          next_due?: string | null
          outcome: string
          reviewed_at?: string
          reviewer_name: string
          reviewer_role: string
          scope: string
        }
        Update: {
          cadence?: string
          created_at?: string
          evidence_url?: string | null
          findings?: string | null
          id?: string
          next_due?: string | null
          outcome?: string
          reviewed_at?: string
          reviewer_name?: string
          reviewer_role?: string
          scope?: string
        }
        Relationships: []
      }
      compliance_settings: {
        Row: {
          ada_accessibility: boolean
          audit_trail_logging: boolean
          call_recording_consent_required: boolean
          created_at: string
          customer_id: string
          data_retention_hours: number
          gdpr_minimization: boolean
          hipaa_phi_redaction: boolean
          opt_out_handling: boolean
          pci_dss_billing: boolean
          pii_scrubbing: boolean
          prompt_injection_defense_enabled: boolean
          tcpa_compliance: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ada_accessibility?: boolean
          audit_trail_logging?: boolean
          call_recording_consent_required?: boolean
          created_at?: string
          customer_id: string
          data_retention_hours?: number
          gdpr_minimization?: boolean
          hipaa_phi_redaction?: boolean
          opt_out_handling?: boolean
          pci_dss_billing?: boolean
          pii_scrubbing?: boolean
          prompt_injection_defense_enabled?: boolean
          tcpa_compliance?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ada_accessibility?: boolean
          audit_trail_logging?: boolean
          call_recording_consent_required?: boolean
          created_at?: string
          customer_id?: string
          data_retention_hours?: number
          gdpr_minimization?: boolean
          hipaa_phi_redaction?: boolean
          opt_out_handling?: boolean
          pci_dss_billing?: boolean
          pii_scrubbing?: boolean
          prompt_injection_defense_enabled?: boolean
          tcpa_compliance?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_settings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          captured_at: string
          captured_by: string | null
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string
          evidence_hash: string | null
          evidence_url: string | null
          expires_at: string | null
          id: string
          notes: string | null
          revoked_at: string | null
          source: Database["public"]["Enums"]["consent_source"]
          status: Database["public"]["Enums"]["consent_status"]
          updated_at: string
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          evidence_hash?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          source?: Database["public"]["Enums"]["consent_source"]
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          evidence_hash?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          source?: Database["public"]["Enums"]["consent_source"]
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          reason?: string
        }
        Relationships: []
      }
      content_lab_settings: {
        Row: {
          created_at: string
          id: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_outcome: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      content_queue: {
        Row: {
          blog_body: string | null
          category: string
          created_at: string
          facebook_body: string | null
          id: string
          image_url: string | null
          last_attempt_at: string | null
          last_error: string | null
          linkedin_hook: string | null
          platform_targets: Json
          post_type: string
          published_at: string | null
          scheduled_at: string | null
          seo_metadata: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blog_body?: string | null
          category?: string
          created_at?: string
          facebook_body?: string | null
          id?: string
          image_url?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          linkedin_hook?: string | null
          platform_targets?: Json
          post_type?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_metadata?: Json
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          blog_body?: string | null
          category?: string
          created_at?: string
          facebook_body?: string | null
          id?: string
          image_url?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          linkedin_hook?: string | null
          platform_targets?: Json
          post_type?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo_metadata?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      control_library: {
        Row: {
          category: string
          code: string
          control_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          implementation_ref: string | null
          name: string
          operating_status: string
        }
        Insert: {
          category: string
          code: string
          control_type?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          implementation_ref?: string | null
          name: string
          operating_status?: string
        }
        Update: {
          category?: string
          code?: string
          control_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          implementation_ref?: string | null
          name?: string
          operating_status?: string
        }
        Relationships: []
      }
      control_mappings: {
        Row: {
          control_code: string
          coverage_level: string
          created_at: string
          id: string
          notes: string | null
          regulation_code: string
          requirement_ref: string
          requirement_text: string
        }
        Insert: {
          control_code: string
          coverage_level?: string
          created_at?: string
          id?: string
          notes?: string | null
          regulation_code: string
          requirement_ref: string
          requirement_text: string
        }
        Update: {
          control_code?: string
          coverage_level?: string
          created_at?: string
          id?: string
          notes?: string | null
          regulation_code?: string
          requirement_ref?: string
          requirement_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_mappings_control_code_fkey"
            columns: ["control_code"]
            isOneToOne: false
            referencedRelation: "control_library"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "control_mappings_regulation_code_fkey"
            columns: ["regulation_code"]
            isOneToOne: false
            referencedRelation: "regulation_registry"
            referencedColumns: ["code"]
          },
        ]
      }
      customer_compliance_annexes: {
        Row: {
          customer_id: string
          customer_obligations: string
          generated_at: string
          generated_by: string | null
          id: string
          in_scope_regulations: string[]
          out_of_scope_notes: string | null
          phaos_supporting_controls: string
          version: number
        }
        Insert: {
          customer_id: string
          customer_obligations: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          in_scope_regulations?: string[]
          out_of_scope_notes?: string | null
          phaos_supporting_controls: string
          version?: number
        }
        Update: {
          customer_id?: string
          customer_obligations?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          in_scope_regulations?: string[]
          out_of_scope_notes?: string | null
          phaos_supporting_controls?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_compliance_annexes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          primary_contact_email: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          primary_contact_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          primary_contact_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          agent_id: string | null
          call_id: string | null
          created_at: string
          customer_id: string
          dispatch_id: string | null
          error_code: string | null
          eta_minutes: number | null
          id: string
          location_id: string | null
          priority: string | null
          serial_number: string | null
          status: string | null
          technician_name: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_id: string
          dispatch_id?: string | null
          error_code?: string | null
          eta_minutes?: number | null
          id?: string
          location_id?: string | null
          priority?: string | null
          serial_number?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_id?: string
          dispatch_id?: string | null
          error_code?: string | null
          eta_minutes?: number | null
          id?: string
          location_id?: string | null
          priority?: string | null
          serial_number?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      dsar_requests: {
        Row: {
          created_at: string
          customer_id: string
          fulfilled_at: string | null
          id: string
          notes: string | null
          request_type: string
          requested_by: string | null
          status: string
          subject_email: string | null
          subject_phone: string | null
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_by?: string | null
          status?: string
          subject_email?: string | null
          subject_phone?: string | null
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_by?: string | null
          status?: string
          subject_email?: string | null
          subject_phone?: string | null
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dsar_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      evidence_catalog: {
        Row: {
          control_code: string
          created_at: string
          description: string
          evidence_type: string
          id: string
          location_ref: string
          retrieval_instructions: string | null
        }
        Insert: {
          control_code: string
          created_at?: string
          description: string
          evidence_type: string
          id?: string
          location_ref: string
          retrieval_instructions?: string | null
        }
        Update: {
          control_code?: string
          created_at?: string
          description?: string
          evidence_type?: string
          id?: string
          location_ref?: string
          retrieval_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_catalog_control_code_fkey"
            columns: ["control_code"]
            isOneToOne: false
            referencedRelation: "control_library"
            referencedColumns: ["code"]
          },
        ]
      }
      governance_settings: {
        Row: {
          authored_by: string | null
          content: string
          created_at: string
          doc_type: string
          id: string
          metadata: Json
          title: string
          version: number
        }
        Insert: {
          authored_by?: string | null
          content: string
          created_at?: string
          doc_type: string
          id?: string
          metadata?: Json
          title: string
          version?: number
        }
        Update: {
          authored_by?: string | null
          content?: string
          created_at?: string
          doc_type?: string
          id?: string
          metadata?: Json
          title?: string
          version?: number
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          key: string
          result_summary: Json
          scope: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          key: string
          result_summary?: Json
          scope: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          key?: string
          result_summary?: Json
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_invite_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          industry_id: string
          industry_name: string
          ip_address: unknown
          link: string
          message: string
          recipient_count: number
          recipients_bcc: string[]
          recipients_cc: string[]
          recipients_to: string[]
          resend_id: string | null
          sender_email: string
          sender_name: string | null
          sender_user_id: string | null
          status: string
          subject: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          industry_id: string
          industry_name: string
          ip_address?: unknown
          link: string
          message: string
          recipient_count?: number
          recipients_bcc?: string[]
          recipients_cc?: string[]
          recipients_to?: string[]
          resend_id?: string | null
          sender_email: string
          sender_name?: string | null
          sender_user_id?: string | null
          status: string
          subject: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          industry_id?: string
          industry_name?: string
          ip_address?: unknown
          link?: string
          message?: string
          recipient_count?: number
          recipients_bcc?: string[]
          recipients_cc?: string[]
          recipients_to?: string[]
          resend_id?: string | null
          sender_email?: string
          sender_name?: string | null
          sender_user_id?: string | null
          status?: string
          subject?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      integration_credentials: {
        Row: {
          auth_tag: string | null
          ciphertext: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          field_hints: Json
          hubspot_form_guid: string | null
          hubspot_portal_id: string | null
          hubspot_private_app_token_encrypted: string | null
          id: string
          integration_id: string
          iv: string | null
          last_test_error: string | null
          last_test_outcome: string | null
          last_tested_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_tag?: string | null
          ciphertext?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          field_hints?: Json
          hubspot_form_guid?: string | null
          hubspot_portal_id?: string | null
          hubspot_private_app_token_encrypted?: string | null
          id?: string
          integration_id: string
          iv?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          last_tested_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_tag?: string | null
          ciphertext?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          field_hints?: Json
          hubspot_form_guid?: string | null
          hubspot_portal_id?: string | null
          hubspot_private_app_token_encrypted?: string | null
          id?: string
          integration_id?: string
          iv?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          last_tested_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_pins: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          integration_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          integration_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          integration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_pins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          created_at: string
          customer_id: string
          direction: string
          duration_ms: number | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          integration_id: string
          outcome: string
          payload_summary: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          direction: string
          duration_ms?: number | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          integration_id: string
          outcome: string
          payload_summary?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          direction?: string
          duration_ms?: number | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          integration_id?: string
          outcome?: string
          payload_summary?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config_json: Json
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      kill_switches: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          outbound_email_paused: boolean
          outbound_sms_paused: boolean
          outbound_voice_paused: boolean
          panic_ai_disabled: boolean
          payments_paused: boolean
          reason: string | null
          toggled_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          outbound_email_paused?: boolean
          outbound_sms_paused?: boolean
          outbound_voice_paused?: boolean
          panic_ai_disabled?: boolean
          payments_paused?: boolean
          reason?: string | null
          toggled_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          outbound_email_paused?: boolean
          outbound_sms_paused?: boolean
          outbound_voice_paused?: boolean
          panic_ai_disabled?: boolean
          payments_paused?: boolean
          reason?: string | null
          toggled_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kill_switches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_hash: string | null
          created_at: string
          customer_id: string
          embedding: string | null
          id: string
          last_synced: string
          source_url: string | null
          text_chunk: string
          tokens: number | null
        }
        Insert: {
          chunk_hash?: string | null
          created_at?: string
          customer_id: string
          embedding?: string | null
          id?: string
          last_synced?: string
          source_url?: string | null
          text_chunk: string
          tokens?: number | null
        }
        Update: {
          chunk_hash?: string | null
          created_at?: string
          customer_id?: string
          embedding?: string | null
          id?: string
          last_synced?: string
          source_url?: string | null
          text_chunk?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_pins: {
        Row: {
          config: Json
          created_at: string
          display_label: string
          display_order: number
          id: string
          metric_key: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_label: string
          display_order?: number
          id?: string
          metric_key: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_label?: string
          display_order?: number
          id?: string
          metric_key?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          call_id: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          lead_score: number
          print_specs: Json | null
          quote_status: string
          raw_excerpt: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lead_score?: number
          print_specs?: Json | null
          quote_status?: string
          raw_excerpt?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lead_score?: number
          print_specs?: Json | null
          quote_status?: string
          raw_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreements: {
        Row: {
          agreement_type: string
          created_at: string
          customer_id: string
          evidence_url: string | null
          expires_at: string | null
          id: string
          notes: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_type: string
          created_at?: string
          customer_id: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_type?: string
          created_at?: string
          customer_id?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_agreements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_account_agents: {
        Row: {
          base_agent_id: string
          created_at: string
          custom_instructions: string | null
          customer_id: string
          dynamic_vars: Json
          id: string
          is_primary: boolean
          label: string | null
          line_label: string | null
          parent_assistant_id: string | null
          retell_agent_id: string | null
          routing_type: string | null
          system_prompt: string | null
          updated_at: string
          vapi_assistant_id: string
          verification_error: string | null
          verified_at: string | null
          voice_id: string | null
          voice_provider: string | null
        }
        Insert: {
          base_agent_id?: string
          created_at?: string
          custom_instructions?: string | null
          customer_id: string
          dynamic_vars?: Json
          id?: string
          is_primary?: boolean
          label?: string | null
          line_label?: string | null
          parent_assistant_id?: string | null
          retell_agent_id?: string | null
          routing_type?: string | null
          system_prompt?: string | null
          updated_at?: string
          vapi_assistant_id: string
          verification_error?: string | null
          verified_at?: string | null
          voice_id?: string | null
          voice_provider?: string | null
        }
        Update: {
          base_agent_id?: string
          created_at?: string
          custom_instructions?: string | null
          customer_id?: string
          dynamic_vars?: Json
          id?: string
          is_primary?: boolean
          label?: string | null
          line_label?: string | null
          parent_assistant_id?: string | null
          retell_agent_id?: string | null
          routing_type?: string | null
          system_prompt?: string | null
          updated_at?: string
          vapi_assistant_id?: string
          verification_error?: string | null
          verified_at?: string | null
          voice_id?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
      live_account_phone_numbers: {
        Row: {
          agent_id: string
          area_code: string | null
          created_at: string
          customer_id: string
          e164: string
          id: string
          label: string | null
          provider: string | null
          telnyx_phone_number_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          area_code?: string | null
          created_at?: string
          customer_id: string
          e164: string
          id?: string
          label?: string | null
          provider?: string | null
          telnyx_phone_number_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          area_code?: string | null
          created_at?: string
          customer_id?: string
          e164?: string
          id?: string
          label?: string | null
          provider?: string | null
          telnyx_phone_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_account_phone_numbers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "live_account_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      live_accounts: {
        Row: {
          access_code_hash: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          display_name: string
          id: string
          idempotency_key: string | null
          is_active: boolean
          needs_manual_review: boolean
          notes: string | null
          notification_config: Json
          notification_email: string | null
          provisioning_error: string | null
          provisioning_status: string
          retell_agent_id_primary: string | null
          setup_email_sent_at: string | null
          supply_team_number: string | null
          system_prompt: string | null
          transfer_number: string | null
          updated_at: string
          vapi_assistant_id_primary: string | null
          vip_greeting: string | null
          website_url: string | null
        }
        Insert: {
          access_code_hash: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          display_name: string
          id?: string
          idempotency_key?: string | null
          is_active?: boolean
          needs_manual_review?: boolean
          notes?: string | null
          notification_config?: Json
          notification_email?: string | null
          provisioning_error?: string | null
          provisioning_status?: string
          retell_agent_id_primary?: string | null
          setup_email_sent_at?: string | null
          supply_team_number?: string | null
          system_prompt?: string | null
          transfer_number?: string | null
          updated_at?: string
          vapi_assistant_id_primary?: string | null
          vip_greeting?: string | null
          website_url?: string | null
        }
        Update: {
          access_code_hash?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          display_name?: string
          id?: string
          idempotency_key?: string | null
          is_active?: boolean
          needs_manual_review?: boolean
          notes?: string | null
          notification_config?: Json
          notification_email?: string | null
          provisioning_error?: string | null
          provisioning_status?: string
          retell_agent_id_primary?: string | null
          setup_email_sent_at?: string | null
          supply_team_number?: string | null
          system_prompt?: string | null
          transfer_number?: string | null
          updated_at?: string
          vapi_assistant_id_primary?: string | null
          vip_greeting?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          customer_id: string
          external_number: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          external_number?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          external_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          avg_handle_time_sec: number
          call_volume: number
          created_at: string
          customer_id: string
          deflection_rate: number
          id: string
          period_end: string
          period_start: string
          resolution_rate: number
          savings_usd: number
        }
        Insert: {
          avg_handle_time_sec?: number
          call_volume?: number
          created_at?: string
          customer_id: string
          deflection_rate?: number
          id?: string
          period_end: string
          period_start: string
          resolution_rate?: number
          savings_usd?: number
        }
        Update: {
          avg_handle_time_sec?: number
          call_volume?: number
          created_at?: string
          customer_id?: string
          deflection_rate?: number
          id?: string
          period_end?: string
          period_start?: string
          resolution_rate?: number
          savings_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      numbers: {
        Row: {
          agent_id: string | null
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          label: string | null
          location_id: string | null
          twilio_number: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          location_id?: string | null
          twilio_number: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          location_id?: string | null
          twilio_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numbers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numbers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numbers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_leads: {
        Row: {
          action_taken: string | null
          agent_id: string | null
          company: string | null
          contact_name: string | null
          created_at: string
          customer_id: string
          email: string | null
          id: string
          location_id: string | null
          phone: string | null
          sales_chain_lead_id: string | null
          sales_chain_synced_at: string | null
          specs_json: Json
          updated_at: string
          urgency: string | null
        }
        Insert: {
          action_taken?: string | null
          agent_id?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          sales_chain_lead_id?: string | null
          sales_chain_synced_at?: string | null
          specs_json?: Json
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          action_taken?: string | null
          agent_id?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          sales_chain_lead_id?: string | null
          sales_chain_synced_at?: string | null
          specs_json?: Json
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestrator_leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestrator_leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestrator_leads_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_locations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_primary: boolean
          name: string
          organization_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          organization_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          organization_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          display_name: string | null
          logo_url: string | null
          organization_id: string
          primary_color: string
          updated_at: string
        }
        Insert: {
          display_name?: string | null
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          billing_plan: string
          billing_status: string
          canceled_at: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string
          created_by: string | null
          first_call_at: string | null
          grace_period_ends_at: string | null
          id: string
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          rate_per_second_cents: number
          slug: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_payment_method_verified: boolean
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          billing_plan?: string
          billing_status?: string
          canceled_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          created_by?: string | null
          first_call_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          rate_per_second_cents?: number
          slug: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_payment_method_verified?: boolean
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          billing_plan?: string
          billing_status?: string
          canceled_at?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          created_by?: string | null
          first_call_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          rate_per_second_cents?: number
          slug?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_payment_method_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      portal_ai_agents: {
        Row: {
          created_at: string
          escalation_rules: Json
          id: string
          name: string
          org_id: string
          prompt_pack: Json
          status: Database["public"]["Enums"]["portal_agent_status"]
          tools_config: Json
          updated_at: string
          voice_id: string | null
          voice_provider: string | null
        }
        Insert: {
          created_at?: string
          escalation_rules?: Json
          id?: string
          name: string
          org_id: string
          prompt_pack?: Json
          status?: Database["public"]["Enums"]["portal_agent_status"]
          tools_config?: Json
          updated_at?: string
          voice_id?: string | null
          voice_provider?: string | null
        }
        Update: {
          created_at?: string
          escalation_rules?: Json
          id?: string
          name?: string
          org_id?: string
          prompt_pack?: Json
          status?: Database["public"]["Enums"]["portal_agent_status"]
          tools_config?: Json
          updated_at?: string
          voice_id?: string | null
          voice_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_ai_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_scope: string | null
          event_type: string
          id: string
          location_id: string | null
          metadata: Json
          org_id: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_scope?: string | null
          event_type: string
          id?: string
          location_id?: string | null
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_scope?: string | null
          event_type?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_audit_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_call_transcripts: {
        Row: {
          call_id: string
          created_at: string
          id: string
          location_id: string
          org_id: string
          phone_number_id: string | null
          searchable_metadata: Json
          transcript_text: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          phone_number_id?: string | null
          searchable_metadata?: Json
          transcript_text?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          phone_number_id?: string | null
          searchable_metadata?: Json
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "portal_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_call_transcripts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_call_transcripts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_call_transcripts_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "portal_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_calls: {
        Row: {
          agent_id: string | null
          ai_resolved: boolean
          caller_name: string | null
          caller_phone: string | null
          created_at: string
          duration_sec: number | null
          ended_at: string | null
          id: string
          location_id: string
          metadata: Json
          org_id: string
          outcome: string | null
          phone_number_id: string
          recording_url: string | null
          started_at: string | null
          transferred_to_human: boolean
        }
        Insert: {
          agent_id?: string | null
          ai_resolved?: boolean
          caller_name?: string | null
          caller_phone?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          location_id: string
          metadata?: Json
          org_id: string
          outcome?: string | null
          phone_number_id: string
          recording_url?: string | null
          started_at?: string | null
          transferred_to_human?: boolean
        }
        Update: {
          agent_id?: string | null
          ai_resolved?: boolean
          caller_name?: string | null
          caller_phone?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          location_id?: string
          metadata?: Json
          org_id?: string
          outcome?: string | null
          phone_number_id?: string
          recording_url?: string | null
          started_at?: string | null
          transferred_to_human?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "portal_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "portal_ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_calls_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_calls_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "portal_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_client_vault: {
        Row: {
          created_at: string
          encrypted_payload: string
          id: string
          integration_type: string
          location_id: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_payload: string
          id?: string
          integration_type: string
          location_id?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_payload?: string
          id?: string
          integration_type?: string
          location_id?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_client_vault_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_client_vault_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_leads: {
        Row: {
          call_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          lead_score: number
          location_id: string | null
          org_id: string
          print_specs: Json
          quote_status: string
          raw_excerpt: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lead_score?: number
          location_id?: string | null
          org_id: string
          print_specs?: Json
          quote_status?: string
          raw_excerpt?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lead_score?: number
          location_id?: string | null
          org_id?: string
          print_specs?: Json
          quote_status?: string
          raw_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_leads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "portal_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_leads_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_location_integrations: {
        Row: {
          config_ref: string | null
          created_at: string
          id: string
          inherits_from_org: boolean
          integration_type: string
          last_sync_at: string | null
          location_id: string
          status: Database["public"]["Enums"]["portal_integration_status"]
          updated_at: string
        }
        Insert: {
          config_ref?: string | null
          created_at?: string
          id?: string
          inherits_from_org?: boolean
          integration_type: string
          last_sync_at?: string | null
          location_id: string
          status?: Database["public"]["Enums"]["portal_integration_status"]
          updated_at?: string
        }
        Update: {
          config_ref?: string | null
          created_at?: string
          id?: string
          inherits_from_org?: boolean
          integration_type?: string
          last_sync_at?: string | null
          location_id?: string
          status?: Database["public"]["Enums"]["portal_integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_location_integrations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_locations: {
        Row: {
          address: Json
          business_hours: Json
          created_at: string
          id: string
          name: string
          org_id: string
          routing_rules: Json
          status: Database["public"]["Enums"]["portal_location_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json
          business_hours?: Json
          created_at?: string
          id?: string
          name: string
          org_id: string
          routing_rules?: Json
          status?: Database["public"]["Enums"]["portal_location_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json
          business_hours?: Json
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          routing_rules?: Json
          status?: Database["public"]["Enums"]["portal_location_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_number_agent_assignments: {
        Row: {
          active: boolean
          agent_id: string
          created_at: string
          id: string
          phone_number_id: string
        }
        Insert: {
          active?: boolean
          agent_id: string
          created_at?: string
          id?: string
          phone_number_id: string
        }
        Update: {
          active?: boolean
          agent_id?: string
          created_at?: string
          id?: string
          phone_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_number_agent_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "portal_ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_number_agent_assignments_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "portal_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_organization_settings: {
        Row: {
          branding: Json
          business_rules: Json
          compliance_config: Json
          created_at: string
          id: string
          org_id: string
          routing_defaults: Json
          sample_dashboard_enabled: boolean
          sandbox_enabled: boolean
          updated_at: string
        }
        Insert: {
          branding?: Json
          business_rules?: Json
          compliance_config?: Json
          created_at?: string
          id?: string
          org_id: string
          routing_defaults?: Json
          sample_dashboard_enabled?: boolean
          sandbox_enabled?: boolean
          updated_at?: string
        }
        Update: {
          branding?: Json
          business_rules?: Json
          compliance_config?: Json
          created_at?: string
          id?: string
          org_id?: string
          routing_defaults?: Json
          sample_dashboard_enabled?: boolean
          sandbox_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_organization_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          org_status: Database["public"]["Enums"]["portal_org_status"]
          primary_color: string | null
          savings_per_call: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          org_status?: Database["public"]["Enums"]["portal_org_status"]
          primary_color?: string | null
          savings_per_call?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          org_status?: Database["public"]["Enums"]["portal_org_status"]
          primary_color?: string | null
          savings_per_call?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_phone_numbers: {
        Row: {
          assigned_agent_id: string | null
          carrier: string | null
          created_at: string
          friendly_name: string | null
          id: string
          location_id: string | null
          number: string
          org_id: string
          status: Database["public"]["Enums"]["portal_phone_status"]
          updated_at: string
          vapi_assistant_id: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          carrier?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          location_id?: string | null
          number: string
          org_id: string
          status?: Database["public"]["Enums"]["portal_phone_status"]
          updated_at?: string
          vapi_assistant_id?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          carrier?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          location_id?: string | null
          number?: string
          org_id?: string
          status?: Database["public"]["Enums"]["portal_phone_status"]
          updated_at?: string
          vapi_assistant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_phone_numbers_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "portal_ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_phone_numbers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_phone_numbers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sample_dashboard_presets: {
        Row: {
          active: boolean
          created_at: string
          data: Json
          id: string
          org_id: string | null
          preset_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          data?: Json
          id?: string
          org_id?: string | null
          preset_type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          data?: Json
          id?: string
          org_id?: string | null
          preset_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sample_dashboard_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tenant_integrations: {
        Row: {
          config_ref: string | null
          created_at: string
          id: string
          integration_type: string
          last_sync_at: string | null
          org_id: string
          status: Database["public"]["Enums"]["portal_integration_status"]
          updated_at: string
        }
        Insert: {
          config_ref?: string | null
          created_at?: string
          id?: string
          integration_type: string
          last_sync_at?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["portal_integration_status"]
          updated_at?: string
        }
        Update: {
          config_ref?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["portal_integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tenant_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_location_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_location_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "portal_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["portal_membership_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["portal_membership_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["portal_membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "portal_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["portal_account_status"]
          created_at: string
          default_org_id: string | null
          email: string
          full_name: string | null
          id: string
          is_internal: boolean
          platform_role: Database["public"]["Enums"]["portal_platform_role"]
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["portal_account_status"]
          created_at?: string
          default_org_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_internal?: boolean
          platform_role?: Database["public"]["Enums"]["portal_platform_role"]
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["portal_account_status"]
          created_at?: string
          default_org_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_internal?: boolean
          platform_role?: Database["public"]["Enums"]["portal_platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          customer_id: string | null
          display_name: string | null
          id: string
          last_live_customer_id: string | null
          last_mode: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          id: string
          last_live_customer_id?: string | null
          last_mode?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          id?: string
          last_live_customer_id?: string | null
          last_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_last_live_customer_id_fkey"
            columns: ["last_live_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      provisioning_jobs: {
        Row: {
          attempts: number
          created_at: string
          created_resources: Json
          customer_id: string | null
          id: string
          idempotency_key: string
          last_error: Json | null
          payload: Json
          status: string
          stripe_event_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_resources?: Json
          customer_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: Json | null
          payload?: Json
          status?: string
          stripe_event_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_resources?: Json
          customer_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: Json | null
          payload?: Json
          status?: string
          stripe_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_text: string | null
          judge_rationale: string | null
          metadata: Json
          output_text: string | null
          score: number | null
          status: string
          suite_id: string | null
          test_category: string
          test_id: string
          traits_used: Json
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_text?: string | null
          judge_rationale?: string | null
          metadata?: Json
          output_text?: string | null
          score?: number | null
          status?: string
          suite_id?: string | null
          test_category: string
          test_id: string
          traits_used?: Json
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_text?: string | null
          judge_rationale?: string | null
          metadata?: Json
          output_text?: string | null
          score?: number | null
          status?: string
          suite_id?: string | null
          test_category?: string
          test_id?: string
          traits_used?: Json
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_runs_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "qa_test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_suites: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          name: string
          passed_count: number
          started_by: string | null
          status: string
          total_tests: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          passed_count?: number
          started_by?: string | null
          status?: string
          total_tests?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          passed_count?: number
          started_by?: string | null
          status?: string
          total_tests?: number
        }
        Relationships: []
      }
      regulation_registry: {
        Row: {
          applies_to_industries: string[]
          authority: string | null
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          jurisdiction: string
          name: string
          reference_url: string | null
        }
        Insert: {
          applies_to_industries?: string[]
          authority?: string | null
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          jurisdiction: string
          name: string
          reference_url?: string | null
        }
        Update: {
          applies_to_industries?: string[]
          authority?: string | null
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          jurisdiction?: string
          name?: string
          reference_url?: string | null
        }
        Relationships: []
      }
      restricted_terms: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          is_regex: boolean
          pattern: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          is_regex?: boolean
          pattern: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          is_regex?: boolean
          pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "restricted_terms_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      retell_agents: {
        Row: {
          active_tools: Json
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean
          label: string | null
          phone_e164: string | null
          retell_agent_id: string
          retell_llm_id: string | null
          updated_at: string
        }
        Insert: {
          active_tools?: Json
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_e164?: string | null
          retell_agent_id: string
          retell_llm_id?: string | null
          updated_at?: string
        }
        Update: {
          active_tools?: Json
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_e164?: string | null
          retell_agent_id?: string
          retell_llm_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retell_agents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_instances: {
        Row: {
          company_name: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          retell_agent_id: string | null
          slug: string
          updated_at: string
          vapi_assistant_id: string
          vapi_public_key: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          retell_agent_id?: string | null
          slug: string
          updated_at?: string
          vapi_assistant_id: string
          vapi_public_key?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          retell_agent_id?: string | null
          slug?: string
          updated_at?: string
          vapi_assistant_id?: string
          vapi_public_key?: string | null
        }
        Relationships: []
      }
      sandbox_usage_events: {
        Row: {
          agent_name: string | null
          call_id: string | null
          created_at: string
          duration_seconds: number | null
          event_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          call_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          agent_name?: string | null
          call_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      service_ticket_intents: {
        Row: {
          approval_required: boolean
          created_at: string
          created_by: string
          customer_id: string
          error_message: string | null
          id: string
          intent: string
          manual_review: boolean
          payload: Json
          recording_ref: string | null
          result: string
          retry_count: number
          session_ref: string | null
          transcript_ref: string | null
          updated_at: string
          vapi_call_id: string | null
          vendor_chosen: string | null
        }
        Insert: {
          approval_required?: boolean
          created_at?: string
          created_by?: string
          customer_id: string
          error_message?: string | null
          id?: string
          intent: string
          manual_review?: boolean
          payload?: Json
          recording_ref?: string | null
          result?: string
          retry_count?: number
          session_ref?: string | null
          transcript_ref?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          vendor_chosen?: string | null
        }
        Update: {
          approval_required?: boolean
          created_at?: string
          created_by?: string
          customer_id?: string
          error_message?: string | null
          id?: string
          intent?: string
          manual_review?: boolean
          payload?: Json
          recording_ref?: string | null
          result?: string
          retry_count?: number
          session_ref?: string | null
          transcript_ref?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          vendor_chosen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_intents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          call_id: string
          created_at: string
          customer_id: string | null
          duration_seconds: number | null
          ended_reason: string | null
          error_code: string | null
          id: string
          machine_model: string | null
          resolution_status: string | null
          summary: string | null
          transcript: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          customer_id?: string | null
          duration_seconds?: number | null
          ended_reason?: string | null
          error_code?: string | null
          id?: string
          machine_model?: string | null
          resolution_status?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          customer_id?: string | null
          duration_seconds?: number | null
          ended_reason?: string | null
          error_code?: string | null
          id?: string
          machine_model?: string | null
          resolution_status?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      soa_vendor_integrations: {
        Row: {
          config: Json
          created_at: string
          customer_id: string
          failure_summary: Json | null
          id: string
          kill_switch: boolean
          last_error: string | null
          last_sync_at: string | null
          last_test_at: string | null
          last_test_error: string | null
          last_test_outcome: string | null
          last_write_at: string | null
          manual_review: boolean
          mode: string
          secret_refs: Json
          status: string
          updated_at: string
          vendor_key: string
        }
        Insert: {
          config?: Json
          created_at?: string
          customer_id: string
          failure_summary?: Json | null
          id?: string
          kill_switch?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          last_write_at?: string | null
          manual_review?: boolean
          mode?: string
          secret_refs?: Json
          status?: string
          updated_at?: string
          vendor_key: string
        }
        Update: {
          config?: Json
          created_at?: string
          customer_id?: string
          failure_summary?: Json | null
          id?: string
          kill_switch?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_outcome?: string | null
          last_write_at?: string | null
          manual_review?: boolean
          mode?: string
          secret_refs?: Json
          status?: string
          updated_at?: string
          vendor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "soa_vendor_integrations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_jobs: {
        Row: {
          completed_steps: number
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          result_post_ids: string[]
          start_date: string
          status: string
          total_steps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: number
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          result_post_ids?: string[]
          start_date: string
          status?: string
          total_steps?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_steps?: number
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          result_post_ids?: string[]
          start_date?: string
          status?: string
          total_steps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sub_processors: {
        Row: {
          created_at: string
          data_categories: string[]
          dpa_evidence_url: string | null
          dpa_signed: boolean
          dpa_signed_at: string | null
          hosting_region: string
          id: string
          name: string
          notes: string | null
          purpose: string
          scc_module: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_categories?: string[]
          dpa_evidence_url?: string | null
          dpa_signed?: boolean
          dpa_signed_at?: string | null
          hosting_region: string
          id?: string
          name: string
          notes?: string | null
          purpose: string
          scc_module?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_categories?: string[]
          dpa_evidence_url?: string | null
          dpa_signed?: boolean
          dpa_signed_at?: string | null
          hosting_region?: string
          id?: string
          name?: string
          notes?: string | null
          purpose?: string
          scc_module?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      system_health_checks: {
        Row: {
          checked_at: string
          component: string
          details: Json
          id: string
          latency_ms: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          component: string
          details?: Json
          id?: string
          latency_ms?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          component?: string
          details?: Json
          id?: string
          latency_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      telephony_assets: {
        Row: {
          ai_gateway_number: string | null
          business_origin_number: string | null
          created_at: string
          id: string
          last_inbound_at: string | null
          location_id: string | null
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["telephony_status"]
          updated_at: string
          vapi_assistant_id: string | null
          vapi_phone_number_id: string | null
        }
        Insert: {
          ai_gateway_number?: string | null
          business_origin_number?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["telephony_status"]
          updated_at?: string
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
        }
        Update: {
          ai_gateway_number?: string | null
          business_origin_number?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["telephony_status"]
          updated_at?: string
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telnyx_call_events: {
        Row: {
          call_id: string | null
          created_at: string
          customer_id: string | null
          event_type: string
          from_number: string | null
          id: string
          raw_payload: Json
          signature_timestamp: string | null
          signature_verified: boolean
          telnyx_call_control_id: string | null
          telnyx_call_leg_id: string | null
          to_number: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          from_number?: string | null
          id?: string
          raw_payload?: Json
          signature_timestamp?: string | null
          signature_verified?: boolean
          telnyx_call_control_id?: string | null
          telnyx_call_leg_id?: string | null
          to_number?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          from_number?: string | null
          id?: string
          raw_payload?: Json
          signature_timestamp?: string | null
          signature_verified?: boolean
          telnyx_call_control_id?: string | null
          telnyx_call_leg_id?: string | null
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telnyx_call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telnyx_call_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_risk_profiles: {
        Row: {
          approved_channels: string[]
          approved_models: string[]
          business_hours_end_utc: number
          business_hours_start_utc: number
          created_at: string
          customer_id: string
          named_owner: string
          notes: string | null
          outbound_requires_admin_approval: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          risk_tier: string
          simulation_mode: boolean
          updated_at: string
        }
        Insert: {
          approved_channels?: string[]
          approved_models?: string[]
          business_hours_end_utc?: number
          business_hours_start_utc?: number
          created_at?: string
          customer_id: string
          named_owner: string
          notes?: string | null
          outbound_requires_admin_approval?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_tier?: string
          simulation_mode?: boolean
          updated_at?: string
        }
        Update: {
          approved_channels?: string[]
          approved_models?: string[]
          business_hours_end_utc?: number
          business_hours_start_utc?: number
          created_at?: string
          customer_id?: string
          named_owner?: string
          notes?: string | null
          outbound_requires_admin_approval?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_tier?: string
          simulation_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_risk_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_secrets: {
        Row: {
          created_at: string
          firecrawl_api_key: string | null
          id: string
          langfuse_public_key: string | null
          langfuse_secret_key: string | null
          qstash_signing_key: string | null
          qstash_token: string | null
          render_action_router_secret: string | null
          retell_api_key: string | null
          telnyx_api_key: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firecrawl_api_key?: string | null
          id?: string
          langfuse_public_key?: string | null
          langfuse_secret_key?: string | null
          qstash_signing_key?: string | null
          qstash_token?: string | null
          render_action_router_secret?: string | null
          retell_api_key?: string | null
          telnyx_api_key?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firecrawl_api_key?: string | null
          id?: string
          langfuse_public_key?: string | null
          langfuse_secret_key?: string | null
          qstash_signing_key?: string | null
          qstash_token?: string | null
          render_action_router_secret?: string | null
          retell_api_key?: string | null
          telnyx_api_key?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_impact_assessments: {
        Row: {
          created_at: string
          customer_id: string | null
          data_categories: string[]
          destination_region: string
          id: string
          legal_basis: string
          next_review_due: string | null
          outcome: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_summary: string
          scc_module: string | null
          source_region: string
          supplemental_controls: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          data_categories?: string[]
          destination_region: string
          id?: string
          legal_basis: string
          next_review_due?: string | null
          outcome?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_summary: string
          scc_module?: string | null
          source_region: string
          supplemental_controls: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          data_categories?: string[]
          destination_region?: string
          id?: string
          legal_basis?: string
          next_review_due?: string | null
          outcome?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_summary?: string
          scc_module?: string | null
          source_region?: string
          supplemental_controls?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_impact_assessments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          billed_at: string | null
          billing_period: string
          call_id: string | null
          cost_cents: number
          created_at: string
          id: string
          invoice_id: string | null
          metadata: Json
          organization_id: string
          rate_per_second_cents: number
          seconds_used: number
          vapi_call_id: string | null
        }
        Insert: {
          billed_at?: string | null
          billing_period: string
          call_id?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          organization_id: string
          rate_per_second_cents: number
          seconds_used: number
          vapi_call_id?: string | null
        }
        Update: {
          billed_at?: string | null
          billing_period?: string
          call_id?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          organization_id?: string
          rate_per_second_cents?: number
          seconds_used?: number
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_navigation_events: {
        Row: {
          created_at: string
          dwell_seconds: number | null
          id: string
          metadata: Json
          tab_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dwell_seconds?: number | null
          id?: string
          metadata?: Json
          tab_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dwell_seconds?: number | null
          id?: string
          metadata?: Json
          tab_id?: string
          user_id?: string
        }
        Relationships: []
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
      suspicious_login_activity: {
        Row: {
          distinct_users: number | null
          failed_attempts: number | null
          ip_address: string | null
          last_attempt_at: string | null
          minute_bucket: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_user_activity_summary:
        | {
            Args: never
            Returns: {
              display_name: string
              email: string
              last_login_at: string
              login_failed_count: number
              login_success_count: number
              role: Database["public"]["Enums"]["app_role"]
              sandbox_call_count: number
              sandbox_total_seconds: number
              signed_up_at: string
              total_session_seconds: number
              user_id: string
            }[]
          }
        | {
            Args: { _caller?: string }
            Returns: {
              display_name: string
              email: string
              last_login_at: string
              login_failed_count: number
              login_success_count: number
              role: Database["public"]["Enums"]["app_role"]
              sandbox_call_count: number
              sandbox_total_seconds: number
              signed_up_at: string
              total_session_seconds: number
              user_id: string
            }[]
          }
      check_consent: {
        Args: {
          _channel: Database["public"]["Enums"]["consent_channel"]
          _customer_id: string
          _email?: string
          _phone?: string
        }
        Returns: boolean
      }
      consume_ai_tokens: {
        Args: { _customer_id: string; _tokens: number }
        Returns: boolean
      }
      current_org_id: { Args: never; Returns: string }
      data_retention_sweep_report: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dsar_export_subject: {
        Args: { _customer_id: string; _email?: string; _phone?: string }
        Returns: Json
      }
      dsar_redact_subject: {
        Args: { _customer_id: string; _email?: string; _phone?: string }
        Returns: Json
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_live_account: {
        Args: never
        Returns: {
          customer_id: string
          display_name: string
          is_active: boolean
        }[]
      }
      get_org_billing_card: {
        Args: { _org_id: string }
        Returns: {
          card_brand: string
          card_exp_month: number
          card_exp_year: number
          card_last4: string
          stripe_payment_method_id: string
        }[]
      }
      get_public_sandbox: {
        Args: { p_slug: string }
        Returns: {
          company_name: string
          is_active: boolean
          slug: string
          vapi_assistant_id: string
          vapi_public_key: string
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_member_role"][]
          _user_id?: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email: { Args: { _email: string }; Returns: boolean }
      is_internal_operator: { Args: { _user_id?: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id?: string }
        Returns: boolean
      }
      is_outbound_paused: {
        Args: {
          _channel: Database["public"]["Enums"]["consent_channel"]
          _customer_id: string
        }
        Returns: boolean
      }
      list_integration_statuses: {
        Args: { _customer_id: string }
        Returns: {
          field_hints: Json
          integration_id: string
          last_test_error: string
          last_test_outcome: string
          last_tested_at: string
          status: string
          updated_at: string
        }[]
      }
      log_ai_action: {
        Args: {
          _action: string
          _agent_id?: string
          _call_id?: string
          _customer_id: string
          _decision?: string
          _metadata?: Json
          _model: string
          _model_version?: string
          _rationale?: string
          _resource_id?: string
          _resource_type?: string
          _risk_level?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          _action: string
          _customer_id?: string
          _metadata?: Json
          _resource_id?: string
          _resource_type?: string
        }
        Returns: string
      }
      match_knowledge: {
        Args: { _customer_id: string; _k?: number; _query_embedding: string }
        Returns: {
          id: string
          similarity: number
          source_url: string
          text_chunk: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      outbound_allowed: {
        Args: {
          _channel: Database["public"]["Enums"]["consent_channel"]
          _customer_id: string
        }
        Returns: boolean
      }
      portal_can_view_location: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      portal_has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["portal_membership_role"]
          _user_id: string
        }
        Returns: boolean
      }
      portal_is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_call_usage: {
        Args: {
          _metadata?: Json
          _organization_id: string
          _seconds: number
          _vapi_call_id: string
        }
        Returns: string
      }
      record_consent_change: {
        Args: {
          _channel: Database["public"]["Enums"]["consent_channel"]
          _customer_id: string
          _email?: string
          _evidence_url?: string
          _notes?: string
          _phone?: string
          _source?: Database["public"]["Enums"]["consent_source"]
          _status: Database["public"]["Enums"]["consent_status"]
        }
        Returns: string
      }
      redeem_live_access_code: {
        Args: { _code: string }
        Returns: {
          customer_id: string
          display_name: string
        }[]
      }
      set_account_mode: { Args: { _mode: string }; Returns: undefined }
      set_active_tools: {
        Args: { _customer_id: string; _retell_agent_id: string; _tools: Json }
        Returns: undefined
      }
      tenant_compliance_evidence_status: {
        Args: { _customer_id: string }
        Returns: {
          agreement_type: string
          expires_at: string
          is_complete: boolean
          signed_at: string
          status: string
        }[]
      }
      tenant_compliance_summary: {
        Args: { _customer_id: string }
        Returns: {
          annex_generated: boolean
          controls_mapped: number
          legal_agreement_status: string
          regulation_code: string
          regulation_name: string
        }[]
      }
      tenant_of: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      agent_type: "service" | "sales" | "toner" | "mixed"
      app_role: "phaos_admin" | "customer_admin" | "agent_manager" | "viewer"
      consent_channel: "voice" | "sms" | "email" | "whatsapp"
      consent_source:
        | "web_form"
        | "voice_recording"
        | "written"
        | "imported_crm"
        | "api"
        | "other"
      consent_status: "granted" | "revoked" | "expired" | "pending"
      integration_type:
        | "sales_chain"
        | "eautomate"
        | "microsoft_365"
        | "google_workspace"
        | "webhook"
        | "telemetry_provider"
      org_member_role: "owner" | "admin" | "manager" | "viewer"
      portal_account_status:
        | "active"
        | "pending_approval"
        | "trial"
        | "suspended"
      portal_agent_status: "active" | "inactive"
      portal_integration_status: "connected" | "setup_required" | "error"
      portal_location_status: "active" | "inactive" | "paused"
      portal_membership_role:
        | "owner"
        | "admin"
        | "location_manager"
        | "viewer"
        | "trial"
      portal_org_status: "trial" | "active" | "suspended"
      portal_phone_status: "active" | "inactive" | "provisioning" | "error"
      portal_platform_role:
        | "internal_super_admin"
        | "internal_operator"
        | "customer_owner"
        | "customer_admin"
        | "location_manager"
        | "viewer"
        | "trial_user"
      telephony_status: "pending_forward" | "active" | "paused" | "failed"
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
      agent_type: ["service", "sales", "toner", "mixed"],
      app_role: ["phaos_admin", "customer_admin", "agent_manager", "viewer"],
      consent_channel: ["voice", "sms", "email", "whatsapp"],
      consent_source: [
        "web_form",
        "voice_recording",
        "written",
        "imported_crm",
        "api",
        "other",
      ],
      consent_status: ["granted", "revoked", "expired", "pending"],
      integration_type: [
        "sales_chain",
        "eautomate",
        "microsoft_365",
        "google_workspace",
        "webhook",
        "telemetry_provider",
      ],
      org_member_role: ["owner", "admin", "manager", "viewer"],
      portal_account_status: [
        "active",
        "pending_approval",
        "trial",
        "suspended",
      ],
      portal_agent_status: ["active", "inactive"],
      portal_integration_status: ["connected", "setup_required", "error"],
      portal_location_status: ["active", "inactive", "paused"],
      portal_membership_role: [
        "owner",
        "admin",
        "location_manager",
        "viewer",
        "trial",
      ],
      portal_org_status: ["trial", "active", "suspended"],
      portal_phone_status: ["active", "inactive", "provisioning", "error"],
      portal_platform_role: [
        "internal_super_admin",
        "internal_operator",
        "customer_owner",
        "customer_admin",
        "location_manager",
        "viewer",
        "trial_user",
      ],
      telephony_status: ["pending_forward", "active", "paused", "failed"],
    },
  },
} as const
