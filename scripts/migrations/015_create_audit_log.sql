-- Migration 015: Create audit_log table
-- Immutable, append-only log of every state-changing operation. Direct inserts
-- are blocked by RLS; only the SECURITY DEFINER trigger function can write rows.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  diff_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY audit_log_no_direct_insert ON public.audit_log
  FOR INSERT WITH CHECK (false);
