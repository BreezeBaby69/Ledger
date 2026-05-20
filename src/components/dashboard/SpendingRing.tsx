'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthlyStats, Budget } from '@/lib/types'
import { formatCurrency, getSpendingPercent } from '@/lib/utils'

interface Props {
  stats: MonthlyStats
  budgets: Budget[]
}

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
    <div className="bg-card rounded-2xl p-4 border">
      <div className="flex items-start gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {pct !== null ? (
              <>
                <span className={`text-lg font-bold tabular-nums ${isOver ? 'text-rose-400' : 'text-foreground'}`}>
                  {pct}%
                </span>
                <span className="text-[9px] text-muted-foreground">of budget</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground text-center leading-tight">No<br/>budget</span>
            )}
          </div>
        </div>

        {/* Categories list */}
        <div className="flex-1 min-w-0 space-y-2">
          {chartData.slice(0, 4).map(cat => {
            const pctOfTotal = Math.round((cat.value / stats.total_spent) * 100)
            return (
              <div key={cat.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs text-muted-foreground truncate flex-1">{cat.name}</span>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-medium tabular-nums">{formatCurrency(cat.value)}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">{pctOfTotal}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total Spent</span>
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(stats.total_spent)}</span>
      </div>
    </div>
  )
}
