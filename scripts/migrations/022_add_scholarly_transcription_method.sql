-- Migration 022: Add 'scholarly_transcription' to passages transcription_method CHECK constraint
-- Required for NTVMR (INTF) manuscript-specific transcription integration

ALTER TABLE public.passages
  DROP CONSTRAINT IF EXISTS passages_transcription_method_check;

ALTER TABLE public.passages
  ADD CONSTRAINT passages_transcription_method_check
  CHECK (transcription_method IN (
    'manual', 'ocr_auto', 'ocr_reviewed',
    'ai_reconstructed', 'ai_imported',
    'standard_edition', 'scholarly_transcription'
  ));
