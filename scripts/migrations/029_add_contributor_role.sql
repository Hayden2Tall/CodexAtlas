-- Migration 029: Add contributor and pending_contributor roles
-- Also adds Vault column for contributor's Anthropic API key UUID
-- and a timestamp for when a contributor application was submitted.

-- Drop existing check constraint and recreate with new roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('reader', 'reviewer', 'scholar', 'contributor', 'pending_contributor', 'editor', 'admin'));

-- UUID pointing to the Vault secret holding the contributor's Anthropic API key
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_key_vault_id UUID DEFAULT NULL;

-- When the user submitted their contributor application
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contributor_requested_at TIMESTAMPTZ DEFAULT NULL;
