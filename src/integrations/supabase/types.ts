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
      affiliate_links: {
        Row: {
          broken: boolean | null
          created_at: string
          has_disclosure: boolean | null
          id: string
          merchant: string | null
          network: string | null
          page_id: string | null
          rel_attrs: string | null
          site_id: string
          tracking_id: string | null
          url: string
        }
        Insert: {
          broken?: boolean | null
          created_at?: string
          has_disclosure?: boolean | null
          id?: string
          merchant?: string | null
          network?: string | null
          page_id?: string | null
          rel_attrs?: string | null
          site_id: string
          tracking_id?: string | null
          url: string
        }
        Update: {
          broken?: boolean | null
          created_at?: string
          has_disclosure?: boolean | null
          id?: string
          merchant?: string | null
          network?: string | null
          page_id?: string | null
          rel_attrs?: string | null
          site_id?: string
          tracking_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_citations: {
        Row: {
          context: string | null
          domain: string | null
          id: number
          run_id: string
          site_id: string
          url: string | null
        }
        Insert: {
          context?: string | null
          domain?: string | null
          id?: number
          run_id: string
          site_id: string
          url?: string | null
        }
        Update: {
          context?: string | null
          domain?: string | null
          id?: number
          run_id?: string
          site_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_citations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_visibility_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_citations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          id: number
          latency_ms: number | null
          model: string
          org_id: string | null
          prompt_tokens: number | null
          provider: string
          site_id: string | null
          status: string | null
          task: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: number
          latency_ms?: number | null
          model: string
          org_id?: string | null
          prompt_tokens?: number | null
          provider: string
          site_id?: string | null
          status?: string | null
          task?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: number
          latency_ms?: number | null
          model?: string
          org_id?: string | null
          prompt_tokens?: number | null
          provider?: string
          site_id?: string | null
          status?: string | null
          task?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_visibility_prompts: {
        Row: {
          active: boolean
          competitor_brands: Json | null
          created_at: string
          id: string
          prompt: string
          site_id: string
          topic: string | null
        }
        Insert: {
          active?: boolean
          competitor_brands?: Json | null
          created_at?: string
          id?: string
          prompt: string
          site_id: string
          topic?: string | null
        }
        Update: {
          active?: boolean
          competitor_brands?: Json | null
          created_at?: string
          id?: string
          prompt?: string
          site_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_visibility_prompts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_visibility_runs: {
        Row: {
          brand_mentioned: boolean | null
          citation_quality: string | null
          competitor_mentions: Json | null
          id: string
          model: string
          prompt_id: string
          ran_at: string
          response: string | null
          site_id: string
          url_cited: boolean | null
        }
        Insert: {
          brand_mentioned?: boolean | null
          citation_quality?: string | null
          competitor_mentions?: Json | null
          id?: string
          model: string
          prompt_id: string
          ran_at?: string
          response?: string | null
          site_id: string
          url_cited?: boolean | null
        }
        Update: {
          brand_mentioned?: boolean | null
          citation_quality?: string | null
          competitor_mentions?: Json | null
          id?: string
          model?: string
          prompt_id?: string
          ran_at?: string
          response?: string | null
          site_id?: string
          url_cited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_visibility_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_visibility_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_visibility_runs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip: string | null
          org_id: string | null
          site_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip?: string | null
          org_id?: string | null
          site_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip?: string | null
          org_id?: string | null
          site_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_pages: {
        Row: {
          domain: string | null
          entities: Json | null
          fetched_at: string | null
          id: string
          is_mock: boolean | null
          keyword: string | null
          position: number | null
          site_id: string
          url: string
          word_count: number | null
        }
        Insert: {
          domain?: string | null
          entities?: Json | null
          fetched_at?: string | null
          id?: string
          is_mock?: boolean | null
          keyword?: string | null
          position?: number | null
          site_id: string
          url: string
          word_count?: number | null
        }
        Update: {
          domain?: string | null
          entities?: Json | null
          fetched_at?: string | null
          id?: string
          is_mock?: boolean | null
          keyword?: string | null
          position?: number | null
          site_id?: string
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_briefs: {
        Row: {
          competitor_gaps: Json | null
          created_at: string
          created_by: string | null
          id: string
          intent: string | null
          internal_link_targets: Json | null
          missing_entities: Json | null
          monetization_angle: string | null
          opportunity_id: string | null
          page_id: string | null
          recommended_sections: Json | null
          schema_recommendation: Json | null
          site_id: string
          status: Database["public"]["Enums"]["brief_status"]
          target_queries: Json | null
          target_url: string | null
          updated_at: string
          validation_checklist: Json | null
        }
        Insert: {
          competitor_gaps?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          internal_link_targets?: Json | null
          missing_entities?: Json | null
          monetization_angle?: string | null
          opportunity_id?: string | null
          page_id?: string | null
          recommended_sections?: Json | null
          schema_recommendation?: Json | null
          site_id: string
          status?: Database["public"]["Enums"]["brief_status"]
          target_queries?: Json | null
          target_url?: string | null
          updated_at?: string
          validation_checklist?: Json | null
        }
        Update: {
          competitor_gaps?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          internal_link_targets?: Json | null
          missing_entities?: Json | null
          monetization_angle?: string | null
          opportunity_id?: string | null
          page_id?: string | null
          recommended_sections?: Json | null
          schema_recommendation?: Json | null
          site_id?: string
          status?: Database["public"]["Enums"]["brief_status"]
          target_queries?: Json | null
          target_url?: string | null
          updated_at?: string
          validation_checklist?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_briefs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_briefs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_briefs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_diffs: {
        Row: {
          after_hash: string | null
          approved_at: string | null
          approved_by: string | null
          before_hash: string | null
          brief_id: string | null
          created_at: string
          created_by: string | null
          diff_summary: Json | null
          id: string
          page_id: string | null
          proposed_html: string | null
          proposed_meta_description: string | null
          proposed_schema_jsonld: Json | null
          proposed_slug: string | null
          proposed_title: string | null
          site_id: string
          status: Database["public"]["Enums"]["diff_status"]
          updated_at: string
        }
        Insert: {
          after_hash?: string | null
          approved_at?: string | null
          approved_by?: string | null
          before_hash?: string | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          diff_summary?: Json | null
          id?: string
          page_id?: string | null
          proposed_html?: string | null
          proposed_meta_description?: string | null
          proposed_schema_jsonld?: Json | null
          proposed_slug?: string | null
          proposed_title?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["diff_status"]
          updated_at?: string
        }
        Update: {
          after_hash?: string | null
          approved_at?: string | null
          approved_by?: string | null
          before_hash?: string | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          diff_summary?: Json | null
          id?: string
          page_id?: string | null
          proposed_html?: string | null
          proposed_meta_description?: string | null
          proposed_schema_jsonld?: Json | null
          proposed_slug?: string | null
          proposed_title?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["diff_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_diffs_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_diffs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_diffs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_site_secrets: {
        Row: {
          ciphertext: string
          created_at: string
          id: string
          iv: string | null
          secret_kind: string
          site_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          id?: string
          iv?: string | null
          secret_kind: string
          site_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          id?: string
          iv?: string | null
          secret_kind?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_site_secrets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          baseline: Json | null
          created_at: string
          current_result: Database["public"]["Enums"]["experiment_result"]
          diff_id: string | null
          hypothesis: string | null
          id: string
          implementation_date: string | null
          measurement_windows: Json | null
          page_id: string | null
          site_id: string
          status: Database["public"]["Enums"]["experiment_status"]
          updated_at: string
        }
        Insert: {
          baseline?: Json | null
          created_at?: string
          current_result?: Database["public"]["Enums"]["experiment_result"]
          diff_id?: string | null
          hypothesis?: string | null
          id?: string
          implementation_date?: string | null
          measurement_windows?: Json | null
          page_id?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["experiment_status"]
          updated_at?: string
        }
        Update: {
          baseline?: Json | null
          created_at?: string
          current_result?: Database["public"]["Enums"]["experiment_result"]
          diff_id?: string | null
          hypothesis?: string | null
          id?: string
          implementation_date?: string | null
          measurement_windows?: Json | null
          page_id?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["experiment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_diff_id_fkey"
            columns: ["diff_id"]
            isOneToOne: false
            referencedRelation: "content_diffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_landing_daily: {
        Row: {
          affiliate_clicks: number | null
          conversions: number | null
          date: string
          engaged_sessions: number | null
          id: number
          landing_path: string
          newsletter_signups: number | null
          outbound_clicks: number | null
          revenue: number | null
          sessions: number | null
          site_id: string
          tool_completes: number | null
          tool_starts: number | null
        }
        Insert: {
          affiliate_clicks?: number | null
          conversions?: number | null
          date: string
          engaged_sessions?: number | null
          id?: number
          landing_path: string
          newsletter_signups?: number | null
          outbound_clicks?: number | null
          revenue?: number | null
          sessions?: number | null
          site_id: string
          tool_completes?: number | null
          tool_starts?: number | null
        }
        Update: {
          affiliate_clicks?: number | null
          conversions?: number | null
          date?: string
          engaged_sessions?: number | null
          id?: number
          landing_path?: string
          newsletter_signups?: number | null
          outbound_clicks?: number | null
          revenue?: number | null
          sessions?: number | null
          site_id?: string
          tool_completes?: number | null
          tool_starts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ga4_landing_daily_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_page_query_daily: {
        Row: {
          clicks: number | null
          country: string | null
          ctr: number | null
          date: string
          device: string | null
          id: number
          impressions: number | null
          position: number | null
          query: string
          site_id: string
          url: string
        }
        Insert: {
          clicks?: number | null
          country?: string | null
          ctr?: number | null
          date: string
          device?: string | null
          id?: number
          impressions?: number | null
          position?: number | null
          query: string
          site_id: string
          url: string
        }
        Update: {
          clicks?: number | null
          country?: string | null
          ctr?: number | null
          date?: string
          device?: string | null
          id?: number
          impressions?: number | null
          position?: number | null
          query?: string
          site_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_page_query_daily_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_links: {
        Row: {
          anchor_text: string | null
          id: number
          is_nofollow: boolean | null
          site_id: string
          source_page_id: string | null
          source_url: string
          target_page_id: string | null
          target_url: string
        }
        Insert: {
          anchor_text?: string | null
          id?: number
          is_nofollow?: boolean | null
          site_id: string
          source_page_id?: string | null
          source_url: string
          target_page_id?: string | null
          target_url: string
        }
        Update: {
          anchor_text?: string | null
          id?: number
          is_nofollow?: boolean | null
          site_id?: string
          source_page_id?: string | null
          source_url?: string
          target_page_id?: string | null
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_links_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_links_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_links_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_clusters: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          intent: string | null
          label: string
          pillar_url: string | null
          site_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          intent?: string | null
          label: string
          pillar_url?: string | null
          site_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          intent?: string | null
          label?: string
          pillar_url?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_clusters_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          cluster_id: string | null
          cpc: number | null
          created_at: string
          difficulty: number | null
          id: string
          intent: string | null
          is_mock: boolean
          keyword: string
          search_volume: number | null
          site_id: string
          source: string | null
        }
        Insert: {
          cluster_id?: string | null
          cpc?: number | null
          created_at?: string
          difficulty?: number | null
          id?: string
          intent?: string | null
          is_mock?: boolean
          keyword: string
          search_volume?: number | null
          site_id: string
          source?: string | null
        }
        Update: {
          cluster_id?: string | null
          cpc?: number | null
          created_at?: string
          difficulty?: number | null
          id?: string
          intent?: string | null
          is_mock?: boolean
          keyword?: string
          search_volume?: number | null
          site_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keywords_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "keyword_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keywords_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_opportunities: {
        Row: {
          created_at: string
          id: string
          placement_hint: string | null
          similarity: number | null
          site_id: string
          source_page_id: string | null
          source_url: string
          status: Database["public"]["Enums"]["opportunity_status"]
          suggested_anchor: string | null
          target_page_id: string | null
          target_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          placement_hint?: string | null
          similarity?: number | null
          site_id: string
          source_page_id?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          suggested_anchor?: string | null
          target_page_id?: string | null
          target_url: string
        }
        Update: {
          created_at?: string
          id?: string
          placement_hint?: string | null
          similarity?: number | null
          site_id?: string
          source_page_id?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          suggested_anchor?: string | null
          target_page_id?: string | null
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_opportunities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_opportunities_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_opportunities_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      monetization_opportunities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          page_id: string | null
          recommended_fix: Json | null
          site_id: string
          status: Database["public"]["Enums"]["opportunity_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          page_id?: string | null
          recommended_fix?: Json | null
          site_id: string
          status?: Database["public"]["Enums"]["opportunity_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          page_id?: string | null
          recommended_fix?: Json | null
          site_id?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "monetization_opportunities_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monetization_opportunities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          confidence_score: number | null
          created_at: string
          effort_score: number | null
          evidence: Json | null
          generated_at: string | null
          id: string
          impact_score: number | null
          page_id: string | null
          priority: number | null
          recommended_action: string | null
          reversibility_score: number | null
          risk_score: number | null
          severity: number | null
          site_id: string
          source_data: Json | null
          status: Database["public"]["Enums"]["opportunity_status"]
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at: string
          validation_method: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          effort_score?: number | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          impact_score?: number | null
          page_id?: string | null
          priority?: number | null
          recommended_action?: string | null
          reversibility_score?: number | null
          risk_score?: number | null
          severity?: number | null
          site_id: string
          source_data?: Json | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          summary?: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          validation_method?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          effort_score?: number | null
          evidence?: Json | null
          generated_at?: string | null
          id?: string
          impact_score?: number | null
          page_id?: string | null
          priority?: number | null
          recommended_action?: string | null
          reversibility_score?: number | null
          risk_score?: number | null
          severity?: number | null
          site_id?: string
          source_data?: Json | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          validation_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_snapshots: {
        Row: {
          affiliate_link_count: number | null
          captured_at: string
          hash: string | null
          headings: Json | null
          id: string
          image_count: number | null
          internal_link_count: number | null
          outbound_link_count: number | null
          page_id: string
          raw_html: string | null
          rendered_html: string | null
          schema_jsonld: Json | null
          site_id: string
        }
        Insert: {
          affiliate_link_count?: number | null
          captured_at?: string
          hash?: string | null
          headings?: Json | null
          id?: string
          image_count?: number | null
          internal_link_count?: number | null
          outbound_link_count?: number | null
          page_id: string
          raw_html?: string | null
          rendered_html?: string | null
          schema_jsonld?: Json | null
          site_id: string
        }
        Update: {
          affiliate_link_count?: number | null
          captured_at?: string
          hash?: string | null
          headings?: Json | null
          id?: string
          image_count?: number | null
          internal_link_count?: number | null
          outbound_link_count?: number | null
          page_id?: string
          raw_html?: string | null
          rendered_html?: string | null
          schema_jsonld?: Json | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_snapshots_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          canonical: string | null
          canonical_mismatch: boolean | null
          content_hash: string | null
          created_at: string
          embedding: string | null
          excerpt: string | null
          extracted: Json | null
          health_score: number | null
          id: string
          in_sitemap: boolean | null
          indexability_status: string | null
          intent: string | null
          last_audited_at: string | null
          last_imported_at: string | null
          meta_description: string | null
          meta_title: string | null
          modified_at: string | null
          noindex: boolean | null
          post_type: string | null
          primary_keyword: string | null
          raw_content_html: string | null
          rendered_content_html: string | null
          site_id: string
          slug: string | null
          status: string | null
          title: string | null
          updated_at: string
          url: string
          word_count: number | null
          wp_post_id: number | null
        }
        Insert: {
          canonical?: string | null
          canonical_mismatch?: boolean | null
          content_hash?: string | null
          created_at?: string
          embedding?: string | null
          excerpt?: string | null
          extracted?: Json | null
          health_score?: number | null
          id?: string
          in_sitemap?: boolean | null
          indexability_status?: string | null
          intent?: string | null
          last_audited_at?: string | null
          last_imported_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          modified_at?: string | null
          noindex?: boolean | null
          post_type?: string | null
          primary_keyword?: string | null
          raw_content_html?: string | null
          rendered_content_html?: string | null
          site_id: string
          slug?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url: string
          word_count?: number | null
          wp_post_id?: number | null
        }
        Update: {
          canonical?: string | null
          canonical_mismatch?: boolean | null
          content_hash?: string | null
          created_at?: string
          embedding?: string | null
          excerpt?: string | null
          extracted?: Json | null
          health_score?: number | null
          id?: string
          in_sitemap?: boolean | null
          indexability_status?: string | null
          intent?: string | null
          last_audited_at?: string | null
          last_imported_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          modified_at?: string | null
          noindex?: boolean | null
          post_type?: string | null
          primary_keyword?: string | null
          raw_content_html?: string | null
          rendered_content_html?: string | null
          site_id?: string
          slug?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          word_count?: number | null
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          diff_id: string
          error: string | null
          id: string
          mode: Database["public"]["Enums"]["publish_mode"]
          page_id: string | null
          requested_by: string | null
          result: Json | null
          rollback_snapshot_id: string | null
          scheduled_for: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["publish_job_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          diff_id: string
          error?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["publish_mode"]
          page_id?: string | null
          requested_by?: string | null
          result?: Json | null
          rollback_snapshot_id?: string | null
          scheduled_for?: string | null
          site_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["publish_job_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          diff_id?: string
          error?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["publish_mode"]
          page_id?: string | null
          requested_by?: string | null
          result?: Json | null
          rollback_snapshot_id?: string | null
          scheduled_for?: string | null
          site_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["publish_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_diff_id_fkey"
            columns: ["diff_id"]
            isOneToOne: false
            referencedRelation: "content_diffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_jobs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_jobs_rollback_snapshot_id_fkey"
            columns: ["rollback_snapshot_id"]
            isOneToOne: false
            referencedRelation: "wp_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_snapshots: {
        Row: {
          date: string
          id: number
          is_mock: boolean | null
          keyword_id: string
          position: number | null
          site_id: string
          url: string | null
        }
        Insert: {
          date: string
          id?: number
          is_mock?: boolean | null
          keyword_id: string
          position?: number | null
          site_id: string
          url?: string | null
        }
        Update: {
          date?: string
          id?: number
          is_mock?: boolean | null
          keyword_id?: string
          position?: number | null
          site_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_snapshots_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_per_url: {
        Row: {
          affiliate_clicks: number | null
          date: string
          est_revenue: number | null
          id: number
          is_mock: boolean | null
          site_id: string
          url: string
        }
        Insert: {
          affiliate_clicks?: number | null
          date: string
          est_revenue?: number | null
          id?: number
          is_mock?: boolean | null
          site_id: string
          url: string
        }
        Update: {
          affiliate_clicks?: number | null
          date?: string
          est_revenue?: number | null
          id?: number
          is_mock?: boolean | null
          site_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_per_url_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      robots_checks: {
        Row: {
          checked_at: string
          id: string
          issues: Json | null
          llms_txt: string | null
          robots_txt: string | null
          site_id: string
        }
        Insert: {
          checked_at?: string
          id?: string
          issues?: Json | null
          llms_txt?: string | null
          robots_txt?: string | null
          site_id: string
        }
        Update: {
          checked_at?: string
          id?: string
          issues?: Json | null
          llms_txt?: string | null
          robots_txt?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "robots_checks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_items: {
        Row: {
          created_at: string
          current_jsonld: Json | null
          id: string
          page_id: string | null
          recommended_jsonld: Json | null
          schema_type: string
          site_id: string
          status: string | null
          visible_evidence_ok: boolean | null
        }
        Insert: {
          created_at?: string
          current_jsonld?: Json | null
          id?: string
          page_id?: string | null
          recommended_jsonld?: Json | null
          schema_type: string
          site_id: string
          status?: string | null
          visible_evidence_ok?: boolean | null
        }
        Update: {
          created_at?: string
          current_jsonld?: Json | null
          id?: string
          page_id?: string | null
          recommended_jsonld?: Json | null
          schema_type?: string
          site_id?: string
          status?: string | null
          visible_evidence_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "schema_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_snapshots: {
        Row: {
          features: Json | null
          fetched_at: string
          id: number
          is_mock: boolean | null
          keyword: string
          results: Json | null
          site_id: string
        }
        Insert: {
          features?: Json | null
          fetched_at?: string
          id?: number
          is_mock?: boolean | null
          keyword: string
          results?: Json | null
          site_id: string
        }
        Update: {
          features?: Json | null
          fetched_at?: string
          id?: number
          is_mock?: boolean | null
          keyword?: string
          results?: Json | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serp_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_rules: {
        Row: {
          created_at: string
          id: string
          rule_key: string
          rule_value: Json | null
          site_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_key: string
          rule_value?: Json | null
          site_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_key?: string
          rule_value?: Json | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_rules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sitemap_urls: {
        Row: {
          blocked_by_robots: boolean | null
          canonical_mismatch: boolean | null
          created_at: string
          id: string
          in_sitemap: boolean | null
          in_wordpress: boolean | null
          lastmod: string | null
          noindex: boolean | null
          site_id: string
          url: string
        }
        Insert: {
          blocked_by_robots?: boolean | null
          canonical_mismatch?: boolean | null
          created_at?: string
          id?: string
          in_sitemap?: boolean | null
          in_wordpress?: boolean | null
          lastmod?: string | null
          noindex?: boolean | null
          site_id: string
          url: string
        }
        Update: {
          blocked_by_robots?: boolean | null
          canonical_mismatch?: boolean | null
          created_at?: string
          id?: string
          in_sitemap?: boolean | null
          in_wordpress?: boolean | null
          lastmod?: string | null
          noindex?: boolean | null
          site_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitemap_urls_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          base_url: string
          created_at: string
          ga4_property_id: string | null
          gsc_property: string | null
          id: string
          llms_txt_url: string | null
          name: string
          org_id: string
          robots_txt_url: string | null
          sitemap_url: string | null
          status: Database["public"]["Enums"]["site_status"]
          updated_at: string
          wp_username: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          ga4_property_id?: string | null
          gsc_property?: string | null
          id?: string
          llms_txt_url?: string | null
          name: string
          org_id: string
          robots_txt_url?: string | null
          sitemap_url?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          wp_username?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          ga4_property_id?: string | null
          gsc_property?: string | null
          id?: string
          llms_txt_url?: string | null
          name?: string
          org_id?: string
          robots_txt_url?: string | null
          sitemap_url?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          wp_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      validation_runs: {
        Row: {
          blocking_failures: Json | null
          checks: Json | null
          diff_id: string | null
          id: string
          passed: boolean
          ran_at: string
          site_id: string
          warnings: Json | null
        }
        Insert: {
          blocking_failures?: Json | null
          checks?: Json | null
          diff_id?: string | null
          id?: string
          passed?: boolean
          ran_at?: string
          site_id: string
          warnings?: Json | null
        }
        Update: {
          blocking_failures?: Json | null
          checks?: Json | null
          diff_id?: string | null
          id?: string
          passed?: boolean
          ran_at?: string
          site_id?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_runs_diff_id_fkey"
            columns: ["diff_id"]
            isOneToOne: false
            referencedRelation: "content_diffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_runs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_snapshots: {
        Row: {
          captured_at: string
          hash: string | null
          id: string
          page_id: string | null
          payload: Json
          site_id: string
          wp_post_id: number | null
        }
        Insert: {
          captured_at?: string
          hash?: string | null
          id?: string
          page_id?: string | null
          payload: Json
          site_id: string
          wp_post_id?: number | null
        }
        Update: {
          captured_at?: string
          hash?: string | null
          id?: string
          page_id?: string | null
          payload?: Json
          site_id?: string
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_snapshots_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wp_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_site: { Args: { _site_id: string }; Returns: boolean }
      can_admin_site: { Args: { _site_id: string }; Returns: boolean }
      can_edit_site: { Args: { _site_id: string }; Returns: boolean }
      has_org_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["org_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _org_id: string }; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      site_org: { Args: { _site_id: string }; Returns: string }
    }
    Enums: {
      brief_status: "draft" | "ready" | "in_writing" | "complete" | "archived"
      diff_status:
        | "proposed"
        | "validating"
        | "validated"
        | "rejected"
        | "approved"
        | "published"
        | "rolled_back"
      experiment_result: "pending" | "win" | "loss" | "neutral"
      experiment_status: "baseline" | "running" | "completed" | "inconclusive"
      opportunity_status:
        | "open"
        | "in_progress"
        | "queued"
        | "approved"
        | "published"
        | "dismissed"
        | "won"
        | "lost"
        | "neutral"
      opportunity_type:
        | "ctr_leak"
        | "striking_distance"
        | "decayed_page"
        | "cannibalization"
        | "indexation_risk"
        | "internal_link_gap"
        | "schema_gap"
        | "ai_answer_gap"
        | "monetization_leak"
        | "affiliate_optimization"
        | "content_refresh"
        | "technical_seo_issue"
        | "hub_opportunity"
        | "new_content_opportunity"
      org_role: "owner" | "admin" | "editor" | "viewer"
      publish_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "rolled_back"
      publish_mode: "draft" | "live_update" | "rollback"
      site_status: "pending" | "connected" | "error" | "paused"
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
      brief_status: ["draft", "ready", "in_writing", "complete", "archived"],
      diff_status: [
        "proposed",
        "validating",
        "validated",
        "rejected",
        "approved",
        "published",
        "rolled_back",
      ],
      experiment_result: ["pending", "win", "loss", "neutral"],
      experiment_status: ["baseline", "running", "completed", "inconclusive"],
      opportunity_status: [
        "open",
        "in_progress",
        "queued",
        "approved",
        "published",
        "dismissed",
        "won",
        "lost",
        "neutral",
      ],
      opportunity_type: [
        "ctr_leak",
        "striking_distance",
        "decayed_page",
        "cannibalization",
        "indexation_risk",
        "internal_link_gap",
        "schema_gap",
        "ai_answer_gap",
        "monetization_leak",
        "affiliate_optimization",
        "content_refresh",
        "technical_seo_issue",
        "hub_opportunity",
        "new_content_opportunity",
      ],
      org_role: ["owner", "admin", "editor", "viewer"],
      publish_job_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "rolled_back",
      ],
      publish_mode: ["draft", "live_update", "rollback"],
      site_status: ["pending", "connected", "error", "paused"],
    },
  },
} as const
