-- Migration 026: Add indexes for Source Registry lookups
-- The new section-text chain queries manuscript_source_texts by source alone
-- (Step 1: registry lookup) and by source+book combination.
-- These indexes make registry lookups fast as the table grows.

CREATE INDEX IF NOT EXISTS idx_mst_source_only
  ON public.manuscript_source_texts (source);

CREATE INDEX IF NOT EXISTS idx_mst_source_book
  ON public.manuscript_source_texts (source, book);
