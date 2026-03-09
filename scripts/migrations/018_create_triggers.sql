-- Migration 018: Create trigger functions and apply triggers
-- 1. set_updated_at() — auto-sets updated_at on UPDATE for relevant tables
-- 2. write_audit_log() — logs INSERT/UPDATE to audit_log (SECURITY DEFINER)
-- Depends on: all table-creation migrations and 015_create_audit_log.sql.

-- ============================================================================
-- 1. updated_at Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables that have an updated_at column

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_manuscripts_updated_at
  BEFORE UPDATE ON public.manuscripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_passages_updated_at
  BEFORE UPDATE ON public.passages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. Audit Log Trigger Function (SECURITY DEFINER bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  _action TEXT;
  _diff JSONB;
  _actor_id UUID;
  _actor_type TEXT;
BEGIN
  _actor_id := auth.uid();

  IF _actor_id IS NOT NULL THEN
    _actor_type := 'user';
  ELSE
    _actor_type := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _diff := jsonb_build_object('after', to_jsonb(NEW));

    INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, diff_data)
    VALUES (_actor_id, _actor_type, _action, TG_TABLE_NAME, NEW.id, _diff);

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at AND NEW.archived_at IS NOT NULL THEN
      _action := 'archive';
    ELSE
      _action := 'update';
    END IF;

    _diff := jsonb_build_object(
      'before', to_jsonb(OLD),
      'after', to_jsonb(NEW)
    );

    INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, diff_data)
    VALUES (_actor_id, _actor_type, _action, TG_TABLE_NAME, NEW.id, _diff);

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Apply Audit Trigger to Tracked Tables
-- ============================================================================

CREATE OR REPLACE TRIGGER trg_manuscripts_audit
  AFTER INSERT OR UPDATE ON public.manuscripts
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_passages_audit
  AFTER INSERT OR UPDATE ON public.passages
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_translations_audit
  AFTER INSERT OR UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_translation_versions_audit
  AFTER INSERT OR UPDATE ON public.translation_versions
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_variants_audit
  AFTER INSERT OR UPDATE ON public.variants
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_variant_readings_audit
  AFTER INSERT OR UPDATE ON public.variant_readings
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_reviews_audit
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE OR REPLACE TRIGGER trg_evidence_records_audit
  AFTER INSERT OR UPDATE ON public.evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
