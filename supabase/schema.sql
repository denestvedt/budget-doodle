-- Household CFO Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT')),
  class TEXT NOT NULL CHECK (class IN ('Asset', 'Liability')),
  last_balance NUMERIC(12,2) DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Expense', 'Transfer')),
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  full_description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_hint TEXT,
  ai_confidence NUMERIC(3,2),
  is_transfer BOOLEAN DEFAULT FALSE,
  is_reviewed BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- For deduplication
  dedup_hash TEXT,
  UNIQUE(household_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON transactions(household_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_unreviewed ON transactions(household_id, is_reviewed) WHERE is_reviewed = FALSE;

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- stored as first day of month
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category_id, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_household_month ON budgets(household_id, month);

-- ============================================================
-- CATEGORY RULES (auto-categorization cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  match_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, merchant_pattern)
);

-- ============================================================
-- BALANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL,
  snapshot_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'csv_import' CHECK (source IN ('csv_import', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_account_date ON balance_snapshots(account_id, snapshot_date DESC);

-- ============================================================
-- MONTHLY REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, month)
);

-- ============================================================
-- WEEKLY REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, week_start)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'category_overspend',
    'mid_month_pace_warning',
    'uncategorized_backlog',
    'weekly_review_reminder',
    'monthly_review_reminder'
  )),
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_household_unread ON notifications(household_id, is_read, created_at DESC);

-- ============================================================
-- HOUSEHOLD INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's household_id
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Households: users can only see their own household
CREATE POLICY "households_select" ON households
  FOR SELECT USING (id = get_user_household_id());

CREATE POLICY "households_insert" ON households
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "households_update" ON households
  FOR UPDATE USING (id = get_user_household_id());

-- User profiles: users see all profiles in their household
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (household_id = get_user_household_id() OR id = auth.uid());

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- All household data tables use the same pattern
CREATE POLICY "accounts_household" ON accounts
  USING (household_id = get_user_household_id());

CREATE POLICY "categories_household" ON categories
  USING (household_id = get_user_household_id());

CREATE POLICY "transactions_household" ON transactions
  USING (household_id = get_user_household_id());

CREATE POLICY "budgets_household" ON budgets
  USING (household_id = get_user_household_id());

CREATE POLICY "category_rules_household" ON category_rules
  USING (household_id = get_user_household_id());

CREATE POLICY "balance_snapshots_household" ON balance_snapshots
  USING (household_id = get_user_household_id());

CREATE POLICY "monthly_reviews_household" ON monthly_reviews
  USING (household_id = get_user_household_id());

CREATE POLICY "weekly_reviews_household" ON weekly_reviews
  USING (household_id = get_user_household_id());

CREATE POLICY "notifications_household" ON notifications
  USING (household_id = get_user_household_id());

CREATE POLICY "invitations_household" ON household_invitations
  USING (household_id = get_user_household_id());

-- ============================================================
-- DEFAULT CATEGORIES SEED FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_categories(p_household_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO categories (household_id, name, group_name, type, sort_order) VALUES
    -- Income
    (p_household_id, 'Paycheck', 'Income', 'Income', 1),
    (p_household_id, 'Interest', 'Income', 'Income', 2),
    -- Living
    (p_household_id, 'Housing', 'Living', 'Expense', 10),
    (p_household_id, 'Groceries', 'Living', 'Expense', 11),
    (p_household_id, 'Utilities and Bills', 'Living', 'Expense', 12),
    (p_household_id, 'Transportation', 'Living', 'Expense', 13),
    (p_household_id, 'Insurance', 'Living', 'Expense', 14),
    (p_household_id, 'Medical and Dental', 'Living', 'Expense', 15),
    (p_household_id, 'Education', 'Living', 'Expense', 16),
    (p_household_id, 'Fitness', 'Living', 'Expense', 17),
    (p_household_id, 'Pets', 'Living', 'Expense', 18),
    (p_household_id, 'Kids', 'Living', 'Expense', 19),
    (p_household_id, 'Daycare', 'Living', 'Expense', 20),
    -- Discretionary
    (p_household_id, 'Restaurants', 'Discretionary', 'Expense', 30),
    (p_household_id, 'Entertainment', 'Discretionary', 'Expense', 31),
    (p_household_id, 'Shopping', 'Discretionary', 'Expense', 32),
    (p_household_id, 'Travel', 'Discretionary', 'Expense', 33),
    (p_household_id, 'Subscriptions', 'Discretionary', 'Expense', 34),
    (p_household_id, 'Gifts', 'Discretionary', 'Expense', 35),
    (p_household_id, 'Home Improvement', 'Discretionary', 'Expense', 36),
    (p_household_id, 'Charity', 'Discretionary', 'Expense', 37),
    -- Financial
    (p_household_id, 'Loan Repayment', 'Financial', 'Expense', 40),
    (p_household_id, 'Taxes', 'Financial', 'Expense', 41),
    (p_household_id, 'Bank Fees', 'Financial', 'Expense', 42),
    -- Transfer
    (p_household_id, 'Transfer', 'Transfer', 'Transfer', 50),
    -- Other
    (p_household_id, 'Misc', 'Other', 'Expense', 60),
    (p_household_id, 'Check', 'Other', 'Expense', 61)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Auto-create household on first signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a new household for the user
  INSERT INTO households (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'household_name', 'My Household'))
  RETURNING id INTO new_household_id;

  -- Create user profile
  INSERT INTO user_profiles (id, household_id, email, display_name, role)
  VALUES (
    NEW.id,
    new_household_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'owner'
  );

  -- Seed default categories
  PERFORM seed_default_categories(new_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Run this trigger creation manually if not already set up
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();
