-- Migration 030: Supabase Vault RPC functions for contributor API key management
-- Requires the supabase_vault extension (included on Pro, enable in Dashboard →
-- Database → Extensions → "vault" if not already active).
--
-- All three functions are SECURITY DEFINER and granted only to service_role,
-- so the plaintext key is never accessible from the client.

-- pgsodium (Supabase Vault) is enabled via the Dashboard — no CREATE EXTENSION needed here.

-- ---------------------------------------------------------------------------
-- store_contributor_api_key
-- Creates a new Vault secret or updates the existing one for this user.
-- Stores the resulting UUID in users.api_key_vault_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION store_contributor_api_key(p_user_id UUID, p_api_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing UUID;
  v_new_id   UUID;
BEGIN
  SELECT api_key_vault_id INTO v_existing
  FROM public.users
  WHERE id = p_user_id;

  IF v_existing IS NOT NULL THEN
    -- Update the existing secret in place
    PERFORM vault.update_secret(v_existing, p_api_key);
  ELSE
    -- Create a new secret and store the reference
    v_new_id := vault.create_secret(p_api_key, 'contributor_key_' || p_user_id::text);
    UPDATE public.users SET api_key_vault_id = v_new_id WHERE id = p_user_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_contributor_api_key
-- Returns the decrypted Anthropic API key for a contributor, or NULL if none.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_contributor_api_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vault_id UUID;
  v_key      TEXT;
BEGIN
  SELECT api_key_vault_id INTO v_vault_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;

  RETURN v_key;
END;
$$;

-- ---------------------------------------------------------------------------
-- delete_contributor_api_key
-- Removes the Vault secret and clears the reference on the user row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_contributor_api_key(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vault_id UUID;
BEGIN
  SELECT api_key_vault_id INTO v_vault_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_vault_id;
    UPDATE public.users SET api_key_vault_id = NULL WHERE id = p_user_id;
  END IF;
END;
$$;

-- Grant only to service_role (used by createAdminClient in API routes)
GRANT EXECUTE ON FUNCTION store_contributor_api_key TO service_role;
GRANT EXECUTE ON FUNCTION get_contributor_api_key TO service_role;
GRANT EXECUTE ON FUNCTION delete_contributor_api_key TO service_role;
