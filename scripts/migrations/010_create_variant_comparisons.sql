-- Migration 010: Create variant_comparisons table
-- Pairwise comparison results between manuscript readings of a variant.

CREATE TABLE IF NOT EXISTS public.variant_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.variants(id),
  manuscript_a_id UUID NOT NULL REFERENCES public.manuscripts(id),
  manuscript_b_id UUID NOT NULL REFERENCES public.manuscripts(id),
  similarity_score DECIMAL(5,4) CHECK (similarity_score >= 0 AND similarity_score <= 1),
  diff_data JSONB,
  comparison_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_comparisons ENABLE ROW LEVEL SECURITY;
