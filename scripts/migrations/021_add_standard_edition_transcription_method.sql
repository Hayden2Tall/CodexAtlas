-- Migration 021: Add 'standard_edition' transcription method
-- Used for passages imported from standardized critical edition APIs (LXX, TR, WLC)
-- rather than manuscript-specific transcriptions. Distinguishes edition text from
-- manuscript-specific readings for accurate variant detection.

ALTER TABLE public.passages
  DROP CONSTRAINT IF EXISTS passages_transcription_method_check;

ALTER TABLE public.passages
  ADD CONSTRAINT passages_transcription_method_check
  CHECK (transcription_method IN (
    'manual', 'ocr_auto', 'ocr_reviewed',
    'ai_reconstructed', 'ai_imported', 'standard_edition'
  ));
