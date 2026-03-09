-- Migration 014: Create research_packages table
-- Exportable, citable research bundles for reproducibility and scholarly
-- citation, identified by a stable citation_id.

CREATE TABLE IF NOT EXISTS public.research_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES public.users(id),
  citation_id TEXT UNIQUE NOT NULL,
  package_data JSONB,
  export_formats TEXT[],
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.research_packages ENABLE ROW LEVEL SECURITY;
