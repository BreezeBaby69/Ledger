'use client'

import type { Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, Building2, PiggyBank } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  accounts: Account[]
}

const ACCOUNT_ICONS = {
  checking: Building2,
  savings: PiggyBank,
  credit_card: CreditCard,
}

const ACCOUNT_GRADIENTS = {
  checking: 'from-emerald-600/20 to-emerald-900/20',
  savings: 'from-blue-600/20 to-blue-900/20',
  credit_card: 'from-violet-600/20 to-violet-900/20',
}

export default function AccountCards({ accounts }: Props) {
  if (accounts.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Accounts
      </h2>
      <div className="space-y-2">
        {accounts.map(account => {
          const Icon = ACCOUNT_ICONS[account.type]
          const gradient = ACCOUNT_GRADIENTS[account.type]
          const isCredit = account.type === 'credit_card'

          return (
            <a
              key={account.id}
              href="/accounts"
              className={cn(
                'flex items-center gap-3 p-4 rounded-2xl border bg-gradient-to-r',
                gradient,
                'bg-card hover:brightness-110 transition-all duration-200 touch-active'
              )}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: account.color + '33', border: `1px solid ${account.color}44` }}
              >
                <Icon size={18} style={{ color: account.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {account.institution}
                  {account.last_four && ` •••• ${account.last_four}`}
                </p>
              </div>
              <div className="text-right">
                <p className={cn(
                  'text-sm font-semibold tabular-nums',
                  isCredit && account.balance > 0 ? 'text-rose-400' : ''
                )}>
                  {isCredit && account.balance > 0 ? '-' : ''}{formatCurrency(account.balance)}
                </p>
                {isCredit && account.credit_limit && (
                  <p className="text-[10px] text-muted-foreground">
                    of {formatCurrency(account.credit_limit)} limit
                  </p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
