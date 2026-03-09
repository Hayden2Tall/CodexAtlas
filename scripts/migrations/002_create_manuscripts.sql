-- Migration 002: Create manuscripts table
-- Root entity representing a single physical or reconstructed manuscript.

CREATE TABLE IF NOT EXISTS public.manuscripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_language TEXT NOT NULL,
  estimated_date_start INTEGER,
  estimated_date_end INTEGER,
  origin_location TEXT,
  archive_location TEXT,
  archive_identifier TEXT,
  description TEXT,
  historical_context TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  archived_at TIMESTAMPTZ
);

ALTER TABLE public.manuscripts ENABLE ROW LEVEL SECURITY;
