-- Migration 017: Create RLS policies for all tables
-- Implements the role-based access control matrix from DATA_MODEL.md §5.
-- Depends on: all table-creation migrations (001-015).

-- ============================================================================
-- Helper Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- manuscripts
-- ============================================================================

CREATE POLICY manuscripts_reader_select ON public.manuscripts
  FOR SELECT
  USING (
    archived_at IS NULL
    AND current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin')
  );

CREATE POLICY manuscripts_editor_insert ON public.manuscripts
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY manuscripts_editor_update ON public.manuscripts
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY manuscripts_admin_all ON public.manuscripts
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- manuscript_images
-- ============================================================================

CREATE POLICY manuscript_images_select ON public.manuscript_images
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY manuscript_images_editor_insert ON public.manuscript_images
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY manuscript_images_editor_update ON public.manuscript_images
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY manuscript_images_admin_all ON public.manuscript_images
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- passages
-- ============================================================================

CREATE POLICY passages_select ON public.passages
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY passages_scholar_insert ON public.passages
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY passages_editor_update ON public.passages
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY passages_admin_all ON public.passages
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- translations
-- ============================================================================

CREATE POLICY translations_reader_select ON public.translations
  FOR SELECT
  USING (
    current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin')
    AND (
      current_user_role() != 'reader'
      OR current_version_id IS NOT NULL
    )
  );

CREATE POLICY translations_scholar_insert ON public.translations
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY translations_editor_update ON public.translations
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY translations_admin_all ON public.translations
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- translation_versions
-- ============================================================================

CREATE POLICY translation_versions_reader_select ON public.translation_versions
  FOR SELECT
  USING (
    current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin')
    AND (
      current_user_role() != 'reader'
      OR status = 'published'
    )
  );

CREATE POLICY translation_versions_scholar_insert ON public.translation_versions
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY translation_versions_editor_update ON public.translation_versions
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY translation_versions_admin_all ON public.translation_versions
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- variants
-- ============================================================================

CREATE POLICY variants_select ON public.variants
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY variants_scholar_insert ON public.variants
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY variants_editor_update ON public.variants
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY variants_admin_all ON public.variants
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- variant_readings
-- ============================================================================

CREATE POLICY variant_readings_select ON public.variant_readings
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY variant_readings_scholar_insert ON public.variant_readings
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY variant_readings_editor_update ON public.variant_readings
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY variant_readings_admin_all ON public.variant_readings
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- variant_comparisons
-- ============================================================================

CREATE POLICY variant_comparisons_select ON public.variant_comparisons
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY variant_comparisons_scholar_insert ON public.variant_comparisons
  FOR INSERT
  WITH CHECK (current_user_role() IN ('scholar', 'editor', 'admin'));

CREATE POLICY variant_comparisons_editor_update ON public.variant_comparisons
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY variant_comparisons_admin_all ON public.variant_comparisons
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- manuscript_lineage
-- ============================================================================

CREATE POLICY manuscript_lineage_select ON public.manuscript_lineage
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY manuscript_lineage_scholar_insert ON public.manuscript_lineage
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY manuscript_lineage_editor_update ON public.manuscript_lineage
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY manuscript_lineage_admin_all ON public.manuscript_lineage
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- reviews
-- ============================================================================

CREATE POLICY reviews_select ON public.reviews
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY reviews_reviewer_insert ON public.reviews
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('reviewer', 'scholar', 'editor', 'admin')
    AND reviewer_id = auth.uid()
  );

CREATE POLICY reviews_editor_update ON public.reviews
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY reviews_admin_all ON public.reviews
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- review_clusters
-- ============================================================================

CREATE POLICY review_clusters_select ON public.review_clusters
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY review_clusters_editor_insert ON public.review_clusters
  FOR INSERT
  WITH CHECK (current_user_role() IN ('editor', 'admin'));

CREATE POLICY review_clusters_editor_update ON public.review_clusters
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY review_clusters_admin_all ON public.review_clusters
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- evidence_records
-- ============================================================================

CREATE POLICY evidence_records_select ON public.evidence_records
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY evidence_records_scholar_insert ON public.evidence_records
  FOR INSERT
  WITH CHECK (current_user_role() IN ('scholar', 'editor', 'admin'));

CREATE POLICY evidence_records_editor_update ON public.evidence_records
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY evidence_records_admin_all ON public.evidence_records
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- users
-- ============================================================================

CREATE POLICY users_reader_select_own ON public.users
  FOR SELECT
  USING (
    CASE current_user_role()
      WHEN 'reader' THEN id = auth.uid()
      WHEN 'reviewer' THEN true
      WHEN 'scholar' THEN true
      WHEN 'editor' THEN true
      WHEN 'admin' THEN true
      ELSE false
    END
  );

CREATE POLICY users_self_update ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR current_user_role() = 'admin'
  );

CREATE POLICY users_admin_all ON public.users
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- research_packages
-- ============================================================================

CREATE POLICY research_packages_select ON public.research_packages
  FOR SELECT
  USING (current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin'));

CREATE POLICY research_packages_scholar_insert ON public.research_packages
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND creator_id = auth.uid()
  );

CREATE POLICY research_packages_editor_update ON public.research_packages
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

CREATE POLICY research_packages_admin_all ON public.research_packages
  FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================================
-- audit_log (policies already created in 015_create_audit_log.sql)
-- Readers+ can SELECT; no direct INSERT allowed (trigger-only).
-- ============================================================================
