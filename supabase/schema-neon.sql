-- Household CFO — Neon-compatible PostgreSQL schema
-- Uses gen_random_uuid() (built-in), no RLS, no auth.users FK
-- Row-level security is handled at the application layer via household_id

-- ─────────────────────────────────────────────────────────────────────────────
-- Households & Users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS households (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL DEFAULT 'My Household',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id           TEXT PRIMARY KEY,  -- Clerk user ID (e.g. user_2abc...)
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Categories
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  group_name   TEXT NOT NULL,   -- Income, Living, Discretionary, Financial, Transfer, Other
  type         TEXT NOT NULL DEFAULT 'Expense' CHECK (type IN ('Income', 'Expense', 'Transfer')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_hidden    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Accounts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  institution  TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT', 'OTHER')),
  class        TEXT NOT NULL DEFAULT 'Asset' CHECK (class IN ('Asset', 'Liability')),
  last_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Transactions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id           UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  description          TEXT NOT NULL,
  full_description     TEXT,
  amount               NUMERIC(14,2) NOT NULL,
  category_id          UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_hint        TEXT,      -- AI-suggested category name (display)
  ai_confidence        NUMERIC(4,3),
  is_reviewed          BOOLEAN NOT NULL DEFAULT FALSE,
  is_transfer          BOOLEAN NOT NULL DEFAULT FALSE,
  dedup_hash           TEXT NOT NULL,
  imported_by_user_id  TEXT,      -- Clerk user ID
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS transactions_household_date ON transactions (household_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_account_id ON transactions (account_id);
CREATE INDEX IF NOT EXISTS transactions_category_id ON transactions (category_id);
CREATE INDEX IF NOT EXISTS transactions_is_reviewed ON transactions (household_id, is_reviewed) WHERE is_reviewed = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Category Rules (merchant pattern → category mapping)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category_id      UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence       NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  match_count      INTEGER NOT NULL DEFAULT 1,
  last_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, merchant_pattern)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Budgets
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        DATE NOT NULL,   -- Always first of month: 2025-03-01
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, category_id, month)
);

CREATE INDEX IF NOT EXISTS budgets_household_month ON budgets (household_id, month);

-- ─────────────────────────────────────────────────────────────────────────────
-- Balance Snapshots (point-in-time account balances for net worth history)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS balance_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  balance       NUMERIC(14,2) NOT NULL,
  snapshot_date DATE NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',  -- csv_import | manual | api
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS balance_snapshots_household_date ON balance_snapshots (household_id, snapshot_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,  -- category_overspend | mid_month_pace_warning | uncategorized_backlog | weekly_review_reminder | monthly_review_reminder
  message      TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_household_read ON notifications (household_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Monthly Reviews
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monthly_reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month                DATE NOT NULL,   -- First of month
  notes                TEXT,
  is_locked            BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at         TIMESTAMPTZ,
  reviewed_by_user_id  TEXT,            -- Clerk user ID
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, month)
);
