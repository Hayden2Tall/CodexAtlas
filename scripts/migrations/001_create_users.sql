-- Migration 001: Create users table
-- Users table synced with Supabase Auth. The trigger auto-creates a profile
-- row whenever a new user signs up via auth.users.

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'reviewer', 'scholar', 'editor', 'admin')),
  institution TEXT,
  orcid TEXT,
  bio TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
