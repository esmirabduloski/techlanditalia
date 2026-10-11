-- Differenze tra produzione e le migrazioni del repository.
--
-- Alcune modifiche sono state fatte sul database di produzione senza una
-- migrazione nel repo; senza di esse le migrazioni successive non si
-- riapplicano da zero. Gira dopo supabase/migrations e prima di
-- drizzle/migrations. Quando una di queste viene coperta da una migrazione
-- vera, va tolta da qui.

-- Usata da drizzle/migrations/0010_crm_client_payments_view.sql
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
