'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { MonthlyStats, Budget } from '@/lib/types'
import { formatCurrency, getSpendingPercent } from '@/lib/utils'

interface Props { stats: MonthlyStats; budgets: Budget[] }

export default function SpendingRing({ stats, budgets }: Props) {
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const pct = totalBudget > 0 ? getSpendingPercent(stats.total_spent, totalBudget) : null
  const isOver = pct !== null && pct > 100

  const chartData = stats.by_category.slice(0, 6).map(c => ({
    name: c.category_name,
    value: c.amount,
    color: c.category_color,
  }))

  if (chartData.length === 0) return null

  return (
    <div className="opt-card p-4">
      <p className="opt-label mb-3">// SPENDING BREAKDOWN</p>
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={36} outerRadius={50}
                paddingAngle={3} dataKey="value" stroke="none">
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color})` }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {pct !== null ? (
              <>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: isOver ? 'var(--red)' : 'var(--cyan)', textShadow: isOver ? '0 0 10px rgba(255,59,92,0.5)' : '0 0 10px var(--cyan-glow)' }}>
                  {pct}%
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '7px', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>BUDGET</span>
              </>
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>NO<br/>BUDGET</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {chartData.slice(0, 4).map(cat => {
            const pctOfTotal = Math.round((cat.value / stats.total_spent) * 100)
            return (
              <div key={cat.name} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-none flex-shrink-0" style={{ background: cat.color, boxShadow: `0 0 4px ${cat.color}` }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }} className="truncate flex-1">{cat.name}</span>
                <div className="text-right flex-shrink-0">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-primary)' }}>{formatCurrency(cat.value)}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>{pctOfTotal}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-cyan)' }}>
        <span className="opt-label">TOTAL SPENT</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--orange)', textShadow: '0 0 8px rgba(255,107,0,0.3)' }}>
          {formatCurrency(stats.total_spent)}
        </span>
      </div>
    </div>
  )
}
