-- Migration 009: Create variant_readings table
-- A specific reading of a variant as found in a particular manuscript.

CREATE TABLE IF NOT EXISTS public.variant_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.variants(id),
  manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id),
  reading_text TEXT NOT NULL,
  apparatus_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.variant_readings ENABLE ROW LEVEL SECURITY;
