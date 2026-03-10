-- Migration 024: Create variant_detection_runs table and link to variants
-- Tracks each variant detection execution so re-detection can reference
-- previous runs without creating duplicates.

CREATE TABLE IF NOT EXISTS public.variant_detection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_reference TEXT NOT NULL,
  passage_ids UUID[] NOT NULL,
  model TEXT NOT NULL,
  variants_found INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.variant_detection_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read detection runs
CREATE POLICY "Anyone can read variant detection runs"
  ON public.variant_detection_runs FOR SELECT
  USING (true);

-- Allow admins to insert detection runs
CREATE POLICY "Admins can insert variant detection runs"
  ON public.variant_detection_runs FOR INSERT
  WITH CHECK (true);

-- Add detection_run_id to variants table to link variants to their detection run
ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS detection_run_id UUID REFERENCES public.variant_detection_runs(id);

-- Index for lookup by passage_reference
CREATE INDEX IF NOT EXISTS idx_variant_detection_runs_passage_ref
  ON public.variant_detection_runs(passage_reference);

-- Index for lookup by detection_run_id on variants
CREATE INDEX IF NOT EXISTS idx_variants_detection_run_id
  ON public.variants(detection_run_id);
