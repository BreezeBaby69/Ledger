-- ============================================
-- SAMPLE SEED DATA (Optional)
-- Run this AFTER 001_initial_schema.sql
-- Populates the app with realistic demo data
-- ============================================

-- Sample accounts
insert into accounts (id, name, type, balance, currency, color, institution, last_four) values
  ('a1000000-0000-0000-0000-000000000001', 'Tangerine Chequing', 'checking', 3842.17, 'CAD', '#10b981', 'Tangerine', '4291'),
  ('a1000000-0000-0000-0000-000000000002', 'EQ Bank Savings', 'savings', 12500.00, 'CAD', '#3b82f6', 'EQ Bank', '8833'),
  ('a1000000-0000-0000-0000-000000000003', 'TD Visa Infinite', 'credit_card', 1243.88, 'CAD', '#8b5cf6', 'TD', '5512')
on conflict do nothing;

-- Get category IDs
do $$
declare
  cat_groceries uuid;
  cat_restaurants uuid;
  cat_gas uuid;
  cat_shopping uuid;
  cat_entertainment uuid;
  cat_subscriptions uuid;
  cat_utilities uuid;
  cat_housing uuid;
  cat_fun uuid;
  cat_income uuid;
  cat_transfers uuid;
  checking_id uuid := 'a1000000-0000-0000-0000-000000000001';
  savings_id uuid := 'a1000000-0000-0000-0000-000000000002';
  credit_id uuid := 'a1000000-0000-0000-0000-000000000003';
begin
  select id into cat_groceries from categories where name = 'Groceries' limit 1;
  select id into cat_restaurants from categories where name = 'Restaurants' limit 1;
  select id into cat_gas from categories where name = 'Gas' limit 1;
  select id into cat_shopping from categories where name = 'Shopping' limit 1;
  select id into cat_entertainment from categories where name = 'Entertainment' limit 1;
  select id into cat_subscriptions from categories where name = 'Subscriptions' limit 1;
  select id into cat_utilities from categories where name = 'Utilities' limit 1;
  select id into cat_housing from categories where name = 'Housing' limit 1;
  select id into cat_fun from categories where name = 'Fun' limit 1;
  select id into cat_income from categories where name = 'Income' limit 1;
  select id into cat_transfers from categories where name = 'Transfers' limit 1;

  -- May 2026 transactions (chequing)
  insert into transactions (account_id, date, merchant, amount, category_id, is_transfer, is_recurring) values
    (checking_id, '2026-05-19', 'Safeway', -89.43, cat_groceries, false, false),
    (checking_id, '2026-05-18', 'Shell', -72.10, cat_gas, false, false),
    (checking_id, '2026-05-17', 'Tim Hortons', -8.75, cat_restaurants, false, false),
    (checking_id, '2026-05-16', 'Netflix', -19.99, cat_subscriptions, false, true),
    (checking_id, '2026-05-15', 'ATCO Gas', -124.00, cat_utilities, false, true),
    (checking_id, '2026-05-15', 'Employer Inc.', 3200.00, cat_income, false, true),
    (checking_id, '2026-05-14', 'Costco', -214.67, cat_groceries, false, false),
    (checking_id, '2026-05-13', 'Boston Pizza', -67.50, cat_restaurants, false, false),
    (checking_id, '2026-05-12', 'Amazon', -43.21, cat_shopping, false, false),
    (checking_id, '2026-05-11', 'Spotify', -10.99, cat_subscriptions, false, true),
    (checking_id, '2026-05-10', 'Superstore', -134.22, cat_groceries, false, false),
    (checking_id, '2026-05-09', 'Petro-Canada', -68.40, cat_gas, false, false),
    (checking_id, '2026-05-08', 'Crave', -22.99, cat_subscriptions, false, true),
    (checking_id, '2026-05-07', 'Starbucks', -14.75, cat_restaurants, false, false),
    (checking_id, '2026-05-06', 'Home Depot', -89.99, cat_shopping, false, false),
    (checking_id, '2026-05-05', 'Cineplex', -38.00, cat_entertainment, false, false),
    (checking_id, '2026-05-04', 'Apple', -1.29, cat_subscriptions, false, false),
    (checking_id, '2026-05-03', 'ENMAX', -98.50, cat_utilities, false, true),
    (checking_id, '2026-05-02', 'Earls Restaurant', -112.40, cat_restaurants, false, false),
    (checking_id, '2026-05-01', 'Rent', -1850.00, cat_housing, false, true);

  -- Credit card transactions (May)
  insert into transactions (account_id, date, merchant, amount, category_id, is_transfer, is_recurring) values
    (credit_id, '2026-05-18', 'Winners', -67.43, cat_shopping, false, false),
    (credit_id, '2026-05-17', 'McDonald''s', -12.89, cat_restaurants, false, false),
    (credit_id, '2026-05-15', 'Sport Chek', -149.99, cat_shopping, false, false),
    (credit_id, '2026-05-13', 'Liquor Depot', -54.20, cat_fun, false, false),
    (credit_id, '2026-05-11', 'GoodLife Fitness', -55.00, cat_subscriptions, false, true),
    (credit_id, '2026-05-09', 'Esso', -71.80, cat_gas, false, false),
    (credit_id, '2026-05-07', 'Indigo', -32.99, cat_shopping, false, false),
    (credit_id, '2026-05-05', 'A&W', -18.45, cat_restaurants, false, false),
    (credit_id, '2026-05-03', 'Ticketmaster', -95.00, cat_entertainment, false, false);

  -- April 2026 transactions
  insert into transactions (account_id, date, merchant, amount, category_id, is_transfer, is_recurring) values
    (checking_id, '2026-04-30', 'Safeway', -102.11, cat_groceries, false, false),
    (checking_id, '2026-04-28', 'Shell', -69.55, cat_gas, false, false),
    (checking_id, '2026-04-25', 'Netflix', -19.99, cat_subscriptions, false, true),
    (checking_id, '2026-04-22', 'Costco', -187.44, cat_groceries, false, false),
    (checking_id, '2026-04-20', 'ATCO Gas', -138.00, cat_utilities, false, true),
    (checking_id, '2026-04-15', 'Employer Inc.', 3200.00, cat_income, false, true),
    (checking_id, '2026-04-14', 'Superstore', -98.33, cat_groceries, false, false),
    (checking_id, '2026-04-12', 'Spotify', -10.99, cat_subscriptions, false, true),
    (checking_id, '2026-04-10', 'Starbucks', -11.25, cat_restaurants, false, false),
    (checking_id, '2026-04-08', 'GoodLife Fitness', -55.00, cat_subscriptions, false, true),
    (checking_id, '2026-04-05', 'Boston Pizza', -78.20, cat_restaurants, false, false),
    (checking_id, '2026-04-03', 'ENMAX', -104.25, cat_utilities, false, true),
    (checking_id, '2026-04-01', 'Rent', -1850.00, cat_housing, false, true);

  -- Sample budgets for current month
  insert into budgets (category_id, amount, month) values
    (cat_groceries, 800.00, '2026-05'),
    (cat_restaurants, 300.00, '2026-05'),
    (cat_gas, 200.00, '2026-05'),
    (cat_shopping, 250.00, '2026-05'),
    (cat_entertainment, 100.00, '2026-05'),
    (cat_subscriptions, 150.00, '2026-05'),
    (cat_utilities, 300.00, '2026-05'),
    (cat_housing, 1900.00, '2026-05'),
    (cat_fun, 200.00, '2026-05')
  on conflict (category_id, month) do nothing;

end $$;
