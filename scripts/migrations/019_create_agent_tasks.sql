-- Migration 019: Create agent_tasks table for AI agent task tracking
-- Tracks all agent-initiated tasks: batch translations, manuscript discovery,
-- OCR jobs, variant detection, etc. Core of the agent task system.
-- Depends on: 001_create_users.sql

CREATE TABLE public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_type TEXT NOT NULL CHECK (task_type IN (
    'batch_translate',
    'discover_manuscript',
    'ocr_process',
    'detect_variants',
    'custom'
  )),

  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  )),

  priority INTEGER NOT NULL DEFAULT 0,

  -- Task-specific configuration (target language, source filters, etc.)
  config JSONB NOT NULL DEFAULT '{}',

  -- Results and error tracking
  result JSONB,
  error_message TEXT,

  -- Cost tracking
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  ai_model TEXT,

  -- Progress tracking
  total_items INTEGER,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,

  -- Ownership and timestamps
  created_by UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_agent_tasks_status ON public.agent_tasks (status);
CREATE INDEX idx_agent_tasks_type_status ON public.agent_tasks (task_type, status);
CREATE INDEX idx_agent_tasks_created_at ON public.agent_tasks (created_at DESC);

-- updated_at trigger
CREATE OR REPLACE TRIGGER trg_agent_tasks_updated_at
  BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger
CREATE OR REPLACE TRIGGER trg_agent_tasks_audit
  AFTER INSERT OR UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- RLS
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_tasks_admin_all ON public.agent_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY agent_tasks_authenticated_select ON public.agent_tasks
  FOR SELECT
  USING (auth.role() = 'authenticated');
