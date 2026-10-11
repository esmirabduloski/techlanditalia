-- Completa lo schema "auth" dell'immagine supabase/postgres con le parti che in
-- produzione crea GoTrue (il server di autenticazione), che qui non gira.
-- Serve solo perché le migrazioni e le policy che le usano possano girare.
-- Va eseguito come supabase_admin, prima delle migrazioni.

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_sso_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name text,
  factor_type auth.factor_type NOT NULL DEFAULT 'totp',
  status auth.factor_status NOT NULL DEFAULT 'verified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  secret text
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'email',
  provider_id text,
  identity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aal auth.aal_level,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- auth.jwt() esiste nelle versioni recenti di GoTrue; l'immagine ha solo uid/role/email.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

-- Colonne di storage aggiunte dalle migrazioni di storage-api, che qui non gira.
ALTER TABLE storage.buckets
  ADD COLUMN IF NOT EXISTS public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_size_limit bigint,
  ADD COLUMN IF NOT EXISTS allowed_mime_types text[];
ALTER TABLE storage.objects
  ADD COLUMN IF NOT EXISTS owner_id text,
  ADD COLUMN IF NOT EXISTS version text;

-- Tabella e funzione di Realtime (create dal server Realtime in produzione).
CREATE TABLE IF NOT EXISTS realtime.messages (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  extension text NOT NULL DEFAULT 'broadcast',
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE realtime.messages OWNER TO postgres;
CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('realtime.topic', true), '') $$;
GRANT USAGE ON SCHEMA realtime TO postgres, authenticated, anon, service_role;

GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO postgres, authenticated, anon, service_role;

-- Alcune migrazioni inseriscono dati che puntano a utenti reali di produzione
-- (es. il profilo admin). Qui quegli utenti non esistono: le migrazioni girano
-- con session_replication_role = replica, che sospende vincoli FK e trigger.
GRANT SET ON PARAMETER session_replication_role TO postgres;
