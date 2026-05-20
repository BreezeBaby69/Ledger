'use client'

import type { Transaction } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

export default function RecentTransactions({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground text-sm">No transactions yet</p>
        <p className="text-xs text-muted-foreground mt-1">Upload a statement to get started</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      {transactions.map((txn, i) => (
        <div
          key={txn.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors touch-active',
            i !== transactions.length - 1 && 'border-b'
          )}
        >
          {/* Category icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
            style={{ backgroundColor: (txn.category?.color || '#94a3b8') + '22' }}
          >
            {txn.category?.icon || '📦'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{txn.merchant}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(txn.date)} · {txn.category?.name || 'Uncategorized'}
            </p>
          </div>

          <span className={cn(
            'text-sm font-medium tabular-nums flex-shrink-0',
            txn.amount > 0 ? 'text-emerald-400' : 'text-foreground'
          )}>
            {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
