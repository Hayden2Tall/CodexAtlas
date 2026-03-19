-- Migration 031: Add 'cross_manuscript' to ai_summaries level CHECK constraint
-- Required for the cross-manuscript comparative summary route
-- (POST /api/summaries/cross-manuscript).

-- Postgres does not support ALTER CONSTRAINT in-place for CHECK constraints.
-- Must drop and recreate.

ALTER TABLE public.ai_summaries
  DROP CONSTRAINT IF EXISTS ai_summaries_level_check;

ALTER TABLE public.ai_summaries
  ADD CONSTRAINT ai_summaries_level_check
  CHECK (level IN ('chapter', 'book', 'grand', 'cross_manuscript'));
