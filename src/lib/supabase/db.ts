import { createClient } from './server'
import type { Transaction, Account, Budget, Category, MerchantRule, MonthlyStats } from '../types'
import { getMonthRange } from '../utils'

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getTransactions(options: {
  month?: string
  account_id?: string
  category_id?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<Transaction[]> {
  const supabase = createClient()
  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(*),
      category:categories(*),
      splits:transaction_splits(*, category:categories(*))
    `)
    .order('date', { ascending: false })

  if (options.month) {
    const { start, end } = getMonthRange(options.month)
    query = query.gte('date', start).lte('date', end)
  }
  if (options.account_id) query = query.eq('account_id', options.account_id)
  if (options.category_id) query = query.eq('category_id', options.category_id)
  if (options.search) query = query.ilike('merchant', `%${options.search}%`)
  if (options.limit) query = query.limit(options.limit)
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getBudgets(month: string): Promise<Budget[]> {
  const supabase = createClient()
  const { start, end } = getMonthRange(month)

  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('month', month)
  if (budgetError) throw budgetError

  // Calculate spent for each budget
  const { data: txns, error: txnError } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .gte('date', start)
    .lte('date', end)
    .eq('is_transfer', false)
    .lt('amount', 0)
  if (txnError) throw txnError

  const spentByCategory: Record<string, number> = {}
  for (const t of txns || []) {
    if (t.category_id) {
      spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Math.abs(t.amount)
    }
  }

  return (budgets || []).map(b => ({
    ...b,
    spent: spentByCategory[b.category_id] || 0,
  }))
}

export async function getMonthlyStats(month: string): Promise<MonthlyStats> {
  const supabase = createClient()
  const { start, end } = getMonthRange(month)

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .gte('date', start)
    .lte('date', end)
    .eq('is_transfer', false)
  if (error) throw error

  const transactions = txns || []
  const expenses = transactions.filter(t => t.amount < 0)
  const income = transactions.filter(t => t.amount > 0)

  const byCategory: Record<string, MonthlyStats['by_category'][0]> = {}
  for (const t of expenses) {
    const catId = t.category_id || 'uncategorized'
    if (!byCategory[catId]) {
      byCategory[catId] = {
        category_id: catId,
        category_name: t.category?.name || 'Uncategorized',
        category_color: t.category?.color || '#94a3b8',
        amount: 0,
        transaction_count: 0,
      }
    }
    byCategory[catId].amount += Math.abs(t.amount)
    byCategory[catId].transaction_count++
  }

  return {
    month,
    total_spent: expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    total_income: income.reduce((sum, t) => sum + t.amount, 0),
    net: transactions.reduce((sum, t) => sum + t.amount, 0),
    by_category: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
  }
}

export async function getMerchantRules(): Promise<MerchantRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('*, category:categories(*)')
  if (error) throw error
  return data || []
}

export async function applyCategoryRule(merchant: string, rules: MerchantRule[]): Promise<string | null> {
  for (const rule of rules) {
    switch (rule.match_type) {
      case 'exact':
        if (merchant.toLowerCase() === rule.merchant_pattern.toLowerCase()) return rule.category_id
        break
      case 'contains':
        if (merchant.toLowerCase().includes(rule.merchant_pattern.toLowerCase())) return rule.category_id
        break
      case 'starts_with':
        if (merchant.toLowerCase().startsWith(rule.merchant_pattern.toLowerCase())) return rule.category_id
        break
    }
  }
  return null
}
