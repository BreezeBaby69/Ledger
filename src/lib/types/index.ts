export type AccountType = 'checking' | 'savings' | 'credit_card'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  color: string
  institution: string
  last_four?: string
  credit_limit?: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  parent_id?: string
  is_system: boolean
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  account?: Account
  date: string
  merchant: string
  amount: number // negative = expense, positive = income/refund
  category_id?: string
  category?: Category
  notes?: string
  tags?: string[]
  is_transfer: boolean
  is_recurring: boolean
  recurring_id?: string
  import_batch_id?: string
  splits?: TransactionSplit[]
  created_at: string
  updated_at: string
}

export interface TransactionSplit {
  id: string
  transaction_id: string
  category_id: string
  category?: Category
  amount: number
  notes?: string
}

export interface Budget {
  id: string
  category_id: string
  category?: Category
  amount: number
  month: string // YYYY-MM
  spent: number
  created_at: string
}

export interface MerchantRule {
  id: string
  merchant_pattern: string
  category_id: string
  category?: Category
  match_type: 'exact' | 'contains' | 'starts_with'
  created_at: string
}

export interface ImportBatch {
  id: string
  account_id: string
  filename: string
  status: 'processing' | 'review' | 'imported' | 'failed'
  statement_period_start?: string
  statement_period_end?: string
  transaction_count: number
  imported_count: number
  created_at: string
}

export interface PendingTransaction {
  id: string
  batch_id: string
  date: string
  merchant: string
  amount: number
  suggested_category_id?: string
  suggested_category?: Category
  is_transfer_candidate: boolean
  is_duplicate_candidate: boolean
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  raw_text?: string
}

export interface RecurringTransaction {
  id: string
  merchant: string
  amount: number
  category_id?: string
  category?: Category
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  next_expected?: string
  last_seen?: string
  transaction_ids: string[]
}

export interface MonthlyStats {
  month: string
  total_spent: number
  total_income: number
  net: number
  by_category: {
    category_id: string
    category_name: string
    category_color: string
    amount: number
    budget_amount?: number
    transaction_count: number
  }[]
}

export type ColorName =
  | 'emerald' | 'violet' | 'coral' | 'amber' | 'sky'
  | 'rose' | 'indigo' | 'teal' | 'orange' | 'cyan'
