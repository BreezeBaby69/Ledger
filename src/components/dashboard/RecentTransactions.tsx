'use client'

import type { Transaction } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props { transactions: Transaction[] }

export default function RecentTransactions({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="opt-card p-8 text-center">
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.2em' }}>
          NO DATA // IMPORT STATEMENT
        </p>
      </div>
    )
  }

  return (
    <div className="opt-card overflow-hidden">
      {transactions.map((txn, i) => (
        <div key={txn.id} className="flex items-center gap-3 px-4 py-3 touch-active opt-row" style={{ transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,245,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-sm"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid var(--border-cyan)' }}>
            {(txn.category as any)?.icon || '◈'}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }} className="truncate">{txn.merchant}</p>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
              {formatDate(txn.date)} · {(txn.category as any)?.name || 'UNCATEGORIZED'}
            </p>
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            color: txn.amount > 0 ? 'var(--green)' : 'var(--text-primary)',
            textShadow: txn.amount > 0 ? '0 0 8px rgba(0,255,136,0.3)' : 'none',
          }}>
            {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
