'use client'

import type { Budget } from '@/lib/types'
import { formatCurrency, getSpendingPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  budget: Budget
}

export default function BudgetCard({ budget }: Props) {
  const pct = getSpendingPercent(budget.spent, budget.amount)
  const isOver = pct > 100
  const remaining = budget.amount - budget.spent
  const color = budget.category?.color || '#8b5cf6'

  return (
    <div className="bg-card rounded-2xl p-4 border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{budget.category?.icon || '📦'}</span>
          <span className="text-sm font-medium">{budget.category?.name || 'Budget'}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(budget.spent)}</span>
          <span className="text-xs text-muted-foreground"> / {formatCurrency(budget.amount)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-700',
            isOver ? 'bg-rose-500' : ''
          )}
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: isOver ? undefined : color,
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className={cn(
          'text-xs',
          isOver ? 'text-rose-400' : 'text-muted-foreground'
        )}>
          {isOver
            ? `${formatCurrency(Math.abs(remaining))} over budget`
            : `${formatCurrency(remaining)} left`
          }
        </span>
        <span className={cn(
          'text-xs font-medium tabular-nums',
          isOver ? 'text-rose-400' : 'text-muted-foreground'
        )}>
          {pct}%
        </span>
      </div>
    </div>
  )
}
