-- Migration 005: Create evidence_records table
-- Polymorphic provenance records that capture the full evidence chain for any
-- AI-assisted or scholarly determination. Created before translations and
-- translation_versions since translation_versions references this table.

CREATE TABLE IF NOT EXISTS public.evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_manuscript_ids UUID[],
  translation_method TEXT,
  ai_model TEXT,
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  human_review_ids UUID[],
  scholarly_disputes JSONB,
  version_history JSONB,
  revision_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence_records ENABLE ROW LEVEL SECURITY;
