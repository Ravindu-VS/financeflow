-- ============================================================================
-- Migration 002 — Firestore → PostgreSQL sync keys + row-level security
-- ============================================================================
-- * external_id links each row to its Firestore document so syncing is an idempotent upsert.
-- * RLS is enabled on every table: the database is reachable through Supabase's public REST
--   API with the public anon key, so without RLS anyone could read the data. Only the
--   backend's dedicated role is granted access (policies below); anon/authenticated get none.
-- Re-runnable.
-- ============================================================================
BEGIN;

ALTER TABLE income        ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE expenses      ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE investments   ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE users         ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_income_ext        ON income(user_id, external_id)        WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_ext      ON expenses(user_id, external_id)      WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_ext  ON transactions(user_id, external_id)  WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_ext         ON savings_goals(user_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_investments_ext   ON investments(user_id, external_id)   WHERE external_id IS NOT NULL;

-- Synced rows reference Firestore accounts (not PG accounts): keep the transfer rule for
-- native rows only.
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%transfer%account_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_accounts CHECK (
  type <> 'transfer' OR external_id IS NOT NULL
  OR (account_id IS NOT NULL AND to_account_id IS NOT NULL AND account_id <> to_account_id)
);

-- Row-level security on every public table
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

COMMIT;
