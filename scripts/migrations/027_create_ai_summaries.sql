-- Migration 027: Create ai_summaries table for hierarchical AI summary pyramid
-- Stores chapter, book, and grand unified assessment summaries.
-- Passage-level summaries remain in passages.metadata.ai_summary (existing pattern).

CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id          UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  level       TEXT      NOT NULL CHECK (level IN ('chapter', 'book', 'grand')),
  scope_key   TEXT      NOT NULL,  -- "Genesis 1", "Genesis", "grand"
  content     JSONB     NOT NULL,
  model       TEXT      NOT NULL,
  cost_usd    NUMERIC(10, 6) DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  version     INTEGER   NOT NULL DEFAULT 1,
  UNIQUE (level, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_level_scope
  ON public.ai_summaries (level, scope_key);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_level
  ON public.ai_summaries (level);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

-- Public read; only the application (service role) can write
CREATE POLICY "ai_summaries_public_read"
  ON public.ai_summaries
  FOR SELECT
  USING (true);
