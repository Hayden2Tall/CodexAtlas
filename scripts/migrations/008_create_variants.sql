-- Migration 008: Create variants table
-- A textual variant at a specific canonical reference point, grouping
-- divergent readings across manuscripts.

CREATE TABLE IF NOT EXISTS public.variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_reference TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
