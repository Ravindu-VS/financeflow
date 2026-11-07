-- ============================================================================
-- Migration 001 — Transaction-centric financial model (PostgreSQL)
-- ============================================================================
-- Mirrors the Firestore model used by the PWA so the FastAPI AI / analytics /
-- WSO2 integration layer can work on the same concepts:
--   accounts, transactions, recurring_rules, financial_snapshots
--
-- NON-DESTRUCTIVE: legacy tables (income, expenses, savings_contributions,
-- investments) are copied, never altered or dropped. Re-runnable (idempotent).
--
-- Procedure (see docs/UPGRADE_REPORT.md §11):
--   1. pg_dump -Fc finai > backup_before_001.dump
--   2. psql -v ON_ERROR_STOP=1 -f 001_transaction_model.sql finai
--   3. Review the validation output at the end (totals before == after).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS accounts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             VARCHAR(120) NOT NULL,
    type             VARCHAR(30)  NOT NULL CHECK (type IN ('cash','bank','savings','credit_card','debit_card','ewallet','investment','fixed_deposit','loan','other_asset','property')),
    currency         VARCHAR(10)  NOT NULL DEFAULT 'LKR',
    opening_balance  NUMERIC(15,2) NOT NULL DEFAULT 0,
    archived         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS recurring_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(30) NOT NULL,
    amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency            VARCHAR(10) NOT NULL DEFAULT 'LKR',
    category            VARCHAR(64) NOT NULL,
    description         VARCHAR(500),
    merchant            VARCHAR(200),
    account_id          UUID REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id       UUID REFERENCES accounts(id) ON DELETE SET NULL,
    frequency           VARCHAR(20) NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','semiannual','annual','custom')),
    interval_count      INT,
    custom_unit         VARCHAR(10),
    start_date          DATE NOT NULL,
    end_date            DATE,
    auto_generate       BOOLEAN NOT NULL DEFAULT FALSE,
    reminder            BOOLEAN NOT NULL DEFAULT TRUE,
    is_bill             BOOLEAN NOT NULL DEFAULT FALSE,
    is_essential        BOOLEAN,
    variable_amount     BOOLEAN NOT NULL DEFAULT FALSE,
    skipped_dates       DATE[] NOT NULL DEFAULT '{}',
    last_generated_date DATE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    legacy_table        VARCHAR(40),
    legacy_id           UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rules_legacy ON recurring_rules(legacy_table, legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('income','expense','transfer','investment','withdrawal','savings_contribution','savings_withdrawal','refund','reimbursement','adjustment')),
    amount          NUMERIC(15,2) NOT NULL,
    currency        VARCHAR(10) NOT NULL DEFAULT 'LKR',
    date            DATE NOT NULL,
    time            TIME,
    category        VARCHAR(64),
    subcategory     VARCHAR(100),
    description     VARCHAR(500),
    merchant        VARCHAR(200),
    account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
    payment_method  VARCHAR(50),
    tags            TEXT[],
    notes           TEXT,
    receipt_url     TEXT,
    recurrence_id   UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,  -- optional
    goal_id         UUID REFERENCES savings_goals(id) ON DELETE SET NULL,
    investment_id   UUID REFERENCES investments(id) ON DELETE SET NULL,
    is_essential    BOOLEAN,
    nature          VARCHAR(10) CHECK (nature IS NULL OR nature IN ('fixed','variable')),
    kind            VARCHAR(12) CHECK (kind IS NULL OR kind IN ('regular','one_time','unexpected','emergency')),
    status          VARCHAR(10) NOT NULL DEFAULT 'cleared' CHECK (status IN ('cleared','pending','void')),
    source          VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','voice','imported','api','bank_sync','ai','recurring','migration')),
    legacy_table    VARCHAR(40),
    legacy_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (type = 'adjustment' OR amount > 0),
    CHECK (type <> 'transfer' OR (account_id IS NOT NULL AND to_account_id IS NOT NULL AND account_id <> to_account_id))
);
-- Period queries: (user, date) is the hot path for every dashboard / report
CREATE INDEX IF NOT EXISTS idx_tx_user_date      ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_type_date ON transactions(user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_category  ON transactions(user_id, category, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_recurrence     ON transactions(recurrence_id) WHERE recurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_legacy   ON transactions(legacy_table, legacy_id) WHERE legacy_id IS NOT NULL;
-- One generated occurrence per rule per day (prevents duplicate recurring transactions)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_rule_day ON transactions(recurrence_id, date) WHERE recurrence_id IS NOT NULL AND source = 'recurring';

CREATE TABLE IF NOT EXISTS financial_snapshots (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month          CHAR(7) NOT NULL,              -- YYYY-MM
    income         NUMERIC(15,2) NOT NULL,
    expenses       NUMERIC(15,2) NOT NULL,        -- net of refunds
    savings        NUMERIC(15,2) NOT NULL,
    investments    NUMERIC(15,2) NOT NULL,
    net_cash_flow  NUMERIC(15,2) NOT NULL,
    net_worth      NUMERIC(15,2),
    details        JSONB,                          -- budget performance, top categories, behaviour
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, month)
);

-- Monthly aggregation view (fast dashboard/reporting; refresh after bulk loads)
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_summary;
CREATE MATERIALIZED VIEW mv_monthly_summary AS
SELECT user_id,
       to_char(date, 'YYYY-MM') AS month,
       SUM(amount) FILTER (WHERE type = 'income')                                   AS income,
       SUM(amount) FILTER (WHERE type = 'expense')
         - COALESCE(SUM(amount) FILTER (WHERE type IN ('refund','reimbursement')), 0) AS net_expenses,
       COALESCE(SUM(amount) FILTER (WHERE type = 'savings_contribution'), 0)
         - COALESCE(SUM(amount) FILTER (WHERE type = 'savings_withdrawal'), 0)       AS savings,
       COALESCE(SUM(amount) FILTER (WHERE type = 'investment'), 0)
         - COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0)               AS investments,
       COUNT(*)                                                                      AS tx_count
FROM transactions
WHERE status <> 'void'
GROUP BY user_id, to_char(date, 'YYYY-MM');
CREATE UNIQUE INDEX ON mv_monthly_summary(user_id, month);

-- ─── Data migration ─────────────────────────────────────────────────────────
-- Each user gets a "Main Account (migrated)" bank account to hold legacy history.
INSERT INTO accounts (user_id, name, type)
SELECT u.id, 'Main Account (migrated)', 'bank' FROM users u
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.name = 'Main Account (migrated)');

CREATE TEMP TABLE _main_acc ON COMMIT DROP AS
SELECT DISTINCT ON (user_id) user_id, id AS account_id FROM accounts WHERE name = 'Main Account (migrated)' ORDER BY user_id, created_at;

-- Recurring legacy rows → reminder-only rules (never auto-post without the user's consent)
INSERT INTO recurring_rules (user_id, type, amount, currency, category, description, account_id, frequency, start_date, end_date, auto_generate, reminder, last_generated_date, legacy_table, legacy_id)
SELECT i.user_id, 'income', i.amount, COALESCE(i.currency,'LKR'), COALESCE(i.category, i.source, 'other_income'), i.title, m.account_id,
       CASE lower(COALESCE(i.recurrence_type,'monthly')) WHEN 'yearly' THEN 'annual' WHEN 'daily' THEN 'daily' WHEN 'weekly' THEN 'weekly' ELSE 'monthly' END,
       i.date, i.recurrence_end, FALSE, TRUE, i.date, 'income', i.id
FROM income i JOIN _main_acc m USING (user_id)
WHERE i.is_recurring
ON CONFLICT DO NOTHING;

INSERT INTO recurring_rules (user_id, type, amount, currency, category, description, merchant, account_id, frequency, start_date, end_date, auto_generate, reminder, is_bill, last_generated_date, legacy_table, legacy_id)
SELECT e.user_id, 'expense', e.amount, COALESCE(e.currency,'LKR'), e.category, e.title, e.merchant, m.account_id,
       CASE lower(COALESCE(e.recurrence_type,'monthly')) WHEN 'yearly' THEN 'annual' WHEN 'daily' THEN 'daily' WHEN 'weekly' THEN 'weekly' ELSE 'monthly' END,
       e.date, e.recurrence_end, FALSE, TRUE, TRUE, e.date, 'expenses', e.id
FROM expenses e JOIN _main_acc m USING (user_id)
WHERE e.is_recurring
ON CONFLICT DO NOTHING;

INSERT INTO transactions (user_id, type, amount, currency, date, category, description, account_id, tags, recurrence_id, source, legacy_table, legacy_id, created_at)
SELECT i.user_id, 'income', i.amount, COALESCE(i.currency,'LKR'), i.date, COALESCE(i.category, i.source, 'other_income'),
       COALESCE(i.title, i.description), m.account_id, i.tags,
       (SELECT r.id FROM recurring_rules r WHERE r.legacy_table = 'income' AND r.legacy_id = i.id),
       'migration', 'income', i.id, i.created_at
FROM income i JOIN _main_acc m USING (user_id)
ON CONFLICT DO NOTHING;

INSERT INTO transactions (user_id, type, amount, currency, date, category, subcategory, description, merchant, account_id, payment_method, tags, receipt_url, recurrence_id, kind, source, legacy_table, legacy_id, created_at)
SELECT e.user_id, 'expense', e.amount, COALESCE(e.currency,'LKR'), e.date, e.category, e.subcategory,
       COALESCE(e.title, e.description), e.merchant, m.account_id, e.payment_method, e.tags, e.receipt_url,
       (SELECT r.id FROM recurring_rules r WHERE r.legacy_table = 'expenses' AND r.legacy_id = e.id),
       CASE WHEN e.is_recurring THEN 'regular' ELSE 'one_time' END,
       'migration', 'expenses', e.id, e.created_at
FROM expenses e JOIN _main_acc m USING (user_id)
ON CONFLICT DO NOTHING;

INSERT INTO transactions (user_id, type, amount, date, category, description, account_id, goal_id, source, legacy_table, legacy_id, created_at)
SELECT c.user_id, 'savings_contribution', c.amount, c.date, 'savings', COALESCE(c.note, 'Savings contribution'), m.account_id, c.goal_id, 'migration', 'savings_contributions', c.id, c.created_at
FROM savings_contributions c JOIN _main_acc m USING (user_id)
ON CONFLICT DO NOTHING;

INSERT INTO transactions (user_id, type, amount, currency, date, category, description, account_id, investment_id, source, legacy_table, legacy_id, created_at)
SELECT v.user_id, 'investment', ROUND(v.buy_price * COALESCE(NULLIF(v.quantity, 0), 1), 2), COALESCE(v.currency,'LKR'), v.buy_date, v.type, v.name, m.account_id, v.id, 'migration', 'investments', v.id, v.created_at
FROM investments v JOIN _main_acc m USING (user_id)
WHERE v.buy_price * COALESCE(NULLIF(v.quantity, 0), 1) > 0
ON CONFLICT DO NOTHING;

REFRESH MATERIALIZED VIEW mv_monthly_summary;

-- ─── Validation: totals before vs after — any non-zero diff aborts ─────────────
DO $$
DECLARE r RECORD; bad INT := 0;
BEGIN
  FOR r IN
    SELECT 'income' AS k,
           (SELECT COALESCE(SUM(amount),0) FROM income) AS before,
           (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE legacy_table = 'income') AS after
    UNION ALL SELECT 'expenses', (SELECT COALESCE(SUM(amount),0) FROM expenses), (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE legacy_table = 'expenses')
    UNION ALL SELECT 'savings', (SELECT COALESCE(SUM(amount),0) FROM savings_contributions), (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE legacy_table = 'savings_contributions')
    UNION ALL SELECT 'investments', (SELECT COALESCE(SUM(ROUND(buy_price * COALESCE(NULLIF(quantity,0),1),2)),0) FROM investments WHERE buy_price * COALESCE(NULLIF(quantity,0),1) > 0),
                                    (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE legacy_table = 'investments')
  LOOP
    RAISE NOTICE 'migration check % before=% after=% diff=%', r.k, r.before, r.after, r.before - r.after;
    IF r.before <> r.after THEN bad := bad + 1; END IF;
  END LOOP;
  IF bad > 0 THEN RAISE EXCEPTION 'Migration validation failed: % total(s) differ — rolled back', bad; END IF;
END $$;

COMMIT;
