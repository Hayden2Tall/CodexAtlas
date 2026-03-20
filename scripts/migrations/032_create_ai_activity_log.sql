-- Migration 032: Create ai_activity_log table
-- Tracks every inline AI route call (summaries, translate) for per-user cost attribution.
-- Batch agent tasks are tracked separately in agent_tasks.

CREATE TABLE IF NOT EXISTS ai_activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route       TEXT        NOT NULL,
  model       TEXT        NOT NULL,
  tokens_in   INTEGER     NOT NULL DEFAULT 0,
  tokens_out  INTEGER     NOT NULL DEFAULT 0,
  cost_usd    NUMERIC(10, 6) NOT NULL DEFAULT 0,
  context     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_activity_log_user_id_idx   ON ai_activity_log(user_id);
CREATE INDEX IF NOT EXISTS ai_activity_log_created_at_idx ON ai_activity_log(created_at DESC);
