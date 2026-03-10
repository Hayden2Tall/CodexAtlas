-- Migration 020: Add AI-based transcription methods to passages CHECK constraint
-- Adds 'ai_reconstructed' and 'ai_imported' as valid transcription_method values
-- for passages created by AI agents (full import, discovery, etc.)

ALTER TABLE public.passages
  DROP CONSTRAINT IF EXISTS passages_transcription_method_check;

ALTER TABLE public.passages
  ADD CONSTRAINT passages_transcription_method_check
  CHECK (transcription_method IN ('manual', 'ocr_auto', 'ocr_reviewed', 'ai_reconstructed', 'ai_imported'));
