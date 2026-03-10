-- Migration 023: Create manuscript_source_texts table for preprocessed manuscript data
-- Used by Codex Sinaiticus Project XML and ETCBC Dead Sea Scrolls integrations
-- Data is populated by offline preprocessing scripts, not by the application itself

CREATE TABLE IF NOT EXISTS public.manuscript_source_texts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  manuscript_name TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, manuscript_name, book, chapter)
);

CREATE INDEX IF NOT EXISTS idx_mst_source_book_chapter
  ON public.manuscript_source_texts (source, book, chapter);

CREATE INDEX IF NOT EXISTS idx_mst_manuscript_name
  ON public.manuscript_source_texts (manuscript_name);

ALTER TABLE public.manuscript_source_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manuscript_source_texts_public_read"
  ON public.manuscript_source_texts
  FOR SELECT
  USING (true);
