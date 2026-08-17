'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getCurrentMonth } from '@/lib/utils'
import { ArrowLeft, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subMonths, parseISO } from 'date-fns'
import TransactionEditModal from '@/components/transactions/TransactionEditModal'
import type { Account, Transaction, Category } from '@/lib/types'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [dateRange, setDateRange] = useState<string>(getCurrentMonth())
  const [loading, setLoading] = useState(true)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { if (selectedAccount) loadTransactions() }, [selectedAccount, dateRange])

  async function loadAccounts() {
    setLoading(true)
    const [{ data: accs }, { data: cats }] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      supabase.from('categories').select('*').order('name'),
    ])
    setAccounts(accs || [])
    setAllAccounts(accs || [])
    setCategories(cats || [])
    setLoading(false)
  }

  async function loadTransactions() {
    if (!selectedAccount) return
    setLoading(true)

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), account:accounts(*)')
      .eq('account_id', selectedAccount.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (dateRange !== 'all') {
      const start = dateRange + '-01'
      const end = new Date(parseInt(dateRange.split('-')[0]), parseInt(dateRange.split('-')[1]), 0).toISOString().split('T')[0]
      query = query.gte('date', start).lte('date', end)
    }

    const { data } = await query
    setTransactions(data || [])
    setLoading(false)
  }

  async function deleteTxn(id: string) {
    if (!confirm('Delete this transaction?')) return
    setDeletingId(id)
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  // Month options
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy').toUpperCase() }
  })

  const totalSpent = transactions.filter(t => t.amount < 0 && !t.is_transfer).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIncome = transactions.filter(t => t.amount > 0 && !t.is_transfer).reduce((s, t) => s + t.amount, 0)

  // Group by date
  const grouped: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push(t)
  }
  const dateGroups = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))

  // Account list view
  if (!selectedAccount) {
    return (
      <div className="space-y-4 page-transition">
        <p className="opt-label">// SELECT ACCOUNT</p>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="shimmer rounded" style={{ height: '72px' }} />)}</div>
        ) : accounts.length === 0 ? (
          <div className="opt-card p-8 text-center">
            <p className="opt-label">NO ACCOUNTS · ADD ONE IN SETTINGS</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => setSelectedAccount(acc)}
                className="w-full opt-card p-4 text-left touch-active transition-all"
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-cyan-active)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-cyan)')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: acc.color + '22', border: `1px solid ${acc.color}55`, borderRadius: '2px' }}>
                    {acc.type === 'credit_card' ? '💳' : acc.type === 'savings' ? '💰' : '🏦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
                      {acc.name.toUpperCase()}
                    </p>
                    <p className="opt-label" style={{ marginTop: '3px' }}>
                      {acc.institution}{acc.last_four && ` ···· ${acc.last_four}`} · {acc.type.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--cyan)' }}>→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Account transaction view
  return (
    <div className="space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedAccount(null)} className="p-2 touch-active" style={{ color: 'var(--cyan)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '0.15em', color: 'var(--cyan)', textShadow: '0 0 10px var(--cyan-glow)' }} className="truncate">
            {selectedAccount.name.toUpperCase()}
          </p>
          <p className="opt-label" style={{ marginTop: '2px' }}>{selectedAccount.institution}</p>
        </div>
      </div>

      {/* Date filter */}
      <select
        value={dateRange}
        onChange={e => setDateRange(e.target.value)}
        className="opt-input"
        style={{ fontSize: '11px' }}
      >
        <option value="all">ALL TIME</option>
        {monthOptions.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {/* Summary */}
      <div className="flex gap-2">
        <div className="opt-card flex-1 p-3 text-center">
          <p className="opt-label">TRANSACTIONS</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--cyan)', textShadow: '0 0 10px var(--cyan-glow)', marginTop: '4px' }}>
            {transactions.length}
          </p>
        </div>
        <div className="opt-card flex-1 p-3 text-center">
          <p className="opt-label">SPENT</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--orange)', marginTop: '4px' }}>
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="opt-card flex-1 p-3 text-center">
          <p className="opt-label">INCOME</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--green)', marginTop: '4px' }}>
            {formatCurrency(totalIncome)}
          </p>
        </div>
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="shimmer rounded" style={{ height: '60px' }} />)}</div>
      ) : dateGroups.length === 0 ? (
        <div className="opt-card p-8 text-center">
          <p className="opt-label">NO TRANSACTIONS</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map(([date, txns]) => (
            <div key={date}>
              <p className="opt-label mb-2">{formatDate(date, 'EEE MMM d yyyy').toUpperCase()}</p>
              <div className="opt-card overflow-hidden">
                {txns.map((txn, i) => (
                  <div key={txn.id} className={cn('flex items-center gap-3 px-4 py-3', i !== txns.length - 1 && 'opt-row')}>
                    <button onClick={() => setSelectedTxn(txn)} className="flex items-center gap-3 flex-1 min-w-0 text-left touch-active">
                      <div className="w-8 h-8 flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid var(--border-cyan)', borderRadius: '2px' }}>
                        {(txn.category as any)?.icon || '◈'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }} className="truncate">{txn.merchant}</p>
                        <p className="opt-label" style={{ marginTop: '1px' }}>
                          {(txn.category as any)?.name || 'UNCATEGORIZED'}
                          {txn.is_transfer && ' · TRANSFER'}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '13px',
                        color: txn.amount > 0 ? 'var(--green)' : 'var(--text-primary)',
                        textShadow: txn.amount > 0 ? '0 0 8px rgba(0,255,136,0.3)' : 'none',
                      }}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                      <button
                        onClick={() => deleteTxn(txn.id)}
                        disabled={deletingId === txn.id}
                        className="p-1.5 touch-active"
                        style={{ color: 'var(--red)', opacity: deletingId === txn.id ? 0.4 : 0.6 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-2" />

      {selectedTxn && (
        <TransactionEditModal
          transaction={selectedTxn}
          categories={categories}
          accounts={allAccounts}
          onClose={() => setSelectedTxn(null)}
          onSave={() => { setSelectedTxn(null); loadTransactions() }}
        />
      )}
    </div>
  )
}
