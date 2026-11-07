-- ============================================================
-- FinAI Enterprise PostgreSQL Schema
-- WSO2 Enterprise Financial Management SaaS Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- ============================================================
-- ROLES TABLE
-- ============================================================
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) UNIQUE NOT NULL,   -- 'normal_user', 'financial_advisor', 'admin'
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO roles (name, description, permissions) VALUES
  ('normal_user',       'Standard financial management user',
   '["manage:finances","view:reports","use:ai","manage:investments"]'),
  ('financial_advisor', 'Professional financial advisor',
   '["view:assigned_users","analyze:reports","provide:recommendations","monitor:health"]'),
  ('admin',             'Platform administrator',
   '["*"]');

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100),
    phone               VARCHAR(20),
    date_of_birth       DATE,
    occupation          VARCHAR(100),
    bio                 TEXT,
    avatar_url          TEXT,
    currency            VARCHAR(10) DEFAULT 'LKR',
    language            VARCHAR(10) DEFAULT 'en',
    theme               VARCHAR(10) DEFAULT 'dark',
    monthly_income      DECIMAL(15, 2),
    is_active           BOOLEAN DEFAULT TRUE,
    is_verified         BOOLEAN DEFAULT FALSE,
    email_verified_at   TIMESTAMP WITH TIME ZONE,
    last_login_at       TIMESTAMP WITH TIME ZONE,
    refresh_token_hash  VARCHAR(255),
    family_group_id     UUID,
    advisor_id          UUID,  -- assigned financial advisor
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- USER ROLES (Many-to-Many)
-- ============================================================
CREATE TABLE user_roles (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================
-- FAMILY GROUPS
-- ============================================================
CREATE TABLE family_groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    owner_id    UUID NOT NULL REFERENCES users(id),
    shared_wallet_balance DECIMAL(15, 2) DEFAULT 0,
    currency    VARCHAR(10) DEFAULT 'LKR',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT fk_family_group
    FOREIGN KEY (family_group_id) REFERENCES family_groups(id);

-- ============================================================
-- INCOME TABLE
-- ============================================================
CREATE TABLE income (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(10) DEFAULT 'LKR',
    source          VARCHAR(50) NOT NULL, -- 'salary', 'freelance', 'passive', 'investment', 'other'
    category        VARCHAR(100),
    description     TEXT,
    date            DATE NOT NULL,
    is_recurring    BOOLEAN DEFAULT FALSE,
    recurrence_type VARCHAR(20),          -- 'daily', 'weekly', 'monthly', 'yearly'
    recurrence_end  DATE,
    tags            TEXT[],
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(10) DEFAULT 'LKR',
    category        VARCHAR(50) NOT NULL, -- 'food', 'transport', 'bills', 'entertainment', etc.
    subcategory     VARCHAR(100),
    description     TEXT,
    date            DATE NOT NULL,
    payment_method  VARCHAR(50),          -- 'cash', 'card', 'online', 'transfer'
    merchant        VARCHAR(200),
    receipt_url     TEXT,
    is_recurring    BOOLEAN DEFAULT FALSE,
    recurrence_type VARCHAR(20),
    recurrence_end  DATE,
    is_shared       BOOLEAN DEFAULT FALSE,
    family_group_id UUID REFERENCES family_groups(id),
    tags            TEXT[],
    is_flagged      BOOLEAN DEFAULT FALSE, -- fraud flag
    fraud_score     DECIMAL(5, 4) DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BUDGETS TABLE
-- ============================================================
CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    limit_amount    DECIMAL(15, 2) NOT NULL CHECK (limit_amount > 0),
    spent_amount    DECIMAL(15, 2) DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'LKR',
    period          VARCHAR(20) NOT NULL, -- 'monthly', 'weekly', 'yearly'
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    alert_threshold DECIMAL(5, 2) DEFAULT 80, -- percentage
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SAVINGS GOALS TABLE
-- ============================================================
CREATE TABLE savings_goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    target_amount   DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount  DECIMAL(15, 2) DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'LKR',
    target_date     DATE,
    category        VARCHAR(50),          -- 'emergency', 'vacation', 'home', 'education', etc.
    icon            VARCHAR(50),
    color           VARCHAR(7),
    status          VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
    monthly_target  DECIMAL(15, 2),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Savings contributions
CREATE TABLE savings_contributions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id     UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    amount      DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    note        TEXT,
    date        DATE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INVESTMENTS TABLE
-- ============================================================
CREATE TABLE investments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(50) NOT NULL, -- 'stocks', 'fixed_deposit', 'mutual_fund', 'bonds', 'gold', 'crypto', 'real_estate'
    symbol          VARCHAR(20),
    quantity        DECIMAL(20, 8),
    buy_price       DECIMAL(15, 4) NOT NULL,
    current_price   DECIMAL(15, 4),
    currency        VARCHAR(10) DEFAULT 'LKR',
    buy_date        DATE NOT NULL,
    maturity_date   DATE,
    interest_rate   DECIMAL(5, 2),        -- for FDs/bonds
    broker          VARCHAR(100),
    notes           TEXT,
    status          VARCHAR(20) DEFAULT 'active', -- 'active', 'sold', 'matured'
    sell_price      DECIMAL(15, 4),
    sell_date       DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PORTFOLIOS TABLE (Snapshots)
-- ============================================================
CREATE TABLE portfolios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    total_invested  DECIMAL(15, 2) NOT NULL,
    current_value   DECIMAL(15, 2) NOT NULL,
    profit_loss     DECIMAL(15, 2) GENERATED ALWAYS AS (current_value - total_invested) STORED,
    roi_percent     DECIMAL(8, 4),
    allocation      JSONB,                -- {"stocks": 30, "crypto": 20, ...}
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    type            VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
    format          VARCHAR(10) NOT NULL, -- 'pdf', 'excel', 'csv'
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    file_url        TEXT,
    file_size_bytes BIGINT,
    status          VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'ready', 'failed'
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(50) NOT NULL, -- 'budget_alert', 'savings_milestone', 'investment_update', 'report_ready', 'fraud_alert'
    channel         VARCHAR(20) DEFAULT 'push', -- 'push', 'email', 'sms'
    is_read         BOOLEAN DEFAULT FALSE,
    action_url      TEXT,
    metadata        JSONB,
    sent_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- AI INSIGHTS TABLE
-- ============================================================
CREATE TABLE ai_insights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL, -- 'spending_analysis', 'saving_recommendation', 'investment_tip', 'health_score', 'prediction', 'fraud_alert'
    title           VARCHAR(300) NOT NULL,
    content         TEXT NOT NULL,
    confidence      DECIMAL(5, 4),
    model_used      VARCHAR(100),
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    metadata        JSONB,
    is_dismissed    BOOLEAN DEFAULT FALSE,
    is_acted_on     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- VOICE COMMANDS TABLE
-- ============================================================
CREATE TABLE voice_commands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_transcript  TEXT NOT NULL,
    intent          VARCHAR(100),         -- 'add_expense', 'add_income', 'query_balance', 'add_investment'
    entities        JSONB,                -- extracted entities: amount, category, date, etc.
    confidence      DECIMAL(5, 4),
    was_executed    BOOLEAN DEFAULT FALSE,
    execution_result JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL, -- 'login', 'logout', 'create_expense', 'delete_income', etc.
    resource_type   VARCHAR(50),
    resource_id     UUID,
    ip_address      INET,
    user_agent      TEXT,
    request_method  VARCHAR(10),
    request_path    TEXT,
    response_status INTEGER,
    duration_ms     INTEGER,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- API ANALYTICS TABLE (WSO2 API Manager simulation)
-- ============================================================
CREATE TABLE api_analytics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    api_key         VARCHAR(255),
    endpoint        VARCHAR(300) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    status_code     INTEGER,
    duration_ms     INTEGER,
    request_size    INTEGER,
    response_size   INTEGER,
    ip_address      INET,
    user_agent      TEXT,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- FINANCIAL HEALTH SCORES TABLE
-- ============================================================
CREATE TABLE health_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score               INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    grade               VARCHAR(2),        -- 'A+', 'A', 'B', 'C', 'D', 'F'
    saving_rate_score   INTEGER,
    expense_ratio_score INTEGER,
    budget_discipline_score INTEGER,
    investment_score    INTEGER,
    emergency_fund_score INTEGER,
    debt_score          INTEGER,
    breakdown           JSONB,
    recommendations     JSONB,
    calculated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_income_user_date ON income(user_id, date DESC);
CREATE INDEX idx_income_source ON income(source);
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_flagged ON expenses(is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX idx_budgets_user_period ON budgets(user_id, period);
CREATE INDEX idx_savings_user ON savings_goals(user_id, status);
CREATE INDEX idx_investments_user_type ON investments(user_id, type);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_ai_insights_user ON ai_insights(user_id, created_at DESC);
CREATE INDEX idx_voice_commands_user ON voice_commands(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_api_analytics_created ON api_analytics(created_at DESC);
CREATE INDEX idx_api_analytics_endpoint ON api_analytics(endpoint);
CREATE INDEX idx_health_scores_user ON health_scores(user_id, calculated_at DESC);

-- ============================================================
-- UPDATED AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_income_updated_at BEFORE UPDATE ON income FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_savings_updated_at BEFORE UPDATE ON savings_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
