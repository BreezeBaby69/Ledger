'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, Category, Account } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import TransactionEditModal from '@/components/transactions/TransactionEditModal'
import { getCurrentMonth } from '@/lib/utils'
import { format, parseISO, subMonths } from 'date-fns'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [month, setMonth] = useState(getCurrentMonth())
  const [loading, setLoading] = useState(true)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMeta()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [search, selectedCategory, selectedAccount, month])

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
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
      .toISOString().split('T')[0]

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), account:accounts(*)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

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

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') }
  })

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
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-card border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none flex-shrink-0"
        >
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="bg-card border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none flex-shrink-0"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

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
          { label: 'Transactions', value: transactions.length.toString() },
          { label: 'Spent', value: formatCurrency(transactions.filter(t => t.amount < 0 && !t.is_transfer).reduce((s, t) => s + Math.abs(t.amount), 0)) },
          { label: 'Income', value: formatCurrency(transactions.filter(t => t.amount > 0 && !t.is_transfer).reduce((s, t) => s + t.amount, 0)) },
        ].map(stat => (
          <div key={stat.label} className="flex-1 bg-card border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">{stat.value}</p>
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
                {formatDate(date, 'EEEE, MMMM d')}
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
                      style={{ backgroundColor: (txn.category?.color || '#94a3b8') + '22' }}
                    >
                      {txn.category?.icon || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {txn.category?.name || 'Uncategorized'}
                        {txn.is_transfer && ' · Transfer'}
                        {txn.is_recurring && ' · Recurring'}
                      </p>
                    </div>
                    <span className={cn(
                      'text-sm font-medium tabular-nums',
                      txn.amount > 0 ? 'text-emerald-400' : ''
                    )}>
                      {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
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
