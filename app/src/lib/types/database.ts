export type Json = Record<string, unknown>;

export interface Database {
  public: {
    Tables: {
      manuscripts: {
        Row: {
          id: string;
          title: string;
          original_language: string;
          estimated_date_start: number | null;
          estimated_date_end: number | null;
          origin_location: string | null;
          archive_location: string | null;
          archive_identifier: string | null;
          description: string | null;
          historical_context: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string | null;
          created_by: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          original_language: string;
          estimated_date_start?: number | null;
          estimated_date_end?: number | null;
          origin_location?: string | null;
          archive_location?: string | null;
          archive_identifier?: string | null;
          description?: string | null;
          historical_context?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          original_language?: string;
          estimated_date_start?: number | null;
          estimated_date_end?: number | null;
          origin_location?: string | null;
          archive_location?: string | null;
          archive_identifier?: string | null;
          description?: string | null;
          historical_context?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };

      manuscript_images: {
        Row: {
          id: string;
          manuscript_id: string;
          storage_path: string;
          page_number: number | null;
          image_type: string | null;
          ocr_status: string | null;
          metadata: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          storage_path: string;
          page_number?: number | null;
          image_type?: string | null;
          ocr_status?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          manuscript_id?: string;
          storage_path?: string;
          page_number?: number | null;
          image_type?: string | null;
          ocr_status?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };

      passages: {
        Row: {
          id: string;
          manuscript_id: string;
          reference: string;
          sequence_order: number | null;
          original_text: string | null;
          transcription_method: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          reference: string;
          sequence_order?: number | null;
          original_text?: string | null;
          transcription_method?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          manuscript_id?: string;
          reference?: string;
          sequence_order?: number | null;
          original_text?: string | null;
          transcription_method?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };

      translations: {
        Row: {
          id: string;
          passage_id: string;
          target_language: string;
          current_version_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          passage_id: string;
          target_language: string;
          current_version_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          passage_id?: string;
          target_language?: string;
          current_version_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };

      translation_versions: {
        Row: {
          id: string;
          translation_id: string;
          version_number: number;
          translated_text: string;
          translation_method: string;
          ai_model: string | null;
          confidence_score: number | null;
          source_manuscript_ids: string[] | null;
          revision_reason: string | null;
          status: string;
          evidence_record_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          translation_id: string;
          version_number: number;
          translated_text: string;
          translation_method: string;
          ai_model?: string | null;
          confidence_score?: number | null;
          source_manuscript_ids?: string[] | null;
          revision_reason?: string | null;
          status?: string;
          evidence_record_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          translation_id?: string;
          version_number?: number;
          translated_text?: string;
          translation_method?: string;
          ai_model?: string | null;
          confidence_score?: number | null;
          source_manuscript_ids?: string[] | null;
          revision_reason?: string | null;
          status?: string;
          evidence_record_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };

      variants: {
        Row: {
          id: string;
          passage_reference: string;
          description: string | null;
          metadata: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          passage_reference: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          passage_reference?: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };

      variant_readings: {
        Row: {
          id: string;
          variant_id: string;
          manuscript_id: string;
          reading_text: string;
          apparatus_notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          variant_id: string;
          manuscript_id: string;
          reading_text: string;
          apparatus_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          variant_id?: string;
          manuscript_id?: string;
          reading_text?: string;
          apparatus_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
      };

      variant_comparisons: {
        Row: {
          id: string;
          variant_id: string;
          manuscript_a_id: string;
          manuscript_b_id: string;
          similarity_score: number | null;
          diff_data: Json | null;
          comparison_method: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          manuscript_a_id: string;
          manuscript_b_id: string;
          similarity_score?: number | null;
          diff_data?: Json | null;
          comparison_method?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          manuscript_a_id?: string;
          manuscript_b_id?: string;
          similarity_score?: number | null;
          diff_data?: Json | null;
          comparison_method?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      manuscript_lineage: {
        Row: {
          id: string;
          parent_manuscript_id: string;
          child_manuscript_id: string;
          relationship_type: string;
          confidence_score: number | null;
          evidence_summary: string | null;
          metadata: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          parent_manuscript_id: string;
          child_manuscript_id: string;
          relationship_type: string;
          confidence_score?: number | null;
          evidence_summary?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          parent_manuscript_id?: string;
          child_manuscript_id?: string;
          relationship_type?: string;
          confidence_score?: number | null;
          evidence_summary?: string | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };

      reviews: {
        Row: {
          id: string;
          translation_version_id: string;
          reviewer_id: string;
          rating: number;
          critique: string;
          structured_feedback: Json;
          status: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          translation_version_id: string;
          reviewer_id: string;
          rating: number;
          critique: string;
          structured_feedback?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          translation_version_id?: string;
          reviewer_id?: string;
          rating?: number;
          critique?: string;
          structured_feedback?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      review_clusters: {
        Row: {
          id: string;
          translation_id: string;
          cluster_summary: string | null;
          consensus_direction: string | null;
          consensus_confidence: number | null;
          review_ids: string[] | null;
          analysis_method: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          translation_id: string;
          cluster_summary?: string | null;
          consensus_direction?: string | null;
          consensus_confidence?: number | null;
          review_ids?: string[] | null;
          analysis_method?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          translation_id?: string;
          cluster_summary?: string | null;
          consensus_direction?: string | null;
          consensus_confidence?: number | null;
          review_ids?: string[] | null;
          analysis_method?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      evidence_records: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          source_manuscript_ids: string[] | null;
          translation_method: string | null;
          ai_model: string | null;
          confidence_score: number | null;
          human_review_ids: string[] | null;
          scholarly_disputes: Json | null;
          version_history: Json | null;
          revision_reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          source_manuscript_ids?: string[] | null;
          translation_method?: string | null;
          ai_model?: string | null;
          confidence_score?: number | null;
          human_review_ids?: string[] | null;
          scholarly_disputes?: Json | null;
          version_history?: Json | null;
          revision_reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          source_manuscript_ids?: string[] | null;
          translation_method?: string | null;
          ai_model?: string | null;
          confidence_score?: number | null;
          human_review_ids?: string[] | null;
          scholarly_disputes?: Json | null;
          version_history?: Json | null;
          revision_reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };

      users: {
        Row: {
          id: string;
          display_name: string | null;
          role: string;
          institution: string | null;
          orcid: string | null;
          bio: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          role?: string;
          institution?: string | null;
          orcid?: string | null;
          bio?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          role?: string;
          institution?: string | null;
          orcid?: string | null;
          bio?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      research_packages: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          creator_id: string;
          citation_id: string;
          package_data: Json | null;
          export_formats: string[] | null;
          storage_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          creator_id: string;
          citation_id: string;
          package_data?: Json | null;
          export_formats?: string[] | null;
          storage_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          creator_id?: string;
          citation_id?: string;
          package_data?: Json | null;
          export_formats?: string[] | null;
          storage_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_type: string;
          action: string;
          entity_type: string;
          entity_id: string;
          diff_data: Json | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_type: string;
          action: string;
          entity_type: string;
          entity_id: string;
          diff_data?: Json | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_type?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          diff_data?: Json | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
