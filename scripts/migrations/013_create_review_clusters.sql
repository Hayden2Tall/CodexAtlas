-- Migration 013: Create review_clusters table
-- AI-generated or editorially curated summaries of multiple reviews
-- for a translation, with consensus analysis.

CREATE TABLE IF NOT EXISTS public.review_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES public.translations(id),
  cluster_summary TEXT,
  consensus_direction TEXT CHECK (consensus_direction IN ('approve', 'revise', 'dispute', 'insufficient')),
  consensus_confidence DECIMAL(5,4) CHECK (consensus_confidence >= 0 AND consensus_confidence <= 1),
  review_ids UUID[],
  analysis_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_clusters ENABLE ROW LEVEL SECURITY;
