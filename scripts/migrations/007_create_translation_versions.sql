-- Migration 007: Create translation_versions table
-- Immutable version records for translations. Each edit creates a new row;
-- previous versions remain queryable. Also adds the deferred FK from
-- translations.current_version_id to this table.

CREATE TABLE IF NOT EXISTS public.translation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES public.translations(id),
  version_number INTEGER NOT NULL,
  translated_text TEXT NOT NULL,
  translation_method TEXT NOT NULL CHECK (translation_method IN ('ai_initial', 'ai_revised', 'human', 'hybrid')),
  ai_model TEXT,
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_manuscript_ids UUID[],
  revision_reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded', 'disputed')),
  evidence_record_id UUID REFERENCES public.evidence_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(translation_id, version_number)
);

-- Now add the FK from translations to translation_versions
ALTER TABLE public.translations
  ADD CONSTRAINT fk_translations_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.translation_versions(id);

ALTER TABLE public.translation_versions ENABLE ROW LEVEL SECURITY;
