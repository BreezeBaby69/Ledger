'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, Category, Account } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import TransactionEditModal from '@/components/transactions/TransactionEditModal'
import { getCurrentMonth } from '@/lib/utils'
import { format, subMonths, startOfYear } from 'date-fns'

// Date range option type
type DateRange =
  | { type: 'month'; value: string }       // YYYY-MM
  | { type: 'last3' }
  | { type: 'last6' }
  | { type: 'ytd' }
  | { type: 'all' }

function getDateBounds(range: DateRange): { start: string; end: string } | null {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  switch (range.type) {
    case 'month': {
      const [year, mon] = range.value.split('-').map(Number)
      const end = new Date(year, mon, 0).toISOString().split('T')[0]
      return { start: `${range.value}-01`, end }
    }
    case 'last3':
      return { start: format(subMonths(today, 3), 'yyyy-MM-dd'), end: todayStr }
    case 'last6':
      return { start: format(subMonths(today, 6), 'yyyy-MM-dd'), end: todayStr }
    case 'ytd':
      return { start: format(startOfYear(today), 'yyyy-MM-dd'), end: todayStr }
    case 'all':
      return null // no date filter
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>({ type: 'month', value: getCurrentMonth() })
  const [loading, setLoading] = useState(true)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const supabase = createClient()

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { loadTransactions() }, [search, selectedCategory, selectedAccount, dateRange])

  async function loadMeta() {
    const [{ data: cats }, { data: accs }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('accounts').select('*').order('name'),
    ])
    setCategories(cats || [])
    setAccounts(accs || [])
  }

  async function loadTransactions() {
    setLoading(true)
    const bounds = getDateBounds(dateRange)

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), account:accounts(*)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (bounds) {
      query = query.gte('date', bounds.start).lte('date', bounds.end)
    }
    if (search) query = query.ilike('merchant', `%${search}%`)
    if (selectedCategory) query = query.eq('category_id', selectedCategory)
    if (selectedAccount) query = query.eq('account_id', selectedAccount)

    const { data } = await query
    setTransactions(data || [])
    setLoading(false)
  }

  // Group by date
  const grouped: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push(t)
  }
  const dateGroups = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))

  // Build month options (last 24 months)
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') }
  })

  // Date range select value
  function getSelectValue(): string {
    if (dateRange.type === 'month') return `month:${dateRange.value}`
    return dateRange.type
  }

  function handleDateChange(val: string) {
    if (val === 'last3') setDateRange({ type: 'last3' })
    else if (val === 'last6') setDateRange({ type: 'last6' })
    else if (val === 'ytd') setDateRange({ type: 'ytd' })
    else if (val === 'all') setDateRange({ type: 'all' })
    else setDateRange({ type: 'month', value: val.replace('month:', '') })
  }

  // Date range label for summary
  function getDateLabel(): string {
    switch (dateRange.type) {
      case 'month': return format(new Date(dateRange.value + '-01'), 'MMMM yyyy')
      case 'last3': return 'Last 3 Months'
      case 'last6': return 'Last 6 Months'
      case 'ytd': return 'Year to Date'
      case 'all': return 'All Time'
    }
  }

  return (
    <div className="space-y-4 page-transition">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border rounded-xl pl-9 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {/* Date range selector */}
        <select
          value={getSelectValue()}
          onChange={e => handleDateChange(e.target.value)}
          className="bg-card border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none flex-shrink-0"
        >
          <optgroup label="Quick Ranges">
            <option value="last3">Last 3 Months</option>
            <option value="last6">Last 6 Months</option>
            <option value="ytd">Year to Date</option>
            <option value="all">All Time</option>
          </optgroup>
          <optgroup label="By Month">
            {monthOptions.map(m => (
              <option key={m.value} value={`month:${m.value}`}>{m.label}</option>
            ))}
          </optgroup>
        </select>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="bg-card border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none flex-shrink-0"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>

        {/* Account filter */}
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="bg-card border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none flex-shrink-0"
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        {[
          { label: getDateLabel(), value: `${transactions.length} transactions` },
          { label: 'Spent', value: formatCurrency(transactions.filter(t => t.amount < 0 && !t.is_transfer).reduce((s, t) => s + Math.abs(t.amount), 0)) },
          { label: 'Income', value: formatCurrency(transactions.filter(t => t.amount > 0 && !t.is_transfer).reduce((s, t) => s + t.amount, 0)) },
        ].map(stat => (
          <div key={stat.label} className="flex-1 bg-card border rounded-xl p-3 text-center min-w-0">
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5 truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}
        </div>
      ) : dateGroups.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <p className="text-muted-foreground text-sm">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map(([date, txns]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {formatDate(date, 'EEEE, MMMM d, yyyy')}
              </p>
              <div className="bg-card rounded-2xl border overflow-hidden">
                {txns.map((txn, i) => (
                  <button
                    key={txn.id}
                    onClick={() => setSelectedTxn(txn)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left touch-active',
                      i !== txns.length - 1 && 'border-b'
                    )}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ backgroundColor: ((txn.category as any)?.color || '#94a3b8') + '22' }}
                    >
                      {(txn.category as any)?.icon || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {(txn.category as any)?.name || 'Uncategorized'}
                        {txn.is_transfer && ' · Transfer'}
                        {txn.is_recurring && ' · Recurring'}
                      </p>
                    </div>
                    <span className={cn('text-sm font-medium tabular-nums flex-shrink-0', txn.amount > 0 ? 'text-emerald-400' : '')}>
                      {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTxn && (
        <TransactionEditModal
          transaction={selectedTxn}
          categories={categories}
          accounts={accounts}
          onClose={() => setSelectedTxn(null)}
          onSave={() => { setSelectedTxn(null); loadTransactions() }}
        />
      )}

      <div className="h-2" />
    </div>
  )
}
