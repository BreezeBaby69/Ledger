'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account, Transaction } from '@/lib/types'
import { formatCurrency, formatDate, getCurrentMonth } from '@/lib/utils'
import { CreditCard, Building2, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCOUNT_ICONS = { checking: Building2, savings: PiggyBank, credit_card: CreditCard }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { if (selected) loadTxns(selected) }, [selected])

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('*').order('created_at')
    setAccounts(data || [])
    if (data?.length) setSelected(data[0].id)
    setLoading(false)
  }

  async function loadTxns(accountId: string) {
    const month = getCurrentMonth()
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('account_id', accountId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
      .limit(20)
    setTxns(data || [])
  }

  const account = accounts.find(a => a.id === selected)
  const monthSpent = txns.filter(t => t.amount < 0 && !t.is_transfer).reduce((s, t) => s + Math.abs(t.amount), 0)
  const monthIncome = txns.filter(t => t.amount > 0 && !t.is_transfer).reduce((s, t) => s + t.amount, 0)

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer" />)}</div>

  return (
    <div className="space-y-4 page-transition">
      {/* Account selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {accounts.map(acc => {
          const Icon = ACCOUNT_ICONS[acc.type]
          return (
            <button
              key={acc.id}
              onClick={() => setSelected(acc.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all',
                selected === acc.id ? 'border-violet-500 bg-violet-500/10' : 'border-border bg-card'
              )}
            >
              <Icon size={15} style={{ color: acc.color }} />
              <span className="text-sm font-medium whitespace-nowrap">{acc.name}</span>
            </button>
          )
        })}
      </div>

      {account && (
        <>
          {/* Account hero */}
          <div className="rounded-2xl p-5 border" style={{
            background: `linear-gradient(135deg, ${account.color}22, ${account.color}11)`
          }}>
            <div className="flex items-center gap-3 mb-4">
              {(() => { const Icon = ACCOUNT_ICONS[account.type]; return <Icon size={20} style={{ color: account.color }} /> })()}
              <div>
                <p className="font-semibold">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.institution}{account.last_four && ` •••• ${account.last_four}`}</p>
              </div>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{formatCurrency(account.balance)}</p>
            {account.type === 'credit_card' && account.credit_limit && (
              <>
                <p className="text-xs text-muted-foreground mt-1">of {formatCurrency(account.credit_limit)} limit</p>
                <div className="mt-3 h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-white/60" style={{ width: `${Math.min((account.balance / account.credit_limit) * 100, 100)}%` }} />
                </div>
              </>
            )}
          </div>

          {/* This month stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border p-4">
              <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                <TrendingDown size={14} /><span className="text-xs font-medium">Spent</span>
              </div>
              <p className="text-xl font-semibold tabular-nums">{formatCurrency(monthSpent)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">this month</p>
            </div>
            <div className="bg-card rounded-2xl border p-4">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <TrendingUp size={14} /><span className="text-xs font-medium">Income</span>
              </div>
              <p className="text-xl font-semibold tabular-nums">{formatCurrency(monthIncome)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">this month</p>
            </div>
          </div>

          {/* Recent transactions */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</h2>
            <div className="bg-card rounded-2xl border overflow-hidden">
              {txns.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No transactions this month</div>
              ) : (
                txns.map((t, i) => (
                  <div key={t.id} className={cn('flex items-center gap-3 px-4 py-3', i !== txns.length - 1 && 'border-b')}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ backgroundColor: ((t.category as any)?.color || '#94a3b8') + '22' }}>
                      {(t.category as any)?.icon || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.merchant}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                    <span className={cn('text-sm font-medium tabular-nums', t.amount > 0 ? 'text-emerald-400' : '')}>
                      {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {accounts.length === 0 && (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <p className="text-muted-foreground text-sm mb-2">No accounts yet</p>
          <a href="/settings" className="text-violet-400 text-sm font-medium">Add your first account →</a>
        </div>
      )}
    </div>
  )
}
