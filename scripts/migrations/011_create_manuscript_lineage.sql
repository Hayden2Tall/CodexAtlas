-- Migration 011: Create manuscript_lineage table
-- Directed edges in the stemmatic tree representing copy/derivation
-- relationships between manuscripts. Self-referencing is prevented by
-- a CHECK constraint.

CREATE TABLE IF NOT EXISTS public.manuscript_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id),
  child_manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id),
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('copy', 'derivative', 'shared_source', 'hypothetical')),
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence_summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  CHECK (parent_manuscript_id != child_manuscript_id)
);

ALTER TABLE public.manuscript_lineage ENABLE ROW LEVEL SECURITY;
