'use client'

import type { Budget } from '@/lib/types'
import { formatCurrency, getSpendingPercent } from '@/lib/utils'

interface Props { budget: Budget }

export default function BudgetCard({ budget }: Props) {
  const pct = getSpendingPercent(budget.spent, budget.amount)
  const isOver = pct > 100
  const remaining = budget.amount - budget.spent

  return (
    <div className="opt-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{budget.category?.icon || '📦'}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
            {(budget.category?.name || 'Budget').toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: isOver ? 'var(--red)' : 'var(--cyan)' }}>
            {formatCurrency(budget.spent)}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> / {formatCurrency(budget.amount)}</span>
        </div>
      </div>
      <div className="opt-progress-track">
        <div className={`opt-progress-fill ${isOver ? 'over' : ''}`} style={{ width: `${Math.min(pct, 100)}%`, background: isOver ? 'var(--red)' : budget.category?.color || 'var(--cyan)', boxShadow: isOver ? '0 0 6px var(--red)' : `0 0 6px ${budget.category?.color || 'var(--cyan)'}` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span style={{ fontSize: '10px', color: isOver ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
          {isOver ? `${formatCurrency(Math.abs(remaining))} OVER` : `${formatCurrency(remaining)} LEFT`}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: isOver ? 'var(--red)' : 'var(--text-muted)' }}>{pct}%</span>
      </div>
    </div>
  )
}
