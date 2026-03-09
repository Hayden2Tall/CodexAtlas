-- Migration 004: Create passages table
-- A discrete textual unit within a manuscript, identified by a canonical
-- reference (e.g., "Genesis 1:1", "P.Oxy. 5101 col. ii.3-7").

CREATE TABLE IF NOT EXISTS public.passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id),
  reference TEXT NOT NULL,
  sequence_order INTEGER,
  original_text TEXT,
  transcription_method TEXT CHECK (transcription_method IN ('manual', 'ocr_auto', 'ocr_reviewed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;
