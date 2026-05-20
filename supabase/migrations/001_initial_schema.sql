-- ============================================
-- Ledger Budget App - Complete Database Schema
-- Run in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- ACCOUNTS
-- ============================================
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit_card')),
  balance numeric(12,2) not null default 0,
  currency text not null default 'CAD',
  color text not null default '#10b981',
  institution text not null,
  last_four text,
  credit_limit numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CATEGORIES
-- ============================================
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#94a3b8',
  icon text not null default '📦',
  parent_id uuid references categories(id),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- TRANSACTIONS
-- ============================================
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  date date not null,
  merchant text not null,
  amount numeric(12,2) not null, -- negative = expense, positive = income/refund
  category_id uuid references categories(id),
  notes text,
  tags text[],
  is_transfer boolean not null default false,
  is_recurring boolean not null default false,
  recurring_id uuid,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_category_id on transactions(category_id);
create index if not exists idx_transactions_merchant on transactions using gin(to_tsvector('english', merchant));

-- ============================================
-- TRANSACTION SPLITS
-- ============================================
create table if not exists transaction_splits (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  category_id uuid not null references categories(id),
  amount numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================
-- BUDGETS
-- ============================================
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(12,2) not null,
  month text not null, -- 'YYYY-MM'
  created_at timestamptz not null default now(),
  unique(category_id, month)
);

-- ============================================
-- MERCHANT RULES (AI learning)
-- ============================================
create table if not exists merchant_rules (
  id uuid primary key default uuid_generate_v4(),
  merchant_pattern text not null,
  category_id uuid not null references categories(id) on delete cascade,
  match_type text not null default 'contains' check (match_type in ('exact', 'contains', 'starts_with')),
  created_at timestamptz not null default now(),
  unique(merchant_pattern, match_type)
);

-- ============================================
-- RECURRING TRANSACTIONS
-- ============================================
create table if not exists recurring_transactions (
  id uuid primary key default uuid_generate_v4(),
  merchant text not null,
  amount numeric(12,2) not null,
  category_id uuid references categories(id),
  frequency text check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  next_expected date,
  last_seen date,
  created_at timestamptz not null default now()
);

-- ============================================
-- SEED DATA - System Categories
-- ============================================
insert into categories (name, color, icon, is_system) values
  ('Groceries', '#10b981', '🛒', true),
  ('Restaurants', '#f59e0b', '🍽️', true),
  ('Gas', '#3b82f6', '⛽', true),
  ('Shopping', '#8b5cf6', '🛍️', true),
  ('Entertainment', '#f43f5e', '🎬', true),
  ('Travel', '#06b6d4', '✈️', true),
  ('Utilities', '#64748b', '💡', true),
  ('Insurance', '#475569', '🛡️', true),
  ('Housing', '#7c3aed', '🏠', true),
  ('Fun', '#ec4899', '🎉', true),
  ('Subscriptions', '#6366f1', '📱', true),
  ('Transfers', '#94a3b8', '↔️', true),
  ('Credit Card Payments', '#64748b', '💳', true),
  ('Refunds', '#10b981', '↩️', true),
  ('Income', '#10b981', '💵', true),
  ('Miscellaneous', '#94a3b8', '📦', true)
on conflict do nothing;

-- ============================================
-- SEED MERCHANT RULES
-- ============================================
insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'costco', id, 'contains' from categories where name = 'Groceries' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'walmart', id, 'contains' from categories where name = 'Groceries' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'sobeys', id, 'contains' from categories where name = 'Groceries' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'safeway', id, 'contains' from categories where name = 'Groceries' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'tim hortons', id, 'contains' from categories where name = 'Restaurants' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'mcdonald', id, 'contains' from categories where name = 'Restaurants' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'netflix', id, 'contains' from categories where name = 'Subscriptions' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'spotify', id, 'contains' from categories where name = 'Subscriptions' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'amazon prime', id, 'contains' from categories where name = 'Subscriptions' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'shell', id, 'contains' from categories where name = 'Gas' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'petro-canada', id, 'contains' from categories where name = 'Gas' limit 1
on conflict do nothing;

insert into merchant_rules (merchant_pattern, category_id, match_type)
select 'esso', id, 'contains' from categories where name = 'Gas' limit 1
on conflict do nothing;

-- ============================================
-- RLS POLICIES (disable for personal use, or enable auth)
-- ============================================
-- For personal use, you can disable RLS:
alter table accounts disable row level security;
alter table categories disable row level security;
alter table transactions disable row level security;
alter table transaction_splits disable row level security;
alter table budgets disable row level security;
alter table merchant_rules disable row level security;
alter table recurring_transactions disable row level security;

-- If you want to add auth later, re-enable RLS and add policies:
-- alter table accounts enable row level security;
-- create policy "Users can manage their own accounts" on accounts
--   for all using (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_accounts_updated_at before update on accounts
  for each row execute function update_updated_at();

create trigger update_transactions_updated_at before update on transactions
  for each row execute function update_updated_at();
