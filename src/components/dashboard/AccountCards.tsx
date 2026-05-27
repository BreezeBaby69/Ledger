'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'
import { formatCurrency, getCurrentMonth } from '@/lib/utils'
import { CreditCard, Building2, PiggyBank, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const ACCOUNT_ICONS = {
  checking: Building2,
  savings: PiggyBank,
  credit_card: CreditCard,
}

const ACCOUNT_TYPE_LABEL = {
  checking: 'Chequing',
  savings: 'Savings',
  credit_card: 'Credit Card',
}

interface AccountWithStats extends Account {
  spent: number
  income: number
  txn_count: number
  last_import?: string
}

interface Props {
  accounts: Account[]
}

export default function AccountCards({ accounts }: Props) {
  const [accountStats, setAccountStats] = useState<AccountWithStats[]>([])
  const supabase = createClient()
  const month = getCurrentMonth()

  useEffect(() => {
    if (accounts.length > 0) loadStats()
  }, [accounts, month])

  async function loadStats() {
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
      .toISOString().split('T')[0]

    const { data: txns } = await supabase
      .from('transactions')
      .select('account_id, amount, is_transfer, date')
      .gte('date', start)
      .lte('date', end)
      .in('account_id', accounts.map(a => a.id))

    // Also get last import date per account
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('account_id, date')
      .in('account_id', accounts.map(a => a.id))
      .order('date', { ascending: false })

    const lastImportByAccount: Record<string, string> = {}
    for (const t of allTxns || []) {
      if (!lastImportByAccount[t.account_id]) {
        lastImportByAccount[t.account_id] = t.date
      }
    }

    const statsByAccount: Record<string, { spent: number; income: number; count: number }> = {}
    for (const t of txns || []) {
      if (!statsByAccount[t.account_id]) {
        statsByAccount[t.account_id] = { spent: 0, income: 0, count: 0 }
      }
      if (!t.is_transfer) {
        if (t.amount < 0) statsByAccount[t.account_id].spent += Math.abs(t.amount)
        if (t.amount > 0) statsByAccount[t.account_id].income += t.amount
        statsByAccount[t.account_id].count++
      }
    }

    setAccountStats(accounts.map(a => ({
      ...a,
      spent: statsByAccount[a.id]?.spent || 0,
      income: statsByAccount[a.id]?.income || 0,
      txn_count: statsByAccount[a.id]?.count || 0,
      last_import: lastImportByAccount[a.id],
    })))
  }

  if (accounts.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Accounts
      </h2>
      <div className="space-y-2">
        {accountStats.map(account => {
          const Icon = ACCOUNT_ICONS[account.type]
          const isCredit = account.type === 'credit_card'

          return (
            <a
              key={account.id}
              href="/accounts"
              className="flex items-center gap-3 p-4 rounded-2xl border bg-card hover:bg-muted/50 transition-all duration-200 touch-active block"
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: account.color + '22', border: `1px solid ${account.color}44` }}
              >
                <Icon size={18} style={{ color: account.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <ArrowUpRight size={14} className="text-muted-foreground flex-shrink-0" />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{ACCOUNT_TYPE_LABEL[account.type]}</span>
                  <span>·</span>
                  <span>{account.txn_count} transactions</span>
                  {account.last_import && (
                    <>
                      <span>·</span>
                      <span>Last: {format(new Date(account.last_import), 'MMM d')}</span>
                    </>
                  )}
                </div>

                {/* Spending bar */}
                {(account.spent > 0 || account.income > 0) && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-rose-400">
                          −{formatCurrency(account.spent)}
                        </span>
                        {!isCredit && account.income > 0 && (
                          <span className="text-emerald-400">
                            +{formatCurrency(account.income)}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'font-medium tabular-nums',
                        !isCredit && account.income > account.spent
                          ? 'text-emerald-400'
                          : 'text-muted-foreground'
                      )}>
                        {!isCredit
                          ? `${account.income > account.spent ? '+' : ''}${formatCurrency(account.income - account.spent)} net`
                          : `${formatCurrency(account.spent)} spent`
                        }
                      </span>
                    </div>

                    {/* Visual bar */}
                    {!isCredit && account.income > 0 && (
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            account.spent > account.income ? 'bg-rose-500' : 'bg-emerald-500'
                          )}
                          style={{
                            width: `${Math.min((account.spent / account.income) * 100, 100)}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {account.txn_count === 0 && (
                  <p className="text-xs text-muted-foreground mt-1 italic">No transactions this month</p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
