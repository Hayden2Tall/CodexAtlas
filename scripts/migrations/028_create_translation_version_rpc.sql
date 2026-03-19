-- Migration 028: Atomic translation version + evidence record creation
-- Wraps evidence_records insert + translation_versions insert + entity_id update
-- in a single PL/pgSQL function so partial writes are impossible.

CREATE OR REPLACE FUNCTION create_translation_version_with_evidence(
  p_passage_id          UUID,
  p_source_manuscript_ids UUID[],
  p_ai_model            TEXT,
  p_confidence_score    NUMERIC,
  p_metadata            JSONB,
  p_translation_id      UUID,
  p_version_number      INTEGER,
  p_translated_text     TEXT,
  p_translation_method  TEXT,
  p_created_by          UUID
) RETURNS TABLE(evidence_record_id UUID, version_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_evidence_id UUID;
  v_version_id  UUID;
BEGIN
  -- Step 1: Create evidence record (entity_id temporarily set to passage_id;
  --         updated to actual version_id in step 3)
  INSERT INTO public.evidence_records(
    entity_type,
    entity_id,
    source_manuscript_ids,
    translation_method,
    ai_model,
    confidence_score,
    revision_reason,
    metadata
  ) VALUES (
    'translation_version',
    p_passage_id,
    p_source_manuscript_ids,
    p_translation_method,
    p_ai_model,
    p_confidence_score,
    NULL,
    p_metadata
  ) RETURNING id INTO v_evidence_id;

  -- Step 2: Create translation version linked to the evidence record
  INSERT INTO public.translation_versions(
    translation_id,
    version_number,
    translated_text,
    translation_method,
    ai_model,
    confidence_score,
    source_manuscript_ids,
    status,
    evidence_record_id,
    created_by
  ) VALUES (
    p_translation_id,
    p_version_number,
    p_translated_text,
    p_translation_method,
    p_ai_model,
    p_confidence_score,
    p_source_manuscript_ids,
    'published',
    v_evidence_id,
    p_created_by
  ) RETURNING id INTO v_version_id;

  -- Step 3: Point evidence record at the real version ID
  UPDATE public.evidence_records
  SET entity_id = v_version_id
  WHERE id = v_evidence_id;

  RETURN QUERY SELECT v_evidence_id, v_version_id;
END;
$$;

-- Grant execution to the service role (used by createAdminClient)
GRANT EXECUTE ON FUNCTION create_translation_version_with_evidence TO service_role;
