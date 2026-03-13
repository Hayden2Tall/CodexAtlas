-- Migration 025: Add iiif_metadata transcription method
-- Adds the iiif_metadata value to the passages transcription_method CHECK constraint
-- to support IIIF-harvested stub passages (metadata only, no OCR text yet).

ALTER TABLE public.passages
  DROP CONSTRAINT IF EXISTS passages_transcription_method_check;

ALTER TABLE public.passages
  ADD CONSTRAINT passages_transcription_method_check
  CHECK (transcription_method IN (
    'manual',
    'ocr_auto',
    'ocr_reviewed',
    'ai_reconstructed',
    'ai_imported',
    'standard_edition',
    'scholarly_transcription',
    'iiif_metadata'
  ));
