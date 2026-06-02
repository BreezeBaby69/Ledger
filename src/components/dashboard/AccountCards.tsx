'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'
import { formatCurrency, getCurrentMonth } from '@/lib/utils'
import { CreditCard, Building2, PiggyBank } from 'lucide-react'
import { format } from 'date-fns'

const ACCOUNT_ICONS = { checking: Building2, savings: PiggyBank, credit_card: CreditCard }
const ACCOUNT_LABELS = { checking: 'CHEQUING', savings: 'SAVINGS', credit_card: 'CREDIT' }

interface AccountWithStats extends Account {
  spent: number; income: number; txn_count: number; last_import?: string
}

interface Props { accounts: Account[] }

export default function AccountCards({ accounts }: Props) {
  const [accountStats, setAccountStats] = useState<AccountWithStats[]>([])
  const supabase = createClient()
  const month = getCurrentMonth()

  useEffect(() => { if (accounts.length > 0) loadStats() }, [accounts])

  async function loadStats() {
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const [{ data: txns }, { data: allTxns }] = await Promise.all([
      supabase.from('transactions').select('account_id, amount, is_transfer').gte('date', start).lte('date', end).in('account_id', accounts.map(a => a.id)),
      supabase.from('transactions').select('account_id, date').in('account_id', accounts.map(a => a.id)).order('date', { ascending: false }),
    ])

    const lastImport: Record<string, string> = {}
    for (const t of allTxns || []) {
      if (!lastImport[t.account_id]) lastImport[t.account_id] = t.date
    }

    const stats: Record<string, { spent: number; income: number; count: number }> = {}
    for (const t of txns || []) {
      if (!stats[t.account_id]) stats[t.account_id] = { spent: 0, income: 0, count: 0 }
      if (!t.is_transfer) {
        if (t.amount < 0) stats[t.account_id].spent += Math.abs(t.amount)
        if (t.amount > 0) stats[t.account_id].income += t.amount
        stats[t.account_id].count++
      }
    }

    setAccountStats(accounts.map(a => ({
      ...a,
      spent: stats[a.id]?.spent || 0,
      income: stats[a.id]?.income || 0,
      txn_count: stats[a.id]?.count || 0,
      last_import: lastImport[a.id],
    })))
  }

  if (accounts.length === 0) return null

  return (
    <div>
      <p className="opt-label mb-3">// ACCOUNTS</p>
      <div className="space-y-2">
        {accountStats.map(account => {
          const Icon = ACCOUNT_ICONS[account.type]
          const isCredit = account.type === 'credit_card'
          const net = account.income - account.spent

          return (
            <a key={account.id} href="/accounts" className="opt-card flex items-center gap-3 p-4 touch-active block"
              style={{ textDecoration: 'none', transition: 'border-color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-cyan-active)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-cyan)')}>
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,245,255,0.06)', border: `1px solid ${account.color}55`, borderRadius: '2px' }}>
                <Icon size={16} style={{ color: account.color, filter: `drop-shadow(0 0 4px ${account.color})` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-primary)' }} className="truncate">
                    {account.name.toUpperCase()}
                  </p>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                  <span>{ACCOUNT_LABELS[account.type]}</span>
                  <span>·</span>
                  <span>{account.txn_count} TXN</span>
                  {account.last_import && <><span>·</span><span>LAST {format(new Date(account.last_import), 'MMM d').toUpperCase()}</span></>}
                </div>
                {(account.spent > 0 || account.income > 0) && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-3">
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--orange)' }}>−{formatCurrency(account.spent)}</span>
                        {!isCredit && account.income > 0 && (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--green)' }}>+{formatCurrency(account.income)}</span>
                        )}
                      </div>
                      {!isCredit && (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {net >= 0 ? '+' : ''}{formatCurrency(net)} NET
                        </span>
                      )}
                    </div>
                    {!isCredit && account.income > 0 && (
                      <div className="opt-progress-track">
                        <div style={{
                          height: '100%',
                          width: `${Math.min((account.spent / account.income) * 100, 100)}%`,
                          background: account.spent > account.income ? 'var(--red)' : 'var(--cyan)',
                          boxShadow: `0 0 4px ${account.spent > account.income ? 'var(--red)' : 'var(--cyan)'}`,
                          transition: 'width 0.7s',
                        }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
