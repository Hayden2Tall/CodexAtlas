-- Migration 016: Create all indexes
-- Foreign key indexes, full-text search GIN indexes, domain-specific indexes,
-- and JSONB GIN indexes as defined in DATA_MODEL.md §4.

-- ============================================================================
-- Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_manuscript_images_manuscript_id ON public.manuscript_images(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_passages_manuscript_id ON public.passages(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_translations_passage_id ON public.translations(passage_id);
CREATE INDEX IF NOT EXISTS idx_translation_versions_translation_id ON public.translation_versions(translation_id);
CREATE INDEX IF NOT EXISTS idx_variant_readings_variant_id ON public.variant_readings(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_readings_manuscript_id ON public.variant_readings(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_variant_comparisons_variant_id ON public.variant_comparisons(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_comparisons_manuscript_a_id ON public.variant_comparisons(manuscript_a_id);
CREATE INDEX IF NOT EXISTS idx_variant_comparisons_manuscript_b_id ON public.variant_comparisons(manuscript_b_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_lineage_parent_id ON public.manuscript_lineage(parent_manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_lineage_child_id ON public.manuscript_lineage(child_manuscript_id);
CREATE INDEX IF NOT EXISTS idx_reviews_translation_version_id ON public.reviews(translation_version_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_clusters_translation_id ON public.review_clusters(translation_id);
CREATE INDEX IF NOT EXISTS idx_research_packages_creator_id ON public.research_packages(creator_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log(actor_id);

-- ============================================================================
-- Full-Text Search Indexes (GIN on tsvector)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_passages_original_text_fts
  ON public.passages
  USING GIN (to_tsvector('simple', coalesce(original_text, '')));

CREATE INDEX IF NOT EXISTS idx_translation_versions_translated_text_fts
  ON public.translation_versions
  USING GIN (to_tsvector('english', coalesce(translated_text, '')));

-- ============================================================================
-- Domain-Specific Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_passages_reference ON public.passages(reference);

CREATE INDEX IF NOT EXISTS idx_manuscripts_original_language ON public.manuscripts(original_language);

-- Version ordering within a translation (the UNIQUE constraint in 007 already
-- creates this, but we declare it explicitly for clarity and IF NOT EXISTS safety)
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_versions_tid_vnum
  ON public.translation_versions(translation_id, version_number);

CREATE INDEX IF NOT EXISTS idx_evidence_records_entity
  ON public.evidence_records(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_time
  ON public.audit_log(entity_type, entity_id, created_at);

CREATE INDEX IF NOT EXISTS idx_translation_versions_status ON public.translation_versions(status);

CREATE INDEX IF NOT EXISTS idx_variants_passage_reference ON public.variants(passage_reference);

-- ============================================================================
-- JSONB GIN Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_manuscripts_metadata ON public.manuscripts USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_passages_metadata ON public.passages USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_manuscript_images_metadata ON public.manuscript_images USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_evidence_records_metadata ON public.evidence_records USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_evidence_records_scholarly_disputes ON public.evidence_records USING GIN (scholarly_disputes);
CREATE INDEX IF NOT EXISTS idx_reviews_structured_feedback ON public.reviews USING GIN (structured_feedback);
CREATE INDEX IF NOT EXISTS idx_research_packages_package_data ON public.research_packages USING GIN (package_data);
CREATE INDEX IF NOT EXISTS idx_audit_log_diff_data ON public.audit_log USING GIN (diff_data);
