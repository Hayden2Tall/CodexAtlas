-- Migration 003: Create manuscript_images table
-- Individual images (photographs, scans, multispectral captures) associated
-- with a manuscript, tracked with OCR processing status.

CREATE TABLE IF NOT EXISTS public.manuscript_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id),
  storage_path TEXT NOT NULL,
  page_number INTEGER,
  image_type TEXT,
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.manuscript_images ENABLE ROW LEVEL SECURITY;
