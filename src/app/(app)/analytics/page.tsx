'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getCurrentMonth, getPreviousMonths } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [recurringData, setRecurringData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'spending' | 'trends' | 'recurring'>('spending')
  const supabase = createClient()

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    setLoading(true)
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    // Category breakdown
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, category:categories(name, color, icon)')
      .gte('date', start).lte('date', end)
      .eq('is_transfer', false).lt('amount', 0)

    const catMap: Record<string, { name: string; color: string; icon: string; amount: number }> = {}
    for (const t of txns || []) {
      const name = (t.category as any)?.name || 'Uncategorized'
      const color = (t.category as any)?.color || '#94a3b8'
      const icon = (t.category as any)?.icon || '📦'
      if (!catMap[name]) catMap[name] = { name, color, icon, amount: 0 }
      catMap[name].amount += Math.abs(t.amount)
    }
    setCategoryData(Object.values(catMap).sort((a, b) => b.amount - a.amount))

    // 6-month trend
    const months = getPreviousMonths(6)
    const trend = await Promise.all(months.map(async m => {
      const s = m + '-01'
      const e = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]), 0).toISOString().split('T')[0]
      const { data } = await supabase.from('transactions').select('amount').gte('date', s).lte('date', e).eq('is_transfer', false)
      const all = data || []
      return {
        month: format(parseISO(m + '-01'), 'MMM'),
        spent: all.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
        income: all.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      }
    }))
    setTrendData(trend)

    // Recurring
    const { data: recTxns } = await supabase
      .from('transactions')
      .select('merchant, amount, category:categories(name, color, icon)')
      .eq('is_recurring', true).lt('amount', 0)
      .order('amount', { ascending: true })

    const recMap: Record<string, any> = {}
    for (const t of recTxns || []) {
      const key = `${t.merchant}|${t.amount}`
      if (!recMap[key]) recMap[key] = { merchant: t.merchant, amount: Math.abs(t.amount), category: t.category }
    }
    setRecurringData(Object.values(recMap).sort((a, b) => b.amount - a.amount))

    setLoading(false)
  }

  const totalSpent = categoryData.reduce((s, c) => s + c.amount, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border rounded-xl p-3 text-xs shadow-lg">
        <p className="font-medium">{payload[0]?.name}</p>
        <p className="text-muted-foreground">{formatCurrency(payload[0]?.value)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 page-transition">
      {/* View tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {(['spending', 'trends', 'recurring'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer" />)}</div>
      ) : (
        <>
          {/* Spending breakdown */}
          {view === 'spending' && (
            <div className="space-y-4">
              {/* Donut chart */}
              <div className="bg-card rounded-2xl border p-4">
                <h3 className="text-sm font-semibold mb-4">Spending by Category</h3>
                <div className="flex items-center gap-4">
                  <div style={{ width: 140, height: 140 }} className="flex-shrink-0">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                          paddingAngle={2} dataKey="amount" stroke="none">
                          {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {categoryData.slice(0, 5).map(cat => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-muted-foreground truncate flex-1">{cat.name}</span>
                        <span className="text-xs font-medium tabular-nums flex-shrink-0">{Math.round(cat.amount / totalSpent * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category bars */}
              <div className="bg-card rounded-2xl border overflow-hidden">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className={cn('px-4 py-3', i !== categoryData.length - 1 && 'border-b')}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-sm font-medium flex-1">{cat.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.round(cat.amount / totalSpent * 100)}%`,
                        backgroundColor: cat.color,
                      }} />
                    </div>
                  </div>
                ))}
                {categoryData.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No spending data</div>
                )}
              </div>
            </div>
          )}

          {/* Trends */}
          {view === 'trends' && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border p-4">
                <h3 className="text-sm font-semibold mb-4">6-Month Overview</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="spent" name="Spent" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.85} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-2">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-rose-500 opacity-85" /><span className="text-xs text-muted-foreground">Spent</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-85" /><span className="text-xs text-muted-foreground">Income</span></div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border p-4">
                <h3 className="text-sm font-semibold mb-4">Spending Trend</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="spent" name="Spent" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', strokeWidth: 0, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Month summaries */}
              <div className="bg-card rounded-2xl border overflow-hidden">
                {[...trendData].reverse().map((m, i) => (
                  <div key={m.month} className={cn('flex items-center justify-between px-4 py-3', i !== trendData.length - 1 && 'border-b')}>
                    <span className="text-sm font-medium">{m.month}</span>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Spent</p>
                        <p className="text-sm font-semibold tabular-nums text-rose-400">{formatCurrency(m.spent)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Income</p>
                        <p className="text-sm font-semibold tabular-nums text-emerald-400">{formatCurrency(m.income)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring */}
          {view === 'recurring' && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Recurring Expenses</h3>
                  <span className="text-sm font-semibold tabular-nums text-rose-400">
                    {formatCurrency(recurringData.reduce((s, r) => s + r.amount, 0))}/mo
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-2xl border overflow-hidden">
                {recurringData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No recurring transactions detected yet. Import more statements to detect patterns.
                  </div>
                ) : (
                  recurringData.map((r, i) => (
                    <div key={i} className={cn('flex items-center gap-3 px-4 py-3', i !== recurringData.length - 1 && 'border-b')}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                        style={{ backgroundColor: ((r.category as any)?.color || '#94a3b8') + '22' }}>
                        {(r.category as any)?.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.merchant}</p>
                        <p className="text-xs text-muted-foreground">{(r.category as any)?.name || 'Uncategorized'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(r.amount)}</p>
                        <p className="text-xs text-muted-foreground">monthly</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
