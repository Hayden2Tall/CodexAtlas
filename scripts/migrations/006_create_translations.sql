-- Migration 006: Create translations table
-- A translation effort for a specific passage into a target language. Acts as
-- the parent container for version history. The current_version_id FK is added
-- in migration 007 after translation_versions exists.

CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES public.passages(id),
  target_language TEXT NOT NULL,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
