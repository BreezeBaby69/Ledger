'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getCurrentMonth, getPreviousMonths, formatDate } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts'
import { format, parseISO, subMonths, addMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ArrowLeft, X } from 'lucide-react'

interface CategoryData {
  category_id: string
  name: string
  color: string
  icon: string
  amount: number
  transaction_count: number
}

interface DrillTxn {
  id: string
  date: string
  merchant: string
  amount: number
  category: { name: string; color: string; icon: string } | null
}

export default function AnalyticsPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [recurringData, setRecurringData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'spending' | 'trends' | 'recurring'>('spending')
  
  // Drill-down state
  const [drillCategory, setDrillCategory] = useState<CategoryData | null>(null)
  const [drillTxns, setDrillTxns] = useState<DrillTxn[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    setLoading(true)
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, category_id, category:categories(id, name, color, icon)')
      .gte('date', start).lte('date', end)
      .eq('is_transfer', false).lt('amount', 0)

    const catMap: Record<string, CategoryData> = {}
    for (const t of txns || []) {
      const cat = t.category as any
      const id = t.category_id || 'uncategorized'
      const name = cat?.name || 'Uncategorized'
      const color = cat?.color || '#94a3b8'
      const icon = cat?.icon || '📦'
      if (!catMap[id]) catMap[id] = { category_id: id, name, color, icon, amount: 0, transaction_count: 0 }
      catMap[id].amount += Math.abs(t.amount)
      catMap[id].transaction_count++
    }
    setCategoryData(Object.values(catMap).sort((a, b) => b.amount - a.amount))

    // 6-month trend
    const months = getPreviousMonths(6)
    const trend = await Promise.all(months.map(async m => {
      const s = m + '-01'
      const e = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]), 0).toISOString().split('T')[0]
      const { data } = await supabase.from('transactions').select('amount, is_transfer').gte('date', s).lte('date', e)
      const all = data || []
      return {
        month: m,
        label: format(parseISO(m + '-01'), 'MMM'),
        spent: all.filter((t: any) => t.amount < 0 && !t.is_transfer).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
        income: all.filter((t: any) => t.amount > 0 && !t.is_transfer).reduce((s: number, t: any) => s + t.amount, 0),
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

  async function openDrillDown(cat: CategoryData) {
    setDrillCategory(cat)
    setDrillLoading(true)

    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    let query = supabase
      .from('transactions')
      .select('id, date, merchant, amount, category:categories(name, color, icon)')
      .gte('date', start)
      .lte('date', end)
      .eq('is_transfer', false)
      .lt('amount', 0)
      .order('date', { ascending: false })

    if (cat.category_id === 'uncategorized') {
      query = query.is('category_id', null)
    } else {
      query = query.eq('category_id', cat.category_id)
    }

    const { data } = await query
    setDrillTxns((data || []) as DrillTxn[])
    setDrillLoading(false)
  }

  function closeDrillDown() {
    setDrillCategory(null)
    setDrillTxns([])
  }

  function prevMonth() {
    setMonth(format(subMonths(parseISO(month + '-01'), 1), 'yyyy-MM'))
    closeDrillDown()
  }

  function nextMonth() {
    const next = addMonths(parseISO(month + '-01'), 1)
    if (next <= new Date()) { setMonth(format(next, 'yyyy-MM')); closeDrillDown() }
  }

  const totalSpent = categoryData.reduce((s, c) => s + c.amount, 0)
  const monthLabel = format(parseISO(month + '-01'), 'MMMM yyyy')

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border rounded-xl p-3 text-xs shadow-lg">
        <p className="font-medium">{payload[0]?.name}</p>
        <p className="text-muted-foreground">{formatCurrency(payload[0]?.value)}</p>
      </div>
    )
  }

  // Drill-down modal
  if (drillCategory) {
    return (
      <div className="space-y-4 page-transition">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={closeDrillDown} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={18} className="text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{drillCategory.icon}</span>
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{drillCategory.name}</h2>
              <p className="text-xs text-muted-foreground">{monthLabel}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(drillCategory.amount)}</p>
            <p className="text-xs text-muted-foreground">{drillCategory.transaction_count} transactions</p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="bg-card rounded-2xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">% of total spending</span>
            <span className="text-xs font-medium">{Math.round(drillCategory.amount / totalSpent * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${Math.round(drillCategory.amount / totalSpent * 100)}%`,
              backgroundColor: drillCategory.color,
            }} />
          </div>
        </div>

        {/* Transactions */}
        {drillLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
        ) : drillTxns.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-sm text-muted-foreground">No transactions</div>
        ) : (
          <div className="bg-card rounded-2xl border overflow-hidden">
            {drillTxns.map((txn, i) => (
              <div key={txn.id} className={cn('flex items-center gap-3 px-4 py-3', i !== drillTxns.length - 1 && 'border-b')}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{txn.merchant}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(txn.date, 'EEEE, MMMM d')}</p>
                </div>
                <span className="text-sm font-medium tabular-nums flex-shrink-0">
                  {formatCurrency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="bg-card rounded-2xl border p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(drillCategory.amount)}</span>
        </div>

        <div className="h-2" />
      </div>
    )
  }

  return (
    <div className="space-y-4 page-transition">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft size={18} className="text-muted-foreground" />
        </button>
        <span className="font-medium text-sm">{monthLabel}</span>
        <button onClick={nextMonth} disabled={month === getCurrentMonth()}
          className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30">
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>
      </div>

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
              {/* Donut */}
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
                      <button key={cat.category_id} onClick={() => openDrillDown(cat)}
                        className="w-full flex items-center gap-2 hover:opacity-70 transition-opacity text-left">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-muted-foreground truncate flex-1">{cat.name}</span>
                        <span className="text-xs font-medium tabular-nums flex-shrink-0">
                          {Math.round(cat.amount / totalSpent * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category list — tappable */}
              <div className="bg-card rounded-2xl border overflow-hidden">
                <div className="px-4 py-2 border-b">
                  <p className="text-xs text-muted-foreground">Tap a category to see transactions</p>
                </div>
                {categoryData.map((cat, i) => (
                  <button key={cat.category_id} onClick={() => openDrillDown(cat)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors touch-active',
                      i !== categoryData.length - 1 && 'border-b'
                    )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-sm font-medium flex-1">{cat.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.amount)}</span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.round(cat.amount / totalSpent * 100)}%`,
                          backgroundColor: cat.color,
                        }} />
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {cat.transaction_count} txn{cat.transaction_count !== 1 ? 's' : ''} · {Math.round(cat.amount / totalSpent * 100)}%
                      </span>
                    </div>
                  </button>
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
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
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
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="spent" name="Spent" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', strokeWidth: 0, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

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
                    No recurring transactions detected yet.
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
